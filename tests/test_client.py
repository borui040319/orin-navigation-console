import importlib.util
import json
import os
from pathlib import Path
import socket
import subprocess
import sys
import tempfile
import threading
import unittest
import urllib.error
import urllib.request
from unittest.mock import Mock, patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT/'scripts'))
import common
import doctor
import start


class ConfigurationTests(unittest.TestCase):
    def check_config(self, data):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp)/'config.json'
            path.write_text(json.dumps(data), encoding='utf-8')
            return common.config(path)

    def test_rejects_ambiguous_or_unsafe_configuration(self):
        for data in ({'ssh_host':'-oProxyCommand=x'}, {'ssh_host':'orin; echo x'},
                     {'panel_port':8888}, {'panel_port':True}, {'panel_port':0},
                     {'open_browser':'false'}, {'password':'x'}, []):
            with self.subTest(data=data), self.assertRaises(ValueError):
                self.check_config(data)

    def test_missing_explicit_config_fails(self):
        with self.assertRaises(ValueError):
            common.config(ROOT/'does-not-exist.json')

    def test_tunnel_is_loopback_and_keeps_cross_host_port(self):
        cfg = self.check_config({'ssh_host':'orin-test', 'panel_port':18876})
        cmd = common.tunnel_command(cfg)
        self.assertIn('127.0.0.1:8888:127.0.0.1:8888', cmd)
        self.assertIn('StrictHostKeyChecking=yes', cmd)
        self.assertIn('ExitOnForwardFailure=yes', cmd)
        self.assertEqual(cmd[-1], 'orin-test')
        self.assertNotIn('-R', cmd)


class LifecycleTests(unittest.TestCase):
    def test_occupied_port_fails_without_killing_owner(self):
        with socket.socket() as sock:
            sock.bind(('127.0.0.1', 0))
            sock.listen()
            with self.assertRaises(OSError):
                start.port_available(sock.getsockname()[1])
            self.assertGreater(sock.fileno(), -1)

    def test_only_owned_children_are_cleaned_up(self):
        child = Mock()
        child.poll.return_value = None
        child.wait.side_effect = [subprocess.TimeoutExpired('test', 5), 0]
        exited = Mock()
        exited.poll.return_value = 1
        start.stop_children([child, exited])
        child.terminate.assert_called_once()
        child.kill.assert_called_once()
        exited.terminate.assert_not_called()

    def test_early_child_failure_is_reported(self):
        child = Mock()
        child.poll.return_value = 1
        with self.assertRaises(RuntimeError):
            start.wait_ready([child], ['http://127.0.0.1:1/'])

    @patch('doctor.shutil.which', return_value='/usr/bin/ssh')
    @patch('doctor.subprocess.run')
    def test_remote_failure_is_not_reported_as_success(self, run, _which):
        run.return_value = subprocess.CompletedProcess([], 0, '{"cross":{"error":"offline"}}', '')
        with self.assertRaisesRegex(RuntimeError, 'offline'):
            doctor.check({'ssh_host':'orin'})
        self.assertIn('ClearAllForwardings=yes', run.call_args.args[0])
        run.return_value = subprocess.CompletedProcess([], 255, '', 'host key mismatch')
        with self.assertRaisesRegex(RuntimeError, 'host key mismatch'):
            doctor.check({'ssh_host':'orin'})


class PanelTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        spec = importlib.util.spec_from_file_location('test_panel_module', ROOT/'client/panel.py')
        cls.panel = importlib.util.module_from_spec(spec)
        with patch.dict(os.environ, {'ORIN_SSH_HOST':'orin-test', 'ORIN_PANEL_PORT':'18876'}):
            spec.loader.exec_module(cls.panel)
        cls.server = cls.panel.ThreadingHTTPServer(('127.0.0.1', 0), cls.panel.Handler)
        cls.panel.PORT = cls.server.server_port
        cls.url = f'http://127.0.0.1:{cls.server.server_port}'
        cls.opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join()

    def test_original_ui_and_assets_are_served(self):
        for path in ('/', '/panel.js', '/cloud.js'):
            with self.opener.open(self.url+path) as response:
                text = response.read().decode()
                self.assertEqual(response.status, 200)
                self.assertNotIn('__TOKEN__', text)
        self.assertIn('orin-test', self.panel.SSH)

    def test_invalid_host_and_missing_token_never_reach_robot(self):
        with patch.object(self.panel.subprocess, 'run') as run:
            for headers in ({'Host':'evil.invalid'}, {}):
                req = urllib.request.Request(self.url+'/api', data=b'{"action":"status"}', headers=headers)
                with self.assertRaises(urllib.error.HTTPError) as exc:
                    self.opener.open(req)
                self.assertEqual(exc.exception.code, 403)
            run.assert_not_called()

    def test_status_uses_original_rpc_and_configuration_alias(self):
        with patch.object(self.panel.subprocess, 'run') as run:
            run.return_value = subprocess.CompletedProcess([], 0, '{"mode":"standard"}', '')
            req = urllib.request.Request(self.url+'/api', data=b'{"action":"status"}',
                headers={'X-ATEC-Token':self.panel.TOKEN})
            with self.opener.open(req) as response:
                self.assertEqual(json.load(response)['mode'], 'standard')
            args = run.call_args.args[0]
            self.assertEqual(args[-4:], ['orin-test','python3','/home/hkclr/atec_navigation/control/navctl.py','rpc'])
            self.assertEqual(json.loads(run.call_args.kwargs['input']), {'action':'status'})


if __name__ == '__main__':
    unittest.main()
