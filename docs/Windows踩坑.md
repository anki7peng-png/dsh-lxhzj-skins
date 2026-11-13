# Windows 背景变暗踩坑记录

记录于 DSH 0.2.2 / 小黑·森林皮肤 0.1.9。

## 症状

- macOS 上背景正常，Windows 桌面端整套界面明显发黑；
- 小黑角色、白色文字仍然正常亮，只有背景像被压到约 10%；
- 在皮肤里加亮背景图、降低遮罩、加 `mix-blend-mode: screen` 提亮层都几乎无效；
- 诊断标记能显示，`body` 背景 URL 和提亮层也都存在。

## 根因

DSH Windows 桌面壳的 `.mP3x-q_frame` 有一层全屏深色填充：

```css
.mP3x-q_frame {
  background: rgba(5, 14, 10, 0.86);
}
```

它位于 `body` 背景之上、UI 内容之下，所以：

- 皮肤背景图只透出约 14%；
- 提亮层挂在 `body` 上、位于 `#root` 之下，也会被这层 frame 一起压住；
- 角色在 `#root` 里，位于 frame 之上，所以角色仍然是亮的。

这层颜色来自主题 token `--dsw-specific-sidebar-fill: rgba(5, 14, 10, 0.86)`，但直接改这个 token 会同时影响侧边栏，不应作为首选。

## 定位方法

在 Windows 上打开开发者工具，选一个**裸背景**位置（不要选输入框、消息气泡、侧边栏），执行：

```js
[...document.elementsFromPoint(innerWidth * 0.9, innerHeight * 0.2)]
  .slice(0, 8)
  .map(e => [e.tagName, String(e.className).slice(0, 60),
             getComputedStyle(e).backgroundColor,
             getComputedStyle(e).zIndex])
```

如果元素栈里出现全屏元素，且背景色是深色高 alpha，基本就是它。

也可以临时检查所有覆盖大半个视口的 `fixed` 元素：

```js
[...document.querySelectorAll('body *')]
  .filter(e => {
    const r = e.getBoundingClientRect(), s = getComputedStyle(e)
    return s.position === 'fixed' &&
      r.width >= innerWidth * 0.85 &&
      r.height >= innerHeight * 0.85 &&
      s.backgroundColor !== 'rgba(0, 0, 0, 0)'
  })
  .map(e => [e.className, getComputedStyle(e).backgroundColor])
```

本次实测命中：

```text
DIV.mP3x-q_frame  bg=rgba(5, 14, 10, 0.86)
```

## 修复

只对 Windows、且只在当前皮肤激活时，把该 frame 的背景透明化：

```css
body[data-dsh-luoxiaohei-platform="win32"][data-dsh-luoxiaohei-skin="xiaohei-forest"] .mP3x-q_frame {
  background: transparent !important;
}
```

客户端通过 `navigator.userAgent` / `navigator.userAgentData.platform` 设置 `data-dsh-luoxiaohei-platform="win32"`，macOS 不会匹配这条规则。

透明化后直接使用基础 `background.webp`；之前为补偿压暗而加的 `background-win.webp`、screen 提亮层和白色遮罩都不再需要。

## 验证

- `.mP3x-q_frame` 的计算背景变为透明；
- `body` 仍是 `background.webp`，背景在 Windows 和 macOS 上都能直接看到；
- 角色、输入框、消息卡、侧边栏仍有自己的背景，不影响可读性；
- 切回 DSH 默认界面时不残留规则。

## 经验

1. **先找遮挡层，再调亮度。** 如果提亮层完全不生效，多半是它上面有一层不透明/高 alpha 的全屏元素。
2. **不要只盯 `body` / `#root`。** DSH 的桌面壳 frame 可能是单独一层，`#root` 透明不代表没有别的全屏背景。
3. **用元素栈采样，不要采样到输入框。** 输入框卡本身是 `rgba(6,16,12,.9)`，会误导判断；要选裸背景。
4. **平台修复必须限定平台。** macOS 用原路径，Windows 才透明化 frame，避免回归。
5. **frame 类名是版本相关的。** 升级 DSH 后重新检查 `.mP3x-q_frame` 是否仍存在；如果 DSH 改成内联 `!important`，需要在运行时清 inline style。
