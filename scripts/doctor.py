#!/usr/bin/env python3
"""Read-only check of the currently deployed Orin, without opening sensors."""
import argparse
import json
import shutil
import subprocess
import sys
from common import config, ssh_options

REMOTE_PROBE = r'''
import json, re, subprocess, urllib.request
result = {}
try:
    p = subprocess.run(['python3', '/home/hkclr/atec_navigation/control/navctl.py', 'rpc'],
        input=json.dumps({'action':'status'}), capture_output=True, text=True, timeout=20)
    data = json.loads(p.stdout)
    if p.returncode or data.get('error'):
        raise RuntimeError(data.get('error') or p.stderr or 'navctl failed')
    result['navigation'] = {k: data.get(k) for k in ('mode','service','build_ready','enable_chassis')}
    result['navigation']['map_count'] = len(data.get('maps', []))
except Exception as exc:
    result['navigation'] = {'error': str(exc)}
try:
    root = 'http://127.0.0.1:8888'
    with urllib.request.urlopen(root+'/', timeout=10) as response:
        html = response.read().decode()
    token = re.search(r'name="cross-token" content="([^"]+)"', html)
    if token is None:
        raise RuntimeError('CROSS token not found: unexpected console page')
    req = urllib.request.Request(root+'/api', data=b'{"action":"status"}',
        headers={'Content-Type':'application/json', 'X-CROSS-Token':token.group(1)})
    with urllib.request.urlopen(req, timeout=10) as response:
        data = json.load(response)
    if data.get('error'):
        raise RuntimeError(data['error'])
    result['cross'] = {'active': data.get('active'), 'map_count':len(data.get('maps', [])),
        'modes': [{'id':m['id'], 'ready':m['ready'], 'missing':m['missing']} for m in data['modes']],
        'chassis_enabled':data.get('chassis_enabled')}
except Exception as exc:
    result['cross'] = {'error': str(exc)}
print(json.dumps(result, ensure_ascii=False))
'''


def check(cfg):
    if not shutil.which('ssh'):
        raise RuntimeError('找不到 OpenSSH 客户端，请按 docs/NEW_COMPUTER.md 安装')
    proc = subprocess.run(ssh_options() + ['-o', 'ClearAllForwardings=yes', cfg['ssh_host'], 'python3', '-'],
                          input=REMOTE_PROBE, text=True, capture_output=True, timeout=65)
    if proc.returncode:
        raise RuntimeError(proc.stderr.strip() or 'SSH 检查失败')
    try:
        result = json.loads(proc.stdout)
    except ValueError as exc:
        raise RuntimeError('SSH 返回了非 JSON 数据，请检查远端 shell 启动脚本') from exc
    errors = [f'{key}: {value["error"]}' for key, value in result.items() if value.get('error')]
    if errors:
        raise RuntimeError('\n'.join(errors))
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--config')
    args = parser.parse_args()
    try:
        result = check(config(args.config))
        print(json.dumps(result, ensure_ascii=False, indent=2))
        modes = result['cross']['modes']
        print(f'连接通过：ATEC 控制器可访问，CROSS 返回 {len(modes)} 个方法。')
        print('软件可访问不代表相机 IMU、GPS 定位或实地行走验收通过。')
        return 0
    except (OSError, ValueError, RuntimeError, subprocess.TimeoutExpired) as exc:
        print(f'检查失败：{exc}', file=sys.stderr)
        return 1


if __name__ == '__main__':
    sys.exit(main())
