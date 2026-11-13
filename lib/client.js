window.__ModuleLoader__.load({
  id: 'dsh-luoxiaohei-skins',
  factory(require) {
    const React = require('react')
    const BASE = '/skin-assets/luoxiaohei/'
    const ENTRY = 'luoxiaohei-skins'
    const BODY_ATTR = 'data-dsh-luoxiaohei-skin'
    const PLATFORM_ATTR = 'data-dsh-luoxiaohei-platform'
    const STATE_LABEL = { working: '巡林', waiting: '等待', idle: '小憩', unknown: '雾中' }
    const empty = { themes: [], selected: 'default', active: null, status: 'loading', writable: false, writing: false, error: '' }
    let state = empty
    const listeners = new Set()
    const subscribe = listener => { listeners.add(listener); return () => listeners.delete(listener) }
    const publish = changes => { state = { ...state, ...changes }; for (const listener of listeners) listener() }
    function isWindowsClient() {
      if (typeof navigator === 'undefined') return false
      const ua = navigator.userAgent || ''
      const dataPlatform = navigator.userAgentData?.platform || ''
      const legacyPlatform = navigator.platform || ''
      return /Windows|Win32|Win64/i.test(ua) || /Windows/i.test(dataPlatform) || /^Win/i.test(legacyPlatform)
    }

    const WHISPER = {
      waiting: '小黑在等你回应',
      working: '收到 · 继续巡林',
      idle: '本轮结束 · 小黑收工',
      unknown: '与小黑失去联系'
    }
    function whisperFor(previous, next) {
      if (previous === 'waiting' && next === 'working') return WHISPER.working
      if (previous === 'waiting' && next === 'idle') return '等待结束 · 小黑收工'
      if (previous === 'waiting' && next === 'unknown') return WHISPER.unknown
      if (next === 'waiting') return WHISPER.waiting
      if (previous === 'idle' && next === 'working') return '小黑出发巡林'
      if (previous === 'working' && next === 'idle') return WHISPER.idle
      if (next === 'unknown') return WHISPER.unknown
      return ''
    }
    function showWhisper(phase, text, timers) {
      if (typeof document === 'undefined' || !document.body || typeof document.body.append !== 'function' || !text) return
      for (const timer of timers.current) clearTimeout(timer)
      timers.current = []
      document.querySelectorAll('.luoxiaohei-whisper').forEach(node => node.remove())
      const node = document.createElement('div')
      node.className = `luoxiaohei-whisper luoxiaohei-whisper--${phase}`
      node.setAttribute('role', 'status')
      node.setAttribute('aria-live', 'polite')
      node.textContent = text
      document.body.append(node)
      const raf = typeof requestAnimationFrame === 'function' ? requestAnimationFrame : (fn => setTimeout(fn, 16))
      raf(() => node.classList.add('is-visible'))
      timers.current.push(setTimeout(() => {
        node.classList.remove('is-visible')
        timers.current.push(setTimeout(() => node.remove(), 320))
      }, 3600))
    }

    function Character({ sessionId, useSessionStatus, compact = false }) {
      const { active } = React.useSyncExternalStore(subscribe, () => state, () => empty)
      const phaseRef = React.useRef(null)
      const sessionRef = React.useRef(sessionId)
      const faceRef = React.useRef(null)
      const timers = React.useRef([])
      if (typeof useSessionStatus !== 'function') return null
      const status = useSessionStatus(states => states.get(sessionId))
      const phase = status?.pendingInteraction ? 'waiting' : status?.running === true ? 'working' : status?.running === false ? 'idle' : 'unknown'
      const gazeName = !compact && phase !== 'unknown' ? active?.gaze?.[phase] ?? null : null
      const useGaze = Boolean(gazeName)
      React.useEffect(() => {
        if (!compact || !active) return undefined
        if (sessionRef.current !== sessionId) {
          sessionRef.current = sessionId
          phaseRef.current = phase
          return undefined
        }
        const previous = phaseRef.current
        phaseRef.current = phase
        if (previous === null || previous === phase) return undefined
        showWhisper(phase, whisperFor(previous, phase), timers)
        return undefined
      }, [phase, compact, active?.id, sessionId])
      React.useEffect(() => () => {
        for (const timer of timers.current) clearTimeout(timer)
        timers.current = []
        document.querySelectorAll?.('.luoxiaohei-whisper').forEach(node => node.remove())
      }, [])
      React.useEffect(() => {
        if (compact || !active || !useGaze) return undefined
        const node = faceRef.current
        if (!node) return undefined
        let frame = 0
        let last = null
        const reset = () => {
          node.style.setProperty('--gaze-x', '0px')
          node.style.setProperty('--gaze-y', '0px')
        }
        const apply = () => {
          frame = 0
          if (!last) return
          const rect = node.getBoundingClientRect()
          if (!rect.width) return
          const cx = rect.left + rect.width * 0.4665
          const cy = rect.top + rect.height * 0.559
          const dx = last.clientX - cx
          const dy = last.clientY - cy
          const distance = Math.hypot(dx, dy) || 1
          const max = Math.min(3.2, rect.width * 0.028)
          const strength = Math.min(1, distance / 140)
          node.style.setProperty('--gaze-x', `${(dx / distance * max * strength).toFixed(2)}px`)
          node.style.setProperty('--gaze-y', `${(dy / distance * max * strength).toFixed(2)}px`)
        }
        const onMove = event => {
          if (document.visibilityState !== 'visible') return
          last = event
          if (!frame) frame = requestAnimationFrame(apply)
        }
        const onBlur = () => { last = null; reset() }
        const onVisibility = () => { if (document.visibilityState !== 'visible') onBlur() }
        window.addEventListener('pointermove', onMove, { passive: true })
        window.addEventListener('blur', onBlur)
        document.addEventListener('visibilitychange', onVisibility)
        reset()
        return () => {
          if (frame) cancelAnimationFrame(frame)
          window.removeEventListener('pointermove', onMove)
          window.removeEventListener('blur', onBlur)
          document.removeEventListener('visibilitychange', onVisibility)
          reset()
        }
      }, [compact, active?.id, phase, useGaze])
      const name = gazeName ?? active?.character[phase] ?? active?.character.unknown
      if (!name) return null
      if (compact && phase !== 'waiting' && phase !== 'unknown') return null
      const label = `${STATE_LABEL[phase] ?? '雾中'}${!compact && isWindowsClient() ? ' · W9' : ''}`
      const image = React.createElement('img', {
        src: `${BASE}${active.id}/${name}`, alt: '', 'aria-hidden': true, draggable: false,
        onError: event => {
          const root = event.currentTarget.closest?.('.luoxiaohei-character')
          if (root) root.hidden = true
        }
      })
      const pupils = useGaze
        ? [
            React.createElement('span', { key: 'left', className: 'luoxiaohei-pupil luoxiaohei-pupil--left' }),
            React.createElement('span', { key: 'right', className: 'luoxiaohei-pupil luoxiaohei-pupil--right' })
          ]
        : null
      const face = React.createElement('span', { className: 'luoxiaohei-face', ref: faceRef }, image, pupils)
      return React.createElement('figure', {
        key: `${active.id}/${name}`,
        className: compact ? 'luoxiaohei-character luoxiaohei-character--compact' : 'luoxiaohei-character luoxiaohei-character--dock',
        'data-luoxiaohei-character': phase,
        'data-luoxiaohei-state': phase,
        'data-luoxiaohei-compact': compact ? '' : undefined,
        title: `小黑 · ${label}`,
        'aria-label': `小黑：${label}`
      },
      face,
      compact ? null : React.createElement('figcaption', { className: 'luoxiaohei-character-caption' }, `小黑 · ${label}`))
    }

    const MiniCharacter = props => React.createElement(Character, { ...props, compact: true })

    function characterCss() {
      return `
.luoxiaohei-character {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
  width: 128px;
  margin: 0;
  padding: 2px 0 0;
  pointer-events: none;
  filter: drop-shadow(0 8px 18px rgba(0, 0, 0, 0.45));
}
.luoxiaohei-character::before {
  content: "";
  position: absolute;
  left: 50%;
  top: 45%;
  width: 138px;
  height: 138px;
  transform: translate(-50%, -50%);
  border-radius: 50%;
  background: radial-gradient(circle, rgba(111, 224, 164, 0.16) 0%, rgba(111, 224, 164, 0.05) 46%, transparent 70%);
  filter: blur(2px);
  z-index: 0;
}
.luoxiaohei-face {
  position: relative;
  z-index: 1;
  display: block;
  width: var(--luoxiaohei-character-width, 118px);
  max-width: 100%;
  animation: luoxiaohei-float 6.5s ease-in-out infinite;
  transition: opacity 240ms ease;
}
.luoxiaohei-face img {
  display: block;
  width: 100%;
  height: auto;
  user-select: none;
  -webkit-user-drag: none;
}
.luoxiaohei-character[data-luoxiaohei-state="working"] .luoxiaohei-face { animation: luoxiaohei-work 3.8s ease-in-out infinite; }
.luoxiaohei-character[data-luoxiaohei-state="waiting"] .luoxiaohei-face { animation: luoxiaohei-wait 3.4s ease-in-out infinite; }
.luoxiaohei-character[data-luoxiaohei-state="idle"] .luoxiaohei-face { animation: luoxiaohei-breathe 7.5s ease-in-out infinite; }
.luoxiaohei-character[data-luoxiaohei-state="unknown"] .luoxiaohei-face { opacity: 0.82; animation: luoxiaohei-fade 8s ease-in-out infinite; }
.luoxiaohei-pupil {
  position: absolute;
  z-index: 2;
  width: 10%;
  aspect-ratio: 0.62;
  border-radius: 50%;
  background: #0b0c0c;
  box-shadow: inset 0 0 0 1px rgba(60, 42, 28, 0.24), inset -2px -2px 4px rgba(255, 255, 255, 0.05);
  transform: translate(-50%, -50%) translate(var(--gaze-x, 0px), var(--gaze-y, 0px));
  transition: transform 90ms linear;
  pointer-events: none;
}
.luoxiaohei-pupil::after {
  content: "";
  position: absolute;
  left: 20%;
  top: 13%;
  width: 28%;
  height: 20%;
  border-radius: 50%;
  background: #fff;
  opacity: 0.88;
}
.luoxiaohei-pupil--left { left: 34.08%; top: 55.91%; }
.luoxiaohei-pupil--right { left: 59.25%; top: 55.91%; }
.luoxiaohei-character-caption {
  position: relative;
  z-index: 1;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  max-width: 100%;
  color: rgba(224, 243, 230, 0.78);
  font-size: 10px;
  line-height: 1.25;
  letter-spacing: 0.14em;
  white-space: nowrap;
  text-shadow: 0 1px 7px rgba(0, 0, 0, 0.9);
}
.luoxiaohei-character-caption::before {
  content: "";
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--dsw-alias-brand-primary, #93e7b3);
  box-shadow: 0 0 8px rgba(147, 231, 179, 0.75);
}
.luoxiaohei-character[data-luoxiaohei-state="waiting"] .luoxiaohei-character-caption::before {
  background: #e8c27c;
  box-shadow: 0 0 8px rgba(232, 194, 124, 0.8);
}
.luoxiaohei-character[data-luoxiaohei-state="unknown"] .luoxiaohei-character-caption { color: rgba(190, 210, 198, 0.58); }
.luoxiaohei-character[data-luoxiaohei-state="unknown"] .luoxiaohei-character-caption::before {
  background: #8fa99a;
  box-shadow: none;
}
.luoxiaohei-character--compact {
  width: 34px;
  height: 34px;
  padding: 0;
  border-radius: 50%;
  overflow: hidden;
  background: rgba(4, 14, 10, 0.62);
  box-shadow: 0 0 0 1px rgba(168, 226, 188, 0.20), 0 0 14px rgba(111, 224, 164, 0.12);
}
.luoxiaohei-character--compact::before { width: 42px; height: 42px; top: 50%; }
.luoxiaohei-character--compact .luoxiaohei-face {
  width: 34px;
  height: 34px;
  animation: none;
}
.luoxiaohei-character--compact .luoxiaohei-face img {
  width: 34px;
  height: 34px;
  object-fit: cover;
  object-position: 50% 22%;
}
.luoxiaohei-character--compact .luoxiaohei-character-caption { display: none; }
body[data-dsh-luoxiaohei-skin] .luoxiaohei-character--dock {
  position: absolute;
  right: 10px;
  bottom: 0;
  width: 128px;
  z-index: 2;
}
body[data-dsh-luoxiaohei-skin] [class*="_composerStack"],
body[data-dsh-luoxiaohei-skin] .uV2eYG_root {
  position: relative;
}
@media (max-width: 1180px) {
  body[data-dsh-luoxiaohei-skin] .luoxiaohei-character--dock { right: 0; transform: scale(0.88); transform-origin: bottom right; }
}
@media (max-width: 1040px) {
  body[data-dsh-luoxiaohei-skin] .luoxiaohei-character--dock { display: none; }
}
.luoxiaohei-character--compact[data-luoxiaohei-state="waiting"] {
  box-shadow: 0 0 0 1px rgba(232, 194, 124, 0.55), 0 0 16px rgba(232, 194, 124, 0.25);
}
.luoxiaohei-character--compact[data-luoxiaohei-state="waiting"] {
  animation: luoxiaohei-alert 2.4s ease-in-out infinite;
}
.luoxiaohei-whisper {
  position: fixed;
  top: 64px;
  right: 24px;
  z-index: 2147483000;
  max-width: min(320px, calc(100vw - 48px));
  padding: 9px 15px;
  border-radius: 999px;
  border: 1px solid rgba(168, 226, 188, 0.24);
  background: rgba(5, 16, 10, 0.92);
  box-shadow: 0 12px 34px rgba(0, 0, 0, 0.42);
  color: #e8f5ea;
  font-size: 12px;
  line-height: 1.35;
  letter-spacing: 0.06em;
  pointer-events: none;
  opacity: 0;
  transform: translateY(-7px);
  transition: opacity 220ms ease, transform 220ms ease;
  backdrop-filter: blur(12px);
}
.luoxiaohei-whisper.is-visible { opacity: 1; transform: translateY(0); }
.luoxiaohei-whisper--waiting { border-color: rgba(232, 194, 124, 0.48); color: #fff2d2; }
.luoxiaohei-whisper--unknown { border-color: rgba(143, 169, 154, 0.35); color: #c5d4c9; }
.luoxiaohei-whisper--idle { border-color: rgba(147, 231, 179, 0.36); }
@keyframes luoxiaohei-alert {
  0%, 100% { box-shadow: 0 0 0 1px rgba(232, 194, 124, 0.48), 0 0 10px rgba(232, 194, 124, 0.18); }
  50% { box-shadow: 0 0 0 3px rgba(232, 194, 124, 0.12), 0 0 20px rgba(232, 194, 124, 0.34); }
}@keyframes luoxiaohei-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
@keyframes luoxiaohei-work { 0%, 100% { transform: translateY(0) rotate(0deg); } 35% { transform: translateY(-3px) rotate(-1deg); } 70% { transform: translateY(-1px) rotate(0.6deg); } }
@keyframes luoxiaohei-wait { 0%, 100% { transform: translateY(0) rotate(-1deg); } 50% { transform: translateY(-3px) rotate(1.5deg); } }
@keyframes luoxiaohei-breathe { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.015); } }
@keyframes luoxiaohei-fade { 0%, 100% { opacity: 0.72; } 50% { opacity: 0.9; } }
@media (prefers-reduced-motion: reduce) {
  .luoxiaohei-character .luoxiaohei-face { animation: none !important; }
  .luoxiaohei-pupil { transition: none !important; }
  .luoxiaohei-character--compact[data-luoxiaohei-state="waiting"] { animation: none !important; }
  .luoxiaohei-whisper { transition: none !important; }
}
`
    }

    function skinCss(skin) {
      const id = skin.id
      const attr = `${BODY_ATTR}="${id}"`
      const accent = skin.accent ?? '#93e7b3'
      const background = skin.background
        ? `body[${attr}] {
  background-color: #04100b;
  background-image: linear-gradient(180deg, rgba(2, 8, 5, 0.20) 0%, rgba(2, 8, 5, 0.06) 42%, rgba(2, 8, 5, 0.42) 100%), url("${BASE}${id}/${skin.background}");
  background-position: center, center;
  background-size: cover, cover;
  background-repeat: no-repeat, no-repeat;
  background-attachment: fixed, fixed;
}`
        : `body[${attr}] { background-color: #04100b; }`
      const forest = id === 'xiaohei-forest'
        ? `
body[${attr}]::before {
  content: "";
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  background:
    linear-gradient(180deg, rgba(1, 6, 4, 0.04) 0%, rgba(1, 6, 4, 0.08) 45%, rgba(1, 6, 4, 0.36) 100%),
    linear-gradient(90deg, rgba(1, 6, 4, 0.58) 0%, rgba(1, 6, 4, 0.24) 36%, rgba(1, 6, 4, 0.18) 64%, rgba(1, 6, 4, 0.44) 100%);
  box-shadow: inset 0 0 220px rgba(0, 0, 0, 0.55);
  animation: luoxiaohei-atmosphere 24s ease-in-out infinite alternate;
}
body[${attr}]::after {
  content: "";
  position: fixed;
  inset: 10px;
  z-index: 2147483000;
  pointer-events: none;
  border: 1px solid rgba(168, 226, 188, 0.14);
  border-radius: 12px;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.78' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='180' height='180' filter='url(%23n)' opacity='.28'/%3E%3C/svg%3E");
  background-size: 180px 180px;
  opacity: 0.42;
  mix-blend-mode: soft-light;
}
body[${attr}] #root { position: relative; z-index: 1; }
body[${attr}] ::selection { background: rgba(147, 231, 179, 0.28); color: #f4fff5; }
body[${attr}] button:not(:disabled), body[${attr}] [role="button"] {
  transition: transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease, background-color 160ms ease;
}
body[${attr}] button:not(:disabled):hover { transform: translateY(-1px); }
body[${attr}] button:not(:disabled):active { transform: translateY(0) scale(0.985); }
body[${attr}] button:focus-visible { outline: 2px solid rgba(147, 231, 179, 0.60); outline-offset: 2px; }
@media (prefers-reduced-motion: reduce) {
  body[${attr}] button:not(:disabled), body[${attr}] [role="button"] { transition: none !important; }
  body[${attr}] button:not(:disabled):hover, body[${attr}] button:not(:disabled):active { transform: none !important; }
}
@keyframes luoxiaohei-atmosphere { from { opacity: 0.82; } to { opacity: 1; } }
@media (prefers-reduced-motion: reduce) { body[${attr}]::before { animation: none; } }
`
        : ''
      const menu = `
body[${attr}] [role="menu"][data-menu-material="translucent"] {
  /* Direct values: --dsw-menu-surface-fill and --dsw-specific-menu reference
     each other in DSH's dark tokens, so a var() chain here can become cyclic. */
  --dsw-menu-surface-fill: rgba(9, 21, 15, 0.96);
  --dsw-specific-menu: rgba(9, 21, 15, 0.96);
  --dsw-alias-menu-group-header-fill: rgba(7, 19, 13, 0.98);
  --dsw-alias-menu-icon: #dbe9dd;
}
`
      const surfaces = `
body[${attr}] li[data-plugin-item],
body[${attr}] li[data-plugin-package] {
  background: linear-gradient(145deg, #09160f, #050e0a) !important;
  border: 0 !important;
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.32), inset 0 0 0 1px rgba(168, 226, 188, 0.16), inset 0 1px 0 rgba(255, 255, 255, 0.055) !important;
  backdrop-filter: blur(9px) saturate(1.04);
}
body[${attr}] li[data-plugin-item]:hover,
body[${attr}] li[data-plugin-package]:hover {
  background: linear-gradient(145deg, #0e2016, #07120c) !important;
  box-shadow: 0 14px 30px rgba(0, 0, 0, 0.38), inset 0 0 0 1px rgba(147, 231, 179, 0.32), inset 0 1px 0 rgba(255, 255, 255, 0.07) !important;
}
body[${attr}] [data-shortcut-modal="settings"] {
  background: linear-gradient(180deg, rgba(16, 22, 20, 0.95), rgba(7, 12, 10, 0.97)) !important;
  border: 1px solid rgba(210, 226, 214, 0.14) !important;
  box-shadow: 0 28px 80px rgba(0, 0, 0, 0.55), inset 0 1px 0 rgba(255, 255, 255, 0.06) !important;
  filter: saturate(0.78) contrast(1.02);
}
`
      const windows = skin.background
        ? `
body[${PLATFORM_ATTR}="win32"][${attr}] .mP3x-q_frame {
  background: transparent !important;
}
`
        : ''
      return `${background}\nbody[${attr}] { --luoxiaohei-accent: ${accent}; }\n${forest}\n${windows}\n${menu}\n${surfaces}\n${characterCss()}`
    }

    return {
      inject: ['slots', 'theme', 'configForms'],
      apply(ctx) {
        const form = ctx.configForms.get(ENTRY)
        let catalog = []
        let loaded = false
        let disposed = false
        let disposeSkin = () => {}
        let activeId = null
        const abort = new AbortController()

        function changeActive(skin) {
          if ((skin?.id ?? null) === activeId) return
          disposeSkin()
          disposeSkin = () => {}
          activeId = skin?.id ?? null
          if (!skin) return

          const body = document.body
          const hadAttribute = body.hasAttribute(BODY_ATTR)
          const previousAttribute = body.getAttribute(BODY_ATTR)
          let disposeTokens
          let previousTheme
          let scheme
          let style
          const windowsClient = isWindowsClient()
          body.setAttribute(BODY_ATTR, skin.id)
          if (windowsClient) body.setAttribute(PLATFORM_ATTR, 'win32')
          else body.removeAttribute(PLATFORM_ATTR)
          if (skin.theme) {
            previousTheme = ctx.theme.getTheme().preference
            scheme = skin.theme.colorScheme
            try {
              if (ctx.theme.getTheme().preference !== scheme) ctx.theme.setTheme(scheme)
            } catch (error) {
              console.warn('[luoxiaohei-skins] Unable to select the base colour scheme.', error?.message)
            }
            try {
              // Third-party themes are a token overlay: overrideTokens survives
              // the host settings adoption that can reset a registered theme id.
              const tokens = Object.fromEntries(Object.entries(skin.theme.tokens).map(([name, value]) => [name, { light: value, dark: value }]))
              disposeTokens = ctx.theme.overrideTokens(`luoxiaohei-skins:${skin.id}`, tokens)
            } catch (error) {
              console.warn('[luoxiaohei-skins] Unable to apply theme tokens.', error?.message)
            }
          }
          style = document.createElement('style')
          style.setAttribute('data-luoxiaohei-ui', skin.id)
          style.textContent = skinCss(skin)
          document.head.append(style)
          disposeSkin = () => {
            style?.remove()
            document.querySelectorAll?.('.luoxiaohei-whisper').forEach(node => node.remove())
            disposeTokens?.()
            if (previousTheme && scheme && ctx.theme.getTheme().preference === scheme && previousTheme !== scheme) {
              try { ctx.theme.setTheme(previousTheme) } catch { ctx.theme.setTheme('system') }
            }
            if (hadAttribute) body.setAttribute(BODY_ATTR, previousAttribute ?? '')
            else body.removeAttribute(BODY_ATTR)
            body.removeAttribute(PLATFORM_ATTR)
          }
        }

        function sync() {
          if (disposed) return
          const formState = form.getSnapshot()
          const selected = formState.value?.selectedSkin ?? 'default'
          const active = loaded && formState.status === 'ready'
            ? catalog.find(skin => skin.id === selected && skin.available) ?? null : null
          changeActive(active)
          publish({ themes: catalog, selected, active, status: loaded ? formState.status : 'loading', writable: formState.writable })
        }

        async function choose(id) {
          if (state.writing || state.status !== 'ready' || !state.writable || (id !== 'default' && !catalog.some(skin => skin.id === id && skin.available))) return
          publish({ writing: true, error: '' })
          try {
            if (!await form.set('selectedSkin', id)) publish({ error: '保存失败，请重试。' })
          } catch {
            publish({ error: '保存失败，请检查 DSH 配置后重试。' })
          } finally {
            if (!disposed) { publish({ writing: false }); sync() }
          }
        }

        function SkinSelector() {
          const current = React.useSyncExternalStore(subscribe, () => state, () => empty)
          const disabled = current.status !== 'ready' || !current.writable || current.writing
          const options = [{ id: 'default', name: 'DSH 默认界面', tagline: '原始主题与布局', available: true }, ...current.themes]
          const ready = current.themes.filter(theme => theme.available).length
          return React.createElement('section', { 'aria-label': '罗小黑系列皮肤', style: { padding: '16px 0' } },
            React.createElement('h3', { style: { margin: '0 0 8px' } }, `罗小黑系列皮肤${current.themes.length ? ` · ${ready}/${current.themes.length} 可用` : ''}`),
            React.createElement('p', { style: { margin: '0 0 12px', opacity: 0.75 } }, '选择一个主题；标记为素材待制作的主题暂不可用。切换后会立即应用背景、配色与角色状态图。'),
            current.status === 'loading' ? React.createElement('p', null, '正在加载皮肤配置…') : null,
            current.status === 'unavailable' ? React.createElement('p', { role: 'alert' }, '皮肤配置暂不可用。') : null,
            current.error ? React.createElement('p', { role: 'alert' }, current.error) : null,
            React.createElement('div', { role: 'radiogroup', 'aria-label': '选择皮肤', style: { display: 'grid', gap: '10px' } },
              ...options.map(option => {
                const selected = current.selected === option.id
                const available = option.available
                const characters = Object.entries(option.character ?? {}).filter(([, file]) => file)
                const thumb = option.background ? `${BASE}${option.id}/${option.background}` : null
                return React.createElement('button', {
                  key: option.id, type: 'button', role: 'radio', 'aria-checked': selected,
                  'aria-label': `${option.name}${available ? '' : '，素材待制作'}`,
                  disabled: disabled || !available, onClick: () => { void choose(option.id) },
                  style: {
                    textAlign: 'left', padding: '10px 12px', borderRadius: '10px', color: 'inherit',
                    border: `1px solid ${selected ? 'var(--dsw-alias-brand-primary, #93e7b3)' : 'var(--dsw-alias-border-l2, #888)'}`,
                    background: selected ? 'linear-gradient(90deg, rgba(147, 231, 179, 0.10), rgba(147, 231, 179, 0.02))' : 'transparent',
                    cursor: disabled || !available ? 'default' : 'pointer', opacity: available ? 1 : 0.55,
                    display: 'grid', gridTemplateColumns: thumb ? '96px 1fr' : '1fr', gap: '12px', alignItems: 'center'
                  }
                },
                thumb ? React.createElement('span', {
                  'aria-hidden': true,
                  style: {
                    display: 'block', width: '96px', height: '62px', borderRadius: '7px',
                    border: '1px solid var(--dsw-alias-border-l2, #888)',
                    backgroundImage: `linear-gradient(180deg, rgba(2, 8, 5, 0.05), rgba(2, 8, 5, 0.35)), url("${thumb}")`,
                    backgroundPosition: 'center', backgroundSize: 'cover', backgroundColor: '#06120d'
                  }
                }) : null,
                React.createElement('span', { style: { minWidth: 0 } },
                  React.createElement('span', { style: { display: 'flex', alignItems: 'baseline', gap: '8px', flexWrap: 'wrap' } },
                    React.createElement('span', { style: { fontSize: '14px', fontWeight: 500 } }, `${selected ? '● ' : '○ '}${option.name}`),
                    option.tagline ? React.createElement('span', { style: { fontSize: '12px', opacity: 0.66 } }, option.tagline) : null),
                  characters.length ? React.createElement('span', { style: { display: 'flex', gap: '5px', marginTop: '7px', height: '44px' } },
                    ...characters.map(([phase, file]) => React.createElement('span', {
                      key: phase,
                      style: {
                        display: 'block', width: '44px', height: '44px', borderRadius: '50%', overflow: 'hidden',
                        background: 'rgba(3, 12, 8, 0.70)',
                        boxShadow: '0 0 0 1px rgba(168, 226, 188, 0.18), 0 2px 8px rgba(0, 0, 0, 0.35)'
                      }
                    }, React.createElement('img', {
                      src: `${BASE}${option.id}/${file}`, alt: STATE_LABEL[phase] ?? phase,
                      title: STATE_LABEL[phase] ?? phase, loading: 'lazy',
                      style: {
                        display: 'block', width: '100%', height: '100%', objectFit: 'cover',
                        objectPosition: '50% 30%', transform: 'scale(1.55)', transformOrigin: '50% 30%'
                      }
                    })))) : null,
                  !available ? React.createElement('span', { style: { display: 'block', marginTop: '5px', fontSize: '12px', opacity: 0.8 } }, '素材待制作') : null))
              }))
          )
        }

        ctx.slots.inject('conversation.composer.dock', () => ctx.slots.register({
          name: 'conversation.composer.dock', id: 'luoxiaohei-skins-character', order: 100
        }, Character))
        ctx.slots.inject('conversation.session.header.actions', () => ctx.slots.register({
          name: 'conversation.session.header.actions', id: 'luoxiaohei-skins-compact-character', order: 40
        }, MiniCharacter))
        ctx.effect(() => ctx.configForms.whileServed([ENTRY], () => ctx.slots.inject('plugins.bundle.config', () => ctx.slots.register({
          name: 'plugins.bundle.config', key: 'dsh-luoxiaohei-skins'
        }, SkinSelector))), 'luoxiaohei-skins: selector')
        ctx.effect(() => {
          const unsubscribe = form.subscribe(sync)
          sync()
          fetch(BASE + 'visuals.json', { signal: abort.signal, credentials: 'same-origin' })
            .then(response => { if (!response.ok) throw new Error(`skin assets: ${response.status}`); return response.json() })
            .then(data => {
              if (disposed) return
              catalog = data.themes
              loaded = true
              sync()
            })
            .catch(error => {
              if (disposed || error.name === 'AbortError') return
              loaded = true
              publish({ error: '皮肤素材清单加载失败。' })
              sync()
            })
          return () => {
            disposed = true
            abort.abort()
            unsubscribe()
            disposeSkin()
            state = empty
            for (const listener of listeners) listener()
          }
        }, 'luoxiaohei-skins: visual lifecycle')
      }
    }
  }
})
