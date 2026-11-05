# 常见问题

| 现象 | 检查与处理 |
|---|---|
| `ssh orin` 超时或无路由 | 确认新电脑在 ZTE_6D5AEB、Orin 接入 ZTE；核对 DHCP 地址和本机到 192.168.0.112 的路由。不要改雷达／底盘网卡来修电脑连接。 |
| `Host key verification failed` | 先手动 `ssh orin`，核对连接指南中的指纹并完成首次登记。若密钥变化，向设备管理者核实；不要用关闭主机校验绕过。 |
| `Permission denied (publickey)` | 确认新电脑 `.pub` 已安装，SSH config 的私钥路径正确；有口令时先 `ssh-add`。以 BatchMode 的 hostname 命令确认可无交互登录。 |
| GitHub 克隆 404 或没有权限 | 仓库是私有；使用有访问权限的 GitHub 账号登录。GitHub 权限不会自动赋予 Orin SSH 权限。 |
| `8876` 或 `8888` 被占用 | 很可能本机已有控制台。优先打开既有页面；确认进程归属后关闭其启动终端。脚本不会结束其他进程。8876 可通过配置更改，8888 必须保持。 |
| 8876 页面显示未连接 | 运行 `doctor.py`。8876 的 API 通过 `ssh orin` 调用现有 `navctl.py`；检查 SSH 账号和 `/home/hkclr/atec_navigation/control/navctl.py` 是否仍存在。 |
| 8888 连接被拒绝 | 先 `ssh orin 'systemctl --user status atec-cross.service'` 查看已有服务状态和 `journalctl --user -u atec-cross.service -n 80 --no-pager` 日志；交由维护者恢复现有服务。无需从新电脑重新部署算法。 |
| 直接打开 Orin 的 IP:8888 不通／403 | 服务只在 Orin loopback 监听并校验 Host，必须通过本机 8888 隧道访问。 |
| `doctor.py` 连接成功，但没有实时点云 | 连接成功只代表控制器可访问；点云需要已启动对应流程且传感器有数据。待机时查看的是已保存地图。 |
| CROSS 显示依赖就绪，但方法启动失败 | 软件依赖可导入与相机 IMU、运动初始化、GPS 有效定位是不同状态；在网页查看具体错误及日志。换电脑不会修复传感器问题。 |
| Wi-Fi 中断后入口退出 | 脚本检测到 SSH 退出会关闭本机两个入口。网络恢复后重跑 `start.py`，检查远端任务状态；不要假定机器人任务已自动结束。 |
| 新电脑打开了网页但状态与旧电脑相同 | 正常，两台电脑共用同一个 Orin。选定地图与视图属于页面状态，执行任务和数据属于 Orin。 |

终端前台运行，关闭终端会断开访问。`Ctrl+C` 只清理此脚本启动的本机 Python 面板和 SSH 进程，不向 Orin 发送停止、重启或运动命令。

只有改变 SSH 地址／密钥时需要修改新电脑配置；后端方法、地图、导航流程保持 Orin 现有版本。遇到版本变化时先 `git pull --ff-only` 更新客户端，再请维护者确认接口兼容性。
