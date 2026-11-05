# Orin 机器狗双控制台客户端

在另一台电脑上使用**与现有电脑相同的控制台和实时预览**，控制已经部署好的 Orin。算法、ROS、CUDA、模型、地图和导航进程继续运行在 Orin；新电脑只安装 Python 3.10+、OpenSSH 和浏览器。Python 端没有第三方依赖，无需 `pip install`。

| 本机网页 | 内容 | 实际运行位置 |
|---|---|---|
| <http://127.0.0.1:8876/> | 标准版 / v2 楼梯版：建图、三维点云、航点、重定位、目标导航、日志 | 本机原版界面 → SSH → Orin 现有控制器 |
| <http://127.0.0.1:8888/> | CROSS：14 种方法、拓扑地图、定位、冻结路线、下一航点、执行状态 | SSH 隧道直接访问 Orin 原版网页 |

第二个网页直接来自 Orin，所以包括当前已有的连续航点、遥控接管和恢复逻辑。第一个网页复用当前电脑的 `panel.html`、`panel.js`、`cloud.js`，只将连接配置改为读取新电脑的 SSH 别名。这里没有模拟算法或另一个导航后台。

## 第一次换电脑

1. 按 [新电脑连接指南](docs/NEW_COMPUTER.md) 连接 **ZTE_6D5AEB**，配置自己的 SSH 密钥和 `orin` 别名。
2. 登录有仓库权限的 GitHub 账号，然后克隆（也可在 GitHub 点 **Code → Download ZIP** 并解压）：

   ```bash
   git clone https://github.com/borui040319/orin-navigation-console.git
   cd orin-navigation-console
   ```

3. 在仓库目录运行：

   **Ubuntu / Linux：**

   ```bash
   python3 scripts/doctor.py
   python3 scripts/start.py
   ```

   **Windows PowerShell：**

   ```powershell
   py -3 scripts/doctor.py
   py -3 scripts/start.py
   ```

两个网页就绪后会自动打开。保持终端运行即可；日常只需连接 ZTE 网络后再次执行 `start.py`。

`doctor.py` 只读取控制器与 CROSS 状态，不启动相机、建图、规划或底盘输出。它显示方法是否具备软件依赖；硬件状态仍以网页与实机为准。

## 使用流程

- [标准版与楼梯版操作](docs/WORKFLOWS.md#标准版与楼梯版)
- [CROSS 建图、定位与导航](docs/WORKFLOWS.md#cross)
- [完整方法列表](docs/METHODS.md)
- [断线、端口占用、换电脑接续与常见问题](docs/TROUBLESHOOTING.md)
- [实现与验证范围](docs/ARCHITECTURE.md)

多个电脑看到的是**同一台 Orin 的同一套任务和地图**，并非各自独立运行。两页可同时查看；操作时由一位操作者控制，一次使用一套导航流程，避免两个控制器同时控制同一机器狗。关闭网页、退出本机脚本或断开 Wi-Fi 不会停止 Orin 任务；结束导航应使用原网页的停止按钮。

## 可选配置与更新

默认无需配置文件。如果 SSH 别名或第一个网页端口不同，将 `config.example.json` 复制为 `config.local.json` 后修改。配置文件已加入 Git 忽略规则。

```json
{
  "ssh_host": "orin",
  "panel_port": 8876,
  "open_browser": true
}
```

`python3 scripts/start.py --no-browser` 可只启动入口。也可用 `--config /path/to/config.json` 指定配置。CROSS 本机端口固定为 **8888**，因为现有服务会校验 HTTP Host；不可随意替换为其他端口或直接使用 Orin IP 访问网页。

更新客户端：退出本机 `start.py`，执行 `git pull --ff-only`，再运行 `start.py`。这只更新当前电脑，不重新部署 Orin。

仓库默认为私有。另一台电脑需要能访问此仓库的 GitHub 账号；GitHub 访问权限与 Orin 的 SSH 权限是两件事。GitHub 用于获取客户端和说明，实际操作需要能够连通 ZTE 局域网。
