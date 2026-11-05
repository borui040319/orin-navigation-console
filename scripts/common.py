"""Portable workstation configuration; no robot-side writes."""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def configure_output():
    # Windows redirected streams may otherwise use an ANSI code page.
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, 'reconfigure'):
            stream.reconfigure(encoding='utf-8', errors='backslashreplace')


def config(path=None):
    if path is not None and not Path(path).is_file():
        raise ValueError('指定的配置文件不存在：' + str(path))
    path = Path(path) if path else ROOT / 'config.local.json'
    result = {'ssh_host': 'orin', 'panel_port': 8876, 'open_browser': True}
    if path.exists():
        supplied = json.loads(path.read_text(encoding='utf-8'))
        if not isinstance(supplied, dict) or set(supplied) - set(result):
            raise ValueError('配置只接受 ssh_host、panel_port、open_browser')
        result.update(supplied)
    if not isinstance(result['ssh_host'], str) or not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_.-]*', result['ssh_host']):
        raise ValueError('ssh_host 必须是 ~/.ssh/config 中的别名，不是命令或 IP URL')
    port = result['panel_port']
    if type(port) is not int or not 1024 <= port <= 65535 or port == 8888:
        raise ValueError('panel_port 必须为 1024–65535 且不能是 8888')
    if type(result['open_browser']) is not bool:
        raise ValueError('open_browser 必须为 true 或 false')
    return result


def ssh_options():
    return ['ssh', '-T', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=8',
            '-o', 'StrictHostKeyChecking=yes', '-o', 'ServerAliveInterval=15',
            '-o', 'ServerAliveCountMax=3', '-o', 'ControlMaster=no', '-o', 'ControlPath=none']


def tunnel_command(cfg):
    # CROSS validates Host against port 8888, so keep its local port unchanged.
    return ssh_options() + ['-o', 'ExitOnForwardFailure=yes', '-N',
                            '-L', '127.0.0.1:8888:127.0.0.1:8888', cfg['ssh_host']]
