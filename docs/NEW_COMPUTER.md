# 新电脑如何连接机器狗

电脑连接的是机器狗上 Orin 的控制入口。传感器、ROS、模型与运动接口都由 Orin 保持原有配置；电脑不需要加入雷达或底盘网络。

## 1. 网络与设备

连接 Wi-Fi **ZTE_6D5AEB**，Wi-Fi 密码由设备管理者提供。Orin 通过 `enx889e966d5ceb` 接在同一台 ZTE 路由器上。2026-11-05 已核验 Orin 的地址为 **192.168.0.112**，账号为 **hkclr**。

```text
新电脑 Wi-Fi ── ZTE 路由器 ── Orin 192.168.0.112
    │                            ├─ ATEC 标准版 / 楼梯版
    ├─ localhost:8876 ── SSH ────┤
    └─ localhost:8888 ── SSH ────└─ CROSS 与现有机器狗接口
```

IP 由 DHCP 分配。若失联，在 ZTE 管理页核对 Orin 地址，并按下面的主机指纹确认身份后修改 SSH `HostName`。电脑在别的网络上不能仅靠 GitHub 链接访问机器人。沿用 ZTE 链路，不回退到旧直连地址或 Tailscale，也无需改动 Orin 的雷达／底盘网卡。

## 2. 安装客户端依赖

Ubuntu / Debian：

```bash
sudo apt update
sudo apt install python3 openssh-client git
python3 --version
ssh -V
```

需要 Python 3.10 或更新版本。Windows 安装 Python 3.10+、Git for Windows，并在“可选功能”中启用 **OpenSSH 客户端**。PowerShell 检查：

```powershell
py -3 --version
ssh -V
git --version
```

后续 Windows 命令在 PowerShell 执行。若只下载 ZIP，则不需要 Git；Windows 无需 WSL。当前实机连接验证在 Ubuntu 完成，Windows 的自动测试只覆盖客户端代码，不代表已在另一台 Windows 电脑实测 SSH 网络。

## 3. 为这台电脑创建独立 SSH 密钥

Ubuntu：

```bash
mkdir -p ~/.ssh
chmod 700 ~/.ssh
ssh-keygen -t ed25519 -f ~/.ssh/atec_orin_ed25519 -C orin-console-laptop
```

Windows：

```powershell
New-Item -ItemType Directory -Force "$HOME/.ssh"
ssh-keygen -t ed25519 -f "$HOME/.ssh/atec_orin_ed25519" -C orin-console-laptop
```

已有同名密钥时保留现有文件，不要覆盖。私钥只留在这台电脑；`.pub` 是可以交给设备管理者安装的公钥，不需要复制原电脑的私钥。

如果 Orin 允许密码登录，Ubuntu 可执行以下命令安装公钥（输入 Orin 账号密码）：

```bash
ssh-copy-id -i ~/.ssh/atec_orin_ed25519.pub hkclr@192.168.0.112
```

Windows 可执行：

```powershell
Get-Content "$HOME/.ssh/atec_orin_ed25519.pub" | ssh hkclr@192.168.0.112 'umask 077; mkdir -p ~/.ssh; cat >> ~/.ssh/authorized_keys; chmod 700 ~/.ssh; chmod 600 ~/.ssh/authorized_keys'
```

首次连接时核对提示中的 **ED25519 主机指纹**。从现有可信连接实测得到的指纹为：

```text
SHA256:sS/ut4NbXwK3ZLhdaPqNuum/xzDDKIcSSGWd5twHGb4
```

确认一致后才接受。如果提示其他算法的指纹，可在首次连接命令的 `ssh` 后加入 `-o HostKeyAlgorithms=ssh-ed25519` 明确选择 ED25519；`ssh-copy-id` 也接受这一 `-o` 参数。主机指纹与客户端公钥指纹不同。

若没有密码或密码登录被禁用，把**新电脑的 `.pub` 公钥文件**交给已有访问权限的人，在旧电脑上执行下列命令安装；不需要重部署算法：

```bash
cat /path/to/new-computer.pub | ssh orin 'umask 077; mkdir -p ~/.ssh; cat >> ~/.ssh/authorized_keys; chmod 700 ~/.ssh; chmod 600 ~/.ssh/authorized_keys'
```

## 4. 创建 SSH 别名

编辑 Ubuntu 的 `~/.ssh/config` 或 Windows 的 `$HOME/.ssh/config`（文件名为 `config`，没有 `.txt` 扩展名），加入下面这段。若已有 `Host orin`，更新其对应配置，不重复添加：

```sshconfig
Host orin
    HostName 192.168.0.112
    User hkclr
    Port 22
    IdentityFile ~/.ssh/atec_orin_ed25519
    IdentitiesOnly yes
    HostKeyAlgorithms ssh-ed25519
    StrictHostKeyChecking ask
    ConnectTimeout 8
    ServerAliveInterval 15
    ServerAliveCountMax 3
```

Ubuntu 执行 `chmod 600 ~/.ssh/config`。若电脑同时连接多个网络，Ubuntu 可在该 Host 段增加 `BindInterface <本机连接ZTE的Wi-Fi网卡名>`，通过 `ip -br address` 查看。原电脑的名称是 `wlp130s0`，新电脑可能不同，不能直接照抄。Windows 不要照搬 Linux 的网卡名，使用 ZTE 网络的正常路由。

手动完成第一次连接与主机密钥确认：

```bash
ssh orin 'hostname'
```

正常返回 `ubuntu`。若密钥有口令，先用本机 SSH agent 解锁。Ubuntu：

```bash
eval "$(ssh-agent -s)"
ssh-add ~/.ssh/atec_orin_ed25519
```

Windows 先在管理员 PowerShell 中启用系统代理（仅首次）：

```powershell
Set-Service -Name ssh-agent -StartupType Automatic
Start-Service ssh-agent
```

然后在普通 PowerShell 中运行：

```powershell
ssh-add "$HOME/.ssh/atec_orin_ed25519"
```

最后验证无需交互登录：

```bash
ssh -o BatchMode=yes -o StrictHostKeyChecking=yes orin 'hostname'
```

客户端启动后不会弹出密码输入，所以这一步必须成功。

## 5. 获取仓库并打开两页

按 [README](../README.md) 克隆或下载客户端，再运行 `scripts/doctor.py` 和 `scripts/start.py`。无需运行任何 Orin 安装脚本或复制模型。两个入口是新电脑自己的 `127.0.0.1:8876` 与 `127.0.0.1:8888`，不能把旧电脑的 localhost 地址当成网络服务器。

下一次使用时，连接 ZTE、按需 `ssh-add` 解锁密钥、运行 `start.py` 即可。若旧电脑正在控制机器人，先协调操作者；新电脑打开网页就能看到同一后端的当前状态，不需要重启后端来“接管网页”。
