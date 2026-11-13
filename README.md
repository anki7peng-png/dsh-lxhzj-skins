# 罗小黑系列 DSH 皮肤插件

一套独立的 DSH 插件：同一份代码加载并切换六套《罗小黑战记》主题，不依赖鲸鱼娘或其他皮肤管理插件。插件详情页显示主题列表，可切换已配置主题或恢复 DSH 默认界面。

## 当前进度

- **「小黑·森林」已完成视觉制作并接入**：第 41 集动画森林背景、官方原形四态、深色配色、界面氛围层、主题选择卡和等待态小头像。
- 其余五套（无限·山水、哪吒·电竞、小白·乡村、风息·森林、会馆·龙游）保留名称与素材入口，显示「素材待制作」，不可选用。

## 视觉概要

- **背景**：3200×2000 动画森林背景，直接取自第 41 集 `00:01:57.042` 的林下树影帧；16:10 裁切、去除右上角源内哔哩哔哩标识、压暗调色并加暗角。巨木、横枝、山野和蝉保留原片手绘质感。Windows 端的问题是桌面壳 `.mP3x-q_frame` 有一层 86% 深色填充；0.1.9 在 Windows 下把这个 frame 透明化，直接露出基础背景。`background-win.webp` 保留为备用素材。
- **角色**：小黑本体直接裁自 `角色卡/罗小黑/原形_官方设定图.png`，保留原图的奶油色眼白、黑瞳、绿耳与长尾；四态共用这一官方坐姿，分别叠加符文笏板（`working`）、琥珀问询符（`waiting`）、叶片“z”（`idle`）和下半身雾化（`unknown`）。600×660 RGBA WebP；状态靠道具/雾化区分。完整图悬浮在输入栏右侧、状态行右端，不占输入区高度。
- **界面**：深松墨绿玻璃层、苔玉描边、月金字色；`body::before` 氛围叠层 + `body::after` 轻颗粒/内框；角色有浮动/呼吸动效，等待时在会话标题旁显示 34px 琥珀描边头像。所有动效尊重 `prefers-reduced-motion`。
- 完整设定、色板、构图与资产清单见 [`docs/视觉设定-小黑森林.md`](docs/视觉设定-小黑森林.md)。

## 除外观外的功能

- **任务状态联动**：基于当前会话的 `running` / `pendingInteraction` 实时映射四态；输入栏右侧悬浮完整状态图，等待/未知时在会话标题旁显示 34px 圆形头像。测试过真实的执行、等待提问、停止空闲三种会话。
- **森林耳语提示**：状态切换时右上角出现一条短提示——等待时「小黑在等你回应」，继续执行时「收到 · 继续巡林」，本轮结束时「本轮结束 · 小黑收工」，失联时「与小黑失去联系」。`idle` 只写“本轮结束”，不冒充任务成功。
- **悬浮站位**：完整小黑绝对定位在输入栏右侧、状态行右端；输入卡片与轮数/步数/token/上下文状态仍一起贴底。实测 `composerStack` 从 251px 回到 128px，`dock` 从 149px 回到 26px。
- **眼睛跟随**：仅当前页面可见/前台时，悬浮版小黑的瞳孔跟随鼠标方向偏移（最大约 3px）；失焦或切到后台回中。`unknown` 和标题小头像保持静态；没有头部/身体追踪。
- **按钮微动效**：主题激活时按钮有 hover 上浮、按下回弹、苔玉色 focus 环和更平滑的状态过渡；等待态小头像有低频琥珀呼吸。
- **范围限制**：耳语提示跟随当前打开的会话，不是全局通知中心；没有声音/系统通知，也没有接管 DSH 的审批、停止或发送按钮——这些仍由 DSH 原生逻辑处理。所有动效遵守 `prefers-reduced-motion`。
- **菜单覆盖**：小黑·森林主题为 DSH 界面菜单补充森林色背景及图标颜色，包括左下角的设置、意见反馈和登录菜单；菜单操作仍由 DSH 处理。

## 资源结构

```
assets/visuals.json                    # 六套主题与 token
assets/xiaohei-forest/background.webp      # macOS/默认
assets/xiaohei-forest/background-win.webp  # Windows 备用提亮版
assets/xiaohei-forest/{working,waiting,idle,unknown}.webp
assets/xiaohei-forest/{working,waiting,idle}-gaze.webp  # 去瞳跟随版
assets/xiaohei-forest/来源与授权.md
lib/index.js                           # 资源服务、主题归一化
lib/client.js                          # 切换、token 覆盖、角色状态、界面叠层
docs/                                  # 视觉设定、验证记录、截图
test/                                  # 资源路由与客户端映射测试
```

主题 token 用 `ctx.theme.overrideTokens()` 叠加，而不是注册持久主题 id：DSH 内置外观设置重新采纳 `light/dark/system` 时，第三方主题 id 可能被重置；token 叠加层能稳定保留。切回默认界面时撤销叠加层，并尽量恢复原主题偏好。

## 安装

仓库（public）：<https://github.com/anki7peng-png/dsh-lxhzj-skins>

- **DSH 插件页**：「插件」→「添加插件」→ 输入下面的 GitHub 地址或 pnpm GitHub spec → 重启 DSH → 在「罗小黑系列皮肤」中选择主题。
  - `https://github.com/anki7peng-png/dsh-lxhzj-skins`
  - `github:anki7peng-png/dsh-lxhzj-skins`
  - 只输入 `dsh-lxhzj-skins` 会被当作 npm 包名，不会去 GitHub 查找；当前没有发布到 npm，会安装失败。
- **Windows**：见 [`docs/Windows安装.md`](docs/Windows安装.md)（public 仓库，不需要 `gh auth login`）。
- **本地开发**：`npm install && npm test`。
- 仓库已设为 public，内含官方角色裁切与影视帧派生素材；公开仅用于项目所有者跨设备试用与备份，不构成对第三方的商用/再分发授权。

## 切换与状态

- 选择保存在 DSH 插件配置中，刷新/重启后恢复。
- 状态映射：`pendingInteraction` → `waiting`；`running === true` → `working`；`running === false` → `idle`；缺失 → `unknown`。
- `waiting` 只表示有待处理交互；`idle` 只表示没有运行，不代表任务成功。
- 等待交互时输入框会被提问/审批面板接管，因此额外用标题旁小头像承接 `waiting` / `unknown`；完整状态图在输入栏右侧呈现。

## 验证

在本机 macOS、DSH 0.2.2-rc.1 CLI 的隔离 Web profile（local path 安装）已完成：

- `npm test`：7/7 通过。
- 插件详情页：1/6 可用，背景缩略图、四态缩略图、主题卡正常。
- 主题切换：立即应用背景/token/氛围层；切回默认界面恢复。
- 重启恢复：重启进程后主题、背景与 token 覆盖仍恢复；角色状态图在会话中按当前状态重新映射。
- 真实会话：`working`（标题「小黑 · 巡林」）、`waiting`（标题旁琥珀头像 + 提问面板）、`idle`（「小黑 · 小憩」）均已实测；`unknown` 由单元测试覆盖。
- 状态提示实测：`waiting` 出现「小黑在等你回应」，`working → idle` 出现「本轮结束 · 小黑收工」；按钮 hover/press/focus 样式与 `prefers-reduced-motion` 已加入，`npm test` 里对提示与按钮 CSS 有断言。
- 布局实测：悬浮小黑不参与 composer 高度；输入卡片 98px、dock 26px、`composerStack` 128px，输入栏和状态行保持贴底。
- 眼睛跟随实测：`pointermove` 后瞳孔 `--gaze-x/--gaze-y` 偏移；`blur` / `visibilitychange` 回中。gaze 资源由资源服务和单元测试覆盖。
- Windows 背景根因：W8 诊断面板定位到桌面壳 `.mP3x-q_frame` 的 `rgba(5, 14, 10, 0.86)` 填充；0.1.9 在 Windows 下将该 frame 透明化，基础 `background.webp` 直接显示，macOS 路径不变。
- 账号菜单：小黑·森林主题为 DSH 账号菜单补充森林色表面和图标色；菜单操作仍由 DSH 处理。

截图：[欢迎页](docs/screenshots/01-欢迎页.jpg) · [主题选择](docs/screenshots/02-主题选择.jpg) · [执行态](docs/screenshots/03-执行态.jpg) · [等待态](docs/screenshots/04-等待态.jpg) · [空闲态](docs/screenshots/05-空闲态.jpg) · [等待提示](docs/screenshots/06-状态提示-等待.jpg) · [收工提示](docs/screenshots/07-状态提示-收工.jpg) · [眼睛跟随](docs/screenshots/08-眼睛跟随.jpg)

**尚未实测**：macOS 桌面端（当前桌面 profile 未安装本插件）、Windows 桌面端、GitHub 安装后的 Windows 运行、高 DPI/多显示器。GitHub public 安装在 macOS 隔离 Web 已验证（0.1.9）。详见 [`docs/验证记录.md`](docs/验证记录.md)。

## 素材来源与限制

按项目所有者确认，本皮肤为**完全自用**：背景直接使用第 41 集影视帧（裁切、去源内水印、调色），角色本体直接使用官方原形设定图裁切，状态道具/雾化为后加。公开可见不代表授权第三方商用或再分发；不商用、不冒充官方。角色与作品版权归 MTJJ 木头 / 寒木春华 / 版权方。旧壁纸、角色设定和影视帧原件均保持原文件与来源。

Windows 背景踩坑与定位方法见 [`docs/Windows踩坑.md`](docs/Windows踩坑.md)。

来源与授权详见 [`assets/xiaohei-forest/来源与授权.md`](assets/xiaohei-forest/来源与授权.md) 和上级目录 `素材/来源与版权说明.md`。代码分层参考 [dsh-deep-whale](https://github.com/Small-tailqwq/dsh-deep-whale)，MIT 许可见 `THIRD_PARTY_NOTICES.md`。
