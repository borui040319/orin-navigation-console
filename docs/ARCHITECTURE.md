# 客户端实现与验证

## 运行结构

- `client/panel.html`、`panel.js`、`cloud.js`：从现有电脑部署逐字复制的 ATEC 网页。接口、动作白名单和交互流程保持一致。
- `client/panel.py`：原本机 loopback HTTP 服务；适配可配置 SSH 别名／本机端口，使用新电脑 SSH config 中的密钥与主机校验，显式用 UTF-8 读取中文网页和 SSH 响应以兼容 Windows。API 仍转发到原 `navctl.py rpc`。
- `scripts/start.py`：只读检查 Orin，启动本机面板与 loopback SSH 正向隧道，等待两页 HTTP 就绪，打开浏览器并监督子进程。失败时退出并清理自己创建的本机子进程。
- `scripts/doctor.py`：只通过 SSH 调用 ATEC `status` 和 CROSS `status`。不重启服务、不打开传感器、不发送导航目标。
- `scripts/common.py`：配置验证与 SSH 参数。CROSS 保留 8888 端口以兼容当前服务的 Host 校验。

两个本机端口都仅绑定 `127.0.0.1`。ATEC 保留每次启动随机的请求 token、Host 校验和动作白名单；CROSS 的认证与页面全部由现有服务提供。没有复制 SSH 密钥、口令、运行令牌、地图、模型或录制数据到仓库。

## 当前后端参考

| 项目 | 现有位置 / 版本 |
|---|---|
| ATEC 控制器 | `/home/hkclr/atec_navigation/control/navctl.py` |
| 标准版 | [HKCLR2021/robot-dog-navigation](https://github.com/HKCLR2021/robot-dog-navigation)，上游 `147e8b5c23cf70a3dbe91bf7af3854079995d4f3` 加现有部署修改 |
| 楼梯版 | [HKCLR2021/scan-nav](https://github.com/HKCLR2021/scan-nav)，上游 `4d306a0014a1ebaf900c7ff8af8e0df1aaa37b81` 加现有部署修改 |
| CROSS | `/home/hkclr/cross_orin`；[jiaming-ai/CROSS](https://github.com/jiaming-ai/CROSS)，部署记录上游 `2b560ceaaac8f439655cc53d0ab0238c483c1c1b` 加现有部署修改 |
| CROSS 网页 | `atec-cross.service`，Orin `127.0.0.1:8888` |
| CROSS 连续航点与输出 | 现有 `atec-cross-motion.service` |
| GNSS 采集 | 现有 `atec-cross-gnss.service` |
| ATEC 任务 | 现有 `atec-navigation.service`，无任务时 inactive 为正常状态 |

版本与部分文件 SHA-256 仅用于记录客户端整理时所对应的部署，见 [deployed-reference.json](deployed-reference.json)。CROSS 原代码目录不是 Git 工作树，上游提交来自其 `UPSTREAM.txt`，不能把此提交当成当前所有文件未经修改的证明。新电脑不下载这些后端仓库，也不执行其安装器。

## 验证范围

客户端单元测试：

```bash
python3 -m unittest discover -s tests -v
```

覆盖配置验证、loopback 隧道、端口占用、子进程失败清理、Host/token 保护、原网页资源与状态 RPC 转发。GitHub Actions 在 Ubuntu / Windows 与 Python 3.10 / 3.12 运行这些测试，不连接真实机器狗。

真实只读连接结果与网页接口检查记录在 [VALIDATION.md](VALIDATION.md)。本次交付只验证新客户端接入路径，没有执行建图、导航目标、运动或重新部署。算法精度、相机硬件状态和实地行走不在本次验证范围。

## 维护

CROSS 网页随 Orin 服务实时提供，无需客户端同步网页文件。若未来修改 ATEC 原网页，需将新的 `panel.html`、`panel.js`、`cloud.js` 同步进本仓库；若远端 RPC 路径或协议变化，同时更新 `panel.py` 并做连接测试。后端维护与客户端更新是独立操作，本仓库没有自动写入 Orin 的逻辑。

本仓库只交付控制台客户端与接入文档。相关后端算法和依赖继续遵循各自上游许可证；此处不重新分发模型或算法实现。
