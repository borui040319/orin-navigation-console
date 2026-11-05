#!/usr/bin/env python3
"""Laptop loopback UI, authenticated SSH RPC. No inbound port on the Orin LAN."""
import json
import os
import re
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import secrets
import subprocess
PORT = int(os.environ.get('ORIN_PANEL_PORT', '8876'))
TOKEN = secrets.token_urlsafe(32)
HERE = Path(__file__).parent
SSH_HOST = os.environ.get('ORIN_SSH_HOST', 'orin')
if not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_.-]*', SSH_HOST):
    raise ValueError('ORIN_SSH_HOST must be an SSH config alias')
# Identity, LAN binding and host-key identity belong to this computer's SSH config.
SSH = ['ssh', '-T', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=8',
       '-o', 'StrictHostKeyChecking=yes', '-o', 'ClearAllForwardings=yes',
       '-o', 'ControlMaster=no', '-o', 'ControlPath=none',
       SSH_HOST, 'python3', '/home/hkclr/atec_navigation/control/navctl.py', 'rpc']
ACTIONS = {'status','logs','scene','stop','switch','start','mapping_start','mapping_save',
           'navigate','confirm_localization','record','goal','tomogram'}


class Handler(BaseHTTPRequestHandler):
    def send(self, status, content, kind='application/json; charset=utf-8'):
        raw = content.encode()
        self.send_response(status)
        self.send_header('Content-Type', kind)
        self.send_header('Content-Length', str(len(raw)))
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Frame-Options', 'DENY')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data:")
        self.end_headers()
        try:
            self.wfile.write(raw)
        except BrokenPipeError:
            pass

    def valid_host(self):
        return self.headers.get('Host') in (f'127.0.0.1:{PORT}', f'localhost:{PORT}')

    def do_GET(self):
        if not self.valid_host():
            return self.send(403, '{}')
        files = {'/': ('panel.html', 'text/html; charset=utf-8'),
                 '/panel.js': ('panel.js', 'text/javascript; charset=utf-8'),
                 '/cloud.js': ('cloud.js', 'text/javascript; charset=utf-8')}
        if self.path not in files:
            return self.send(404, '{}')
        filename, kind = files[self.path]
        self.send(200, (HERE / filename).read_text(encoding='utf-8').replace('__TOKEN__', TOKEN), kind)

    def do_POST(self):
        if not self.valid_host() or self.path != '/api' or self.headers.get('X-ATEC-Token') != TOKEN:
            return self.send(403, '{"error":"Forbidden"}')
        try:
            size = int(self.headers.get('Content-Length', 0))
            if not 0 < size < 4096:
                raise ValueError('请求大小无效')
            req = json.loads(self.rfile.read(size))
            if req.get('action') not in ACTIONS:
                raise ValueError('不支持的操作')
            p = subprocess.run(SSH, input=json.dumps(req), capture_output=True,
                               text=True, encoding='utf-8', timeout=85)
            if not p.stdout.strip():
                raise ValueError(p.stderr.strip() or 'Orin 连接失败')
            result = json.loads(p.stdout)
            self.send(200 if not result.get('error') else 400, json.dumps(result, ensure_ascii=False))
        except Exception as e:
            self.send(500, json.dumps({'error': str(e)}, ensure_ascii=False))

    def log_message(self, *args):
        pass


if __name__ == '__main__':
    ThreadingHTTPServer(('127.0.0.1', PORT), Handler).serve_forever()
