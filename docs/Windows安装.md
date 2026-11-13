# Windows 试用安装

仓库是 **private**：里面包含本项目按“完全自用”处理的官方角色裁切与影视帧背景，不做公开分发。Windows 机器需要先登录同一个 GitHub 账号。

## 1. 登录与 Git 凭据

安装 Git 与 GitHub CLI 后，在 PowerShell 中：

```powershell
gh auth login
gh auth setup-git
gh auth status
```

确认 `gh auth status` 显示 `anki7peng-png`，然后验证仓库可访问：

```powershell
git ls-remote https://github.com/anki7peng-png/dsh-luoxiaohei-skins.git
```

能列出 ref 说明 Git 凭据已配置好；否则先执行 `gh auth setup-git`。

## 2. 在 DSH 中安装

推荐先用 DSH 的插件页：

1. 打开 DSH →「插件」→「添加插件」。
2. 输入仓库地址：
   `https://github.com/anki7peng-png/dsh-luoxiaohei-skins`
3. 安装完成后重启 DSH。
4. 插件页 →「罗小黑系列皮肤」→ 选择「小黑·森林」。

如果插件页安装器没有用上 Git 凭据，先回到第 1 步确认 `git ls-remote` 能成功；若仍失败，请把 DSH 的报错发我，我再给本地路径安装方式。注意：`dsh plugin --profile desktop add ...` 只安装依赖，不会自动把 bundle 注册进 profile，不建议单独使用。

## 3. 验收点

- 插件页显示「罗小黑系列皮肤 · 1/6 可用」。
- 选中「小黑·森林」后背景、深色 token 和悬浮小黑出现。
- 输入栏右侧有小黑，输入栏与轮数/步数/token/上下文状态仍在底部。
- 鼠标移动时小黑瞳孔跟随；失焦回中。
- 等待提问时，标题旁出现 34px 琥珀头像。

## 4. 已知风险

- 悬浮定位依赖 DSH 0.2.2 的 composer CSS 模块类 `_composerStack`。如果 Windows 端 DSH 版本不同，小黑可能退回普通布局；请记录 DSH 版本。
- Windows 桌面端尚未实测；macOS 隔离 Web 已验证。GitHub spec（`github:anki7peng-png/dsh-luoxiaohei-skins`）在 macOS 隔离 profile 安装成功，可作为 Windows 安装的参考。
- 仓库为 private；不要改为 public，除非先替换掉官方/影视帧派生素材。
