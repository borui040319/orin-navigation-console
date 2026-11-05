#!/usr/bin/env python3
"""Start the original ATEC UI and an SSH tunnel to the original CROSS UI."""
import argparse
import os
import signal
import socket
import subprocess
import sys
import time
import urllib.request
import webbrowser
from common import ROOT, config, tunnel_command, configure_output
from doctor import check


def port_available(port):
    with socket.socket() as sock:
        if hasattr(socket, 'SO_EXCLUSIVEADDRUSE'):
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_EXCLUSIVEADDRUSE, 1)
        sock.bind(('127.0.0.1', port))


def stop_children(children):
    for child in reversed(children):
        if child.poll() is None:
            child.terminate()
    for child in reversed(children):
        try:
            child.wait(timeout=5)
        except subprocess.TimeoutExpired:
            child.kill()
            child.wait()


def wait_ready(children, urls, timeout=20):
    pending = set(urls)
    deadline = time.monotonic() + timeout
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    while pending and time.monotonic() < deadline:
        if any(child.poll() is not None for child in children):
            raise RuntimeError('本机面板或 SSH 隧道提前退出，请检查上方日志')
        for url in list(pending):
            try:
                with opener.open(url, timeout=1) as response:
                    if response.status == 200:
                        pending.remove(url)
            except OSError:
                pass
        if pending:
            time.sleep(.2)
    if pending:
        raise RuntimeError('网页未就绪：' + ', '.join(sorted(pending)))


def main():
    configure_output()
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--config')
    parser.add_argument('--no-browser', action='store_true')
    args = parser.parse_args()
    children = []
    try:
        cfg = config(args.config)
        for port in (cfg['panel_port'], 8888):
            try:
                port_available(port)
            except OSError as exc:
                raise RuntimeError(f'本机端口 {port} 已被占用；请检查已有控制台，脚本不会终止它') from exc
        print('正在通过 ZTE 局域网检查 Orin（只读取状态）…', flush=True)
        result = check(cfg)
        print(f'Orin 已连接，CROSS 返回 {len(result["cross"]["modes"])} 个方法。', flush=True)
        env = dict(os.environ, ORIN_SSH_HOST=cfg['ssh_host'], ORIN_PANEL_PORT=str(cfg['panel_port']))
        children.append(subprocess.Popen([sys.executable, str(ROOT/'client/panel.py')], env=env))
        children.append(subprocess.Popen(tunnel_command(cfg)))
        urls = [f'http://127.0.0.1:{cfg["panel_port"]}/', 'http://127.0.0.1:8888/']
        wait_ready(children, urls)
        print('\n标准版 / 楼梯版：' + urls[0] + '\nCROSS 控制台：' + urls[1], flush=True)
        print('保持此终端运行。Ctrl+C 仅关闭本机入口；Orin 上的任务不会因此停止。', flush=True)
        if cfg['open_browser'] and not args.no_browser:
            for url in urls:
                webbrowser.open(url)
        while True:
            if any(child.poll() is not None for child in children):
                raise RuntimeError('面板或 SSH 隧道断开。恢复网络后重新运行 start.py；远端任务可能仍在运行')
            time.sleep(.5)
    except KeyboardInterrupt:
        print('\n已关闭本机访问入口。Orin 任务状态请在重新连接后检查。')
        return 0
    except (OSError, ValueError, RuntimeError, subprocess.TimeoutExpired) as exc:
        print(f'启动失败：{exc}', file=sys.stderr)
        return 1
    finally:
        stop_children(children)


if __name__ == '__main__':
    def interrupted(*_):
        raise KeyboardInterrupt
    signal.signal(signal.SIGTERM, interrupted)
    sys.exit(main())
