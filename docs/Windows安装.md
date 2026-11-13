# Windows 试用安装

仓库现在是 **public**：

<https://github.com/anki7peng-png/dsh-lxhzj-skins>

不需要 GitHub 登录即可读取。仓库里包含按项目所有者确认“完全自用”处理的官方角色裁切与影视帧派生素材；公开可见不代表授权第三方商用或再分发。

## 1. 在 DSH 中安装

1. 打开 DSH →「插件」→「添加插件」。
2. 输入仓库地址或 pnpm GitHub spec：
   `https://github.com/anki7peng-png/dsh-lxhzj-skins`
   或 `github:anki7peng-png/dsh-lxhzj-skins`
   - 不要只输入 `dsh-lxhzj-skins`：安装器会把它当作 npm 包名，不会去 GitHub 查找。
3. 安装完成后重启 DSH。
4. 插件页 →「罗小黑系列皮肤」→ 选择「小黑·森林」。

如果安装器走 Git/pnpm，Windows 上需要先安装 Git；public 仓库不需要 `gh auth login`。

可选：先用 Git 验证仓库可访问：

```powershell
git ls-remote https://github.com/anki7peng-png/dsh-lxhzj-skins.git
```

## 2. 验收点

- 插件页显示「罗小黑系列皮肤 · 1/6 可用」。
- 选中「小黑·森林」后背景、深色 token 和悬浮小黑出现；Windows 会自动使用提亮版背景和更轻遮罩。
- 右下角小黑标题末尾出现 `W9`，说明 Windows 分支已加载；如果没有 `W9`，请完全退出 DSH 再重开，而不是只刷新页面。
- 0.1.10 起不再显示 W7/W8 诊断面板；右下角标题仍带 `W9`，用于确认新客户端生效。
- 输入栏右侧有小黑，输入栏与轮数/步数/token/上下文状态仍在底部。
- 鼠标移动时小黑瞳孔跟随；失焦回中。
- 等待提问时，标题旁出现 34px 琥珀头像。

## 3. 已知风险

- 悬浮定位依赖 DSH 0.2.2 的 composer CSS 模块类 `_composerStack`。如果 Windows 端 DSH 版本不同，小黑可能退回普通布局；请记录 DSH 版本。
- Windows 桌面端尚未实测；macOS 隔离 Web 已验证。GitHub spec（`github:anki7peng-png/dsh-lxhzj-skins`）已在 macOS 隔离 profile 安装成功，可作为 Windows 安装的参考。

## 4. 素材与公开说明

角色“罗小黑”及《罗小黑战记》相关形象版权归 MTJJ 木头 / 寒木春华 / 版权方所有。本仓库公开仅作项目所有者跨设备试用与备份，不商用、不冒充官方；如需公开分发或二次使用，请先处理素材授权。
