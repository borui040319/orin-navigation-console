# 当前 CROSS 方法列表

2026-11-05 从 Orin 的现有 `control/modes.py` 读取，共 14 个配置。新电脑直接使用 Orin 提供的方法，不安装任何模型。运行时以网页“查看全部配置”和 `doctor.py` 返回值为准。

| 配置 ID | 网页名称 | 上游配置 |
|---|---|---|
| `rgbd_wheel` | RGB-D + IMU · DPVO+IMU · PnP | `rgbd_wheel` |
| `rgbd_ff_wheel` | RGB-D + IMU · DPVO+IMU · VGGT | `rgbd_ff_wheel` |
| `mono_wheel` | RGB + IMU · 外部 DPVO+IMU · VGGT | `mono_wheel` |
| `rgbd_dpvo` | RGB-D · DPVO · PnP | `rgbd_dpvo` |
| `mono_dpvo` | RGB · DPVO · DA3 | `mono_dpvo` |
| `mono_imu` | RGB + IMU · VGGT+IMU · VGGT | `mono_imu` |
| `mono_vio` | RGB + IMU · DPVO+IMU · VGGT | `mono_vio` |
| `rgbd_basalt` | RGB-D + IR双目 + IMU · Basalt · PnP | `rgbd_basalt` |
| `rgbd_ff_basalt` | RGB-D + IR双目 + IMU · Basalt · VGGT | `rgbd_ff_basalt` |
| `mono_basalt` | RGB + IR双目 + IMU · Basalt · VGGT | `mono_basalt` |
| `gps_rgbd_imu_dpvo_pnp` | GPS + RGB-D + IMU · DPVO+IMU · PnP | `rgbd_wheel` |
| `gps_rgbd_imu_dpvo_vggt` | GPS + RGB-D + IMU · DPVO+IMU · VGGT | `rgbd_ff_wheel` |
| `gps_rgbd_imu_basalt_pnp` | GPS + RGB-D + IR双目 + IMU · Basalt · PnP | `rgbd_basalt` |
| `gps_rgbd_imu_basalt_vggt` | GPS + RGB-D + IR双目 + IMU · Basalt · VGGT | `rgbd_ff_basalt` |

`*_wheel` 在本部署中使用原“外部里程计”入口，由 DPVO+IMU 提供，不代表电脑需要轮速计。Basalt 配置使用 D435i 的左右红外与 IMU；GPS 配置在对应方法上叠加现有 GNSS 处理。

标准版与 v2 楼梯版在另一个 8876 网页中，共两个导航模式，不计入以上 14 个 CROSS 配置。

2026-11-05 连接检查中，14 个配置都报告软件依赖就绪。这不证明每种方法已完成当前传感器采集、运动初始化、地图精度或真实行走验收。已有部署记录中的相机 IMU 无输出与 GPS 无有效定位问题仍应根据实时硬件状态排查；本客户端不会绕过这些要求。
