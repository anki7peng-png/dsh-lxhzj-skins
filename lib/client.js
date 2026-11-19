window.__ModuleLoader__.load({
  id: 'dsh-luoxiaohei-skins',
  factory(require) {
    const React = require('react')
    const BASE = '/skin-assets/luoxiaohei/'
    const ENTRY = 'luoxiaohei-skins'
    const BODY_ATTR = 'data-dsh-luoxiaohei-skin'
    const PLATFORM_ATTR = 'data-dsh-luoxiaohei-platform'
    const HERO_LOGO_SLOT = 'conversation.hero.brand.mark'
    const IDLE_CAMEO_DELAY = 10_000
    const STATE_LABEL = { working: '巡林', waiting: '等待', idle: '小憩', unknown: '雾中' }
    const empty = { themes: [], selected: 'default', active: null, status: 'loading', writable: false, writing: false, error: '', notifications: {} }
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

    const MAC_NOTIFICATION_ROUTE = '/__luoxiaohei-skins/notification'
    const NOTIFICATION_COPY = {
      completion: ['小黑 · 本轮结束', '请回到 DSH 查看结果。'],
      approval: ['小黑 · 需要审批', '请回到 DSH 查看审批请求。'],
      question: ['小黑 · 有问题需要回答', '请回到 DSH 查看问题。']
    }
    const NOTIFICATION_FIELDS = { completion: 'notifyCompletion', approval: 'notifyApproval', question: 'notifyQuestion' }

    function isMacDesktop() {
      return window.location?.protocol === 'dsh-app:' && /Macintosh|Mac OS X/i.test(typeof navigator === 'undefined' ? '' : navigator.userAgent || '')
    }

    async function macHelperAvailable() {
      if (!isMacDesktop()) return false
      try {
        const response = await fetch(MAC_NOTIFICATION_ROUTE, { credentials: 'same-origin', cache: 'no-store' })
        return response.ok && (await response.json())?.available === true
      } catch { return false }
    }

    async function notifyMac(kind) {
      const response = await fetch(MAC_NOTIFICATION_ROUTE, {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', 'x-luoxiaohei-notify': 'notify' },
        body: JSON.stringify({ kind })
      })
      const result = await response.json()
      if (!response.ok || !result.ok) throw new Error(result.reason || 'notification-failed')
    }

    function notificationError(error) {
      const reason = error?.message
      if (reason === 'not-authorized') return '系统通知未获授权，请在系统设置中允许。'
      if (reason === 'unsupported') return '当前环境不支持系统通知。'
      return '系统通知发送失败，请检查系统通知权限和助手状态。'
    }

    // The session stores are optional: a missing notification service must
    // never prevent the skin itself from loading.
    function watchNotifications(ctx, config, deliver) {
      let statusStore, listStore, faceStore, statusOff, listOff, faceOff, faceId, disposed = false
      const statusPrevious = new Map(), listPrevious = new Map(), facePrevious = new Map()
      const pendingDone = new Map(), lastDone = new Map()
      const lookup = name => {
        try { return ctx.get?.(name) || ctx.reflect?.get?.(name) || null } catch { return null }
      }
      const isStore = value => value && typeof value.getSnapshot === 'function' && typeof value.subscribe === 'function'
      const list = () => listStore?.getSnapshot?.() || {}
      const current = () => {
        const snapshot = list()
        if (snapshot.current) return snapshot.current
        return Object.keys(snapshot.byId || {}).find(id => snapshot.byId[id]?.retainedBy?.mainView > 0) || null
      }
      const muted = id => list().byId?.[id]?.origin === 'subagent' && id !== current()
      const emit = (kind, id) => {
        const settings = config()
        if (!disposed && settings.notificationsEnabled === true && settings[NOTIFICATION_FIELDS[kind]] !== false && !muted(id)) {
          void deliver(kind, id)
        }
      }
      const cancelDone = id => {
        const timer = pendingDone.get(id)
        if (timer) clearTimeout(timer)
        pendingDone.delete(id)
      }
      const queueDone = id => {
        if (pendingDone.has(id)) return
        const timer = setTimeout(() => {
          pendingDone.delete(id)
          if (disposed) return
          const status = statusStore?.getSnapshot?.()?.get?.(id)
          const row = list().byId?.[id]
          const face = id === faceId ? faceStore?.getSnapshot?.() : null
          if (status?.pendingInteraction || status?.running === true || row?.pendingInteraction || face?.pending?.length || face?.running === true) return
          if (Date.now() - (lastDone.get(id) || 0) < 250) return
          lastDone.set(id, Date.now())
          emit('completion', id)
        }, 350)
        pendingDone.set(id, timer)
      }
      const inspectStatus = () => {
        const snapshot = statusStore?.getSnapshot?.()
        if (!snapshot || typeof snapshot.forEach !== 'function') return
        const seen = new Set()
        snapshot.forEach((status, id) => {
          if (!status) return
          seen.add(id)
          const previous = statusPrevious.get(id)
          const pending = status.pendingInteraction
          const key = pending ? `${pending.kind}:${pending.key || id}` : ''
          if (pending || status.running === true) cancelDone(id)
          if (pending && key !== previous?.key && (pending.kind === 'approval' || pending.kind === 'question')) emit(pending.kind, id)
          if (!pending && previous && !previous.key && ((previous.running === true && status.running === false) || (!previous.unread && status.completionUnread))) queueDone(id)
          statusPrevious.set(id, { key, running: status.running, unread: Boolean(status.completionUnread) })
        })
        for (const id of statusPrevious.keys()) if (!seen.has(id)) { statusPrevious.delete(id); cancelDone(id) }
      }
      const inspectFace = () => {
        const snapshot = faceStore?.getSnapshot?.()
        if (!faceId || !snapshot) return
        const previous = facePrevious.get(faceId)
        if (snapshot.running === true || snapshot.pending?.length) cancelDone(faceId)
        if (previous === true && snapshot.running === false && !snapshot.pending?.length) queueDone(faceId)
        facePrevious.set(faceId, snapshot.running)
      }
      const bindFace = sessions => {
        const id = current()
        if (id === faceId && faceOff) return
        faceOff?.(); facePrevious.delete(faceId); faceOff = undefined; faceStore = undefined; faceId = id
        if (!id) return
        try { faceStore = sessions?.binding?.(id)?.session } catch { return }
        if (!isStore(faceStore)) return
        facePrevious.delete(id)
        faceOff = faceStore.subscribe(inspectFace)
        inspectFace()
      }
      const inspectList = () => {
        const snapshot = list(), selected = current(), seen = new Set()
        for (const [id, row] of Object.entries(snapshot.byId || {})) {
          if (!row) continue
          seen.add(id)
          const previous = listPrevious.get(id)
          if (row.running === true || row.pendingInteraction) cancelDone(id)
          if (id !== selected && previous === true && row.running === false && !row.pendingInteraction) queueDone(id)
          listPrevious.set(id, row.running)
        }
        for (const id of listPrevious.keys()) if (!seen.has(id)) { listPrevious.delete(id); cancelDone(id) }
        bindFace(lookup('sessions'))
      }
      const bind = () => {
        if (disposed) return
        const nextList = lookup('sessions')?.list
        if (isStore(nextList) && nextList !== listStore) {
          listOff?.(); listStore = nextList; listPrevious.clear()
          listOff = listStore.subscribe(inspectList); inspectList()
        } else if (listStore) bindFace(lookup('sessions'))
        const nextStatus = lookup('uiSession')?.sessionStatus
        if (isStore(nextStatus) && nextStatus !== statusStore) {
          statusOff?.(); statusStore = nextStatus; statusPrevious.clear()
          statusOff = statusStore.subscribe(inspectStatus); inspectStatus()
        }
      }
      bind()
      const retry = typeof window.setInterval === 'function' ? window.setInterval(bind, 1500) : null
      return () => {
        disposed = true
        if (retry !== null) window.clearInterval(retry)
        statusOff?.(); listOff?.(); faceOff?.()
        for (const id of pendingDone.keys()) cancelDone(id)
      }
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
      const figureRef = React.useRef(null)
      const cameoRef = React.useRef(null)
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
      React.useEffect(() => {
        const node = figureRef.current
        const cameo = cameoRef.current
        if (compact || !active?.heroLogo || phase !== 'idle' || !node || !cameo) return undefined
        if (typeof window === 'undefined' || typeof document === 'undefined') return undefined
        if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined
        let timer = 0
        let playing = false
        const stop = () => {
          if (timer) {
            clearTimeout(timer)
            timer = 0
          }
          if (!playing) return
          playing = false
          node.removeAttribute('data-luoxiaohei-cameo')
        }
        const arm = () => {
          stop()
          timer = setTimeout(() => {
            timer = 0
            if (document.visibilityState !== 'visible') return
            if (typeof document.hasFocus === 'function' && !document.hasFocus()) return
            if (!cameo.complete) { arm(); return }
            if (!cameo.naturalWidth || cameo.hasAttribute?.('data-luoxiaohei-cameo-error')) return
            playing = true
            node.setAttribute('data-luoxiaohei-cameo', 'true')
          }, IDLE_CAMEO_DELAY)
        }
        const onActivity = () => arm()
        const onVisibility = () => {
          if (document.visibilityState === 'visible' && (typeof document.hasFocus !== 'function' || document.hasFocus())) arm()
          else stop()
        }
        const onBlur = () => stop()
        const onFocus = () => arm()
        window.addEventListener('pointermove', onActivity, { passive: true })
        window.addEventListener('pointerdown', onActivity, { passive: true })
        window.addEventListener('wheel', onActivity, { passive: true })
        window.addEventListener('blur', onBlur)
        window.addEventListener('focus', onFocus)
        document.addEventListener('keydown', onActivity, true)
        document.addEventListener('input', onActivity, true)
        document.addEventListener('visibilitychange', onVisibility)
        arm()
        return () => {
          stop()
          window.removeEventListener('pointermove', onActivity)
          window.removeEventListener('pointerdown', onActivity)
          window.removeEventListener('wheel', onActivity)
          window.removeEventListener('blur', onBlur)
          window.removeEventListener('focus', onFocus)
          document.removeEventListener('keydown', onActivity, true)
          document.removeEventListener('input', onActivity, true)
          document.removeEventListener('visibilitychange', onVisibility)
        }
      }, [compact, active?.id, active?.heroLogo, phase])
      const name = gazeName ?? active?.character[phase] ?? active?.character.unknown
      if (!name) return null
      if (compact && phase !== 'waiting' && phase !== 'unknown') return null
      const label = STATE_LABEL[phase] ?? '雾中'
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
      const cameo = !compact && active.heroLogo
        ? React.createElement('img', {
            className: 'luoxiaohei-cameo',
            src: `${BASE}${active.id}/${active.heroLogo}`,
            alt: '',
            'aria-hidden': true,
            draggable: false,
            ref: cameoRef,
            onError: event => {
              const image = event.currentTarget
              image.setAttribute('data-luoxiaohei-cameo-error', '')
              image.closest?.('.luoxiaohei-character')?.removeAttribute('data-luoxiaohei-cameo')
            }
          })
        : null
      return React.createElement('figure', {
        key: `${active.id}/${name}`,
        ref: figureRef,
        className: compact ? 'luoxiaohei-character luoxiaohei-character--compact' : 'luoxiaohei-character luoxiaohei-character--dock',
        'data-luoxiaohei-character': phase,
        'data-luoxiaohei-state': phase,
        'data-luoxiaohei-compact': compact ? '' : undefined,
        title: `小黑 · ${label}`,
        'aria-label': `小黑：${label}`
      },
      face,
      cameo,
      compact ? null : React.createElement('figcaption', { className: 'luoxiaohei-character-caption' }, `小黑 · ${label}`))
    }

    const MiniCharacter = props => React.createElement(Character, { ...props, compact: true })

    function registerHeroLogo(ctx, skin, onError) {
      return ctx.slots.inject(HERO_LOGO_SLOT, () => {
        try {
          const entries = typeof ctx.slots.entries === 'function' ? ctx.slots.entries(HERO_LOGO_SLOT) : []
          // A single slot uses priority to shadow and restore existing occupants.
          const priority = entries.reduce((lowest, entry) => Math.min(lowest, entry.options?.priority ?? 0), 0) - 1
          const Logo = ({ size = 34, className } = {}) => React.createElement('img', {
            src: `${BASE}${skin.id}/${skin.heroLogo}`,
            width: size, height: size, className, style: { objectFit: 'contain' },
            alt: '', 'aria-hidden': true, draggable: false, onError
          })
          return ctx.slots.register({ name: HERO_LOGO_SLOT, priority }, Logo)
        } catch (error) {
          console.warn('[luoxiaohei-skins] Unable to register the hero logo.', error?.message ?? error)
          return () => {}
        }
      })
    }

    const UPDATE_ROUTE = '/__luoxiaohei-skins/update'
    const PACKAGE_NAME = 'dsh-luoxiaohei-skins'
    const GITHUB_SPEC = 'github:anki7peng-png/dsh-lxhzj-skins'
    const SOURCE = /^(?:github:anki7peng-png\/dsh-lxhzj-skins|(?:git\+)?https:\/\/github\.com\/anki7peng-png\/dsh-lxhzj-skins|git\+ssh:\/\/git@github\.com\/anki7peng-png\/dsh-lxhzj-skins|git@github\.com:anki7peng-png\/dsh-lxhzj-skins)(?:\.git)?(?:#([^&?]+))?$/i
    const STABLE_VERSION = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/
    const COMMIT = /^[0-9a-f]{40}$/i
    let updateState = { phase: 'idle', message: '' }
    const updateListeners = new Set()
    const subscribeUpdate = listener => { updateListeners.add(listener); return () => updateListeners.delete(listener) }
    const publishUpdate = changes => { updateState = { ...updateState, ...changes }; for (const listener of updateListeners) listener() }

    function newerVersion(candidate, installed) {
      if (!STABLE_VERSION.test(candidate ?? '') || !STABLE_VERSION.test(installed ?? '')) throw new Error('version')
      const left = candidate.split('.'), right = installed.split('.')
      for (let i = 0; i < 3; i++) {
        if (left[i].length !== right[i].length) return left[i].length > right[i].length
        if (left[i] !== right[i]) return left[i] > right[i]
      }
      return false
    }

    async function installedBundle(manager) {
      const answer = await manager.listBundles()
      if (!answer?.ok || !Array.isArray(answer.value)) throw new Error('manager')
      const bundle = answer.value.find(item => item.name === PACKAGE_NAME)
      const match = typeof bundle?.source === 'string' ? bundle.source.match(SOURCE) : null
      if (!bundle?.installed || bundle.availability !== 'profile' || bundle.official || !bundle.removable || !match) throw new Error('source')
      const pinned = COMMIT.test(match[1] ?? '')
      if (pinned && bundle.update !== 'git') throw new Error('manager')
      return { bundle, pinned }
    }

    function updateError(error) {
      if (error?.message === 'source') return '当前安装来源不支持自动更新，请使用本项目的 GitHub 地址安装。'
      if (error?.message === 'version') return '插件版本信息不可用，请检查安装情况。'
      if (error?.message === 'changed') return '安装状态已变化，请重新检查更新。'
      if (error?.message === 'manager') return 'DSH 插件管理服务暂不可用。'
      return '检查更新失败，请检查网络连接后重试。'
    }

    function updateNotice(version) {
      // Keep progress outside this plugin's React tree: DSH may unload the
      // plugin while its own update is running.
      const box = document.createElement('div')
      const text = document.createElement('span')
      const close = document.createElement('button')
      box.setAttribute('role', 'status')
      box.setAttribute('aria-live', 'polite')
      Object.assign(box.style, { position: 'fixed', zIndex: '2147483647', right: '20px', bottom: '20px', maxWidth: '340px', padding: '14px 16px', borderRadius: '10px', background: '#14251b', color: '#edf7ef', border: '1px solid #5c8069', boxShadow: '0 6px 24px #0006', fontSize: '14px' })
      text.textContent = `正在更新罗小黑皮肤到 ${version}，请稍候…`
      close.type = 'button'
      close.textContent = '关闭'
      close.hidden = true
      Object.assign(close.style, { marginTop: '10px', color: 'inherit', background: 'transparent', border: '1px solid #91ad99', borderRadius: '5px', padding: '4px 10px', cursor: 'pointer' })
      close.addEventListener('click', () => box.remove())
      box.append(text, close)
      document.body.append(box)
      return message => { text.textContent = message; close.hidden = false }
    }

    function updateOutcome(answer, nativeUpdate) {
      if (!answer?.ok) return '未能确认更新结果，请检查插件版本后再试。'
      const operation = nativeUpdate ? answer.value?.result : answer.value
      if (!operation) return '未能确认更新结果，请检查插件版本后再试。'
      if (operation.application === 'applied') return '罗小黑皮肤已更新。'
      if (operation.application === 'restart-required') return '更新已安装，重启 DSH 后生效。'
      if (operation.application === 'overridden') return '更新已安装，请检查插件的启用状态。'
      if (operation.failedAt === 'spec-host') return '已发现更新，但无法连接 GitHub 下载，请检查 GitHub 网络。'
      if (nativeUpdate && answer.value?.restore) {
        const restored = answer.value.restore.application
        if (restored === 'applied') return '更新失败，已恢复原版本。'
        if (restored === 'restart-required') return '更新失败，原版本已恢复；请重启 DSH。'
        return '更新失败且未能恢复原版本，请重新安装插件。'
      }
      if (operation.stage === 'enable') return '新版本已安装但未能启动，请重启 DSH 或重新安装插件。'
      return '更新未完成，请检查网络和插件状态后重试。'
    }

    function registerUpdater(ctx) {
      ctx.inject?.(['remote', 'remote.pluginManager'], scope => {
        const manager = scope.remote.pluginManager
        async function checkUpdate() {
          if (updateState.phase === 'checking' || updateState.phase === 'updating') return
          publishUpdate({ phase: 'checking', message: '正在检查更新…' })
          try {
            const { bundle } = await installedBundle(manager)
            const response = await fetch(UPDATE_ROUTE, { credentials: 'same-origin', cache: 'no-store' })
            if (!response.ok) throw new Error('network')
            const latest = await response.json()
            if (!COMMIT.test(latest?.commit ?? '')) throw new Error('network')
            const available = newerVersion(latest.version, bundle.version)
            const message = available ? `发现新版本 ${latest.version}`
              : newerVersion(bundle.version, latest.version) ? '当前版本高于 GitHub main，暂无可用更新。' : '当前已是最新版本。'
            publishUpdate({ phase: available ? 'available' : 'latest', message, current: bundle.version, source: bundle.source, latest })
          } catch (error) { publishUpdate({ phase: 'error', message: updateError(error) }) }
        }

        async function runUpdate() {
          if (updateState.phase !== 'available') return
          const { current, source, latest } = updateState
          publishUpdate({ phase: 'updating', message: '正在更新，请稍候…' })
          let finish
          try {
            const { bundle, pinned } = await installedBundle(manager)
            if (bundle.version !== current || bundle.source !== source || !newerVersion(latest.version, current) || !COMMIT.test(latest.commit)) throw new Error('changed')
            finish = updateNotice(latest.version)
            const spec = `${GITHUB_SPEC}#${latest.commit}`
            // A floating GitHub source cannot use updateBundle. DSH supports
            // installing a different Git spec over it; this also pins the
            // source so subsequent updates use its rollback-aware API.
            const answer = pinned
              ? await manager.updateBundle(PACKAGE_NAME, latest.version, { spec })
              : await manager.installBundle(spec, { enabled: bundle.enabled, expected: { name: PACKAGE_NAME, version: latest.version } })
            const message = updateOutcome(answer, pinned)
            finish(message)
            publishUpdate({ phase: 'finished', message })
          } catch (error) {
            const message = finish ? '未能确认更新结果，请检查插件版本后再试。' : updateError(error)
            finish?.(message)
            publishUpdate({ phase: 'error', message })
          }
        }

        function UpdateAction({ subject }) {
          const current = React.useSyncExternalStore(subscribeUpdate, () => updateState, () => updateState)
          const ownBundle = subject?.kind === 'bundle' && subject.pkg?.name === PACKAGE_NAME
          React.useEffect(() => { if (ownBundle && updateState.phase === 'idle') void checkUpdate() }, [ownBundle])
          if (!ownBundle) return null
          const busy = current.phase === 'checking' || current.phase === 'updating'
          const label = current.phase === 'available' ? `更新到 ${current.latest.version}`
            : current.phase === 'checking' ? '检查中…'
              : current.phase === 'updating' ? '更新中…'
                : current.phase === 'error' ? '重试检查' : '检查更新'
          return React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' } },
            React.createElement('button', {
              type: 'button', disabled: busy, onClick: () => { void (current.phase === 'available' ? runUpdate() : checkUpdate()) },
              style: { padding: '7px 12px', border: '1px solid var(--dsw-alias-border-l2, #888)', borderRadius: '8px', color: 'inherit', background: 'var(--dsw-alias-bg-layer-2, transparent)', cursor: busy ? 'default' : 'pointer' }
            }, label),
            current.message ? React.createElement('span', { role: 'status', style: { fontSize: '12px', opacity: 0.8 } }, current.message) : null)
        }

        scope.effect(() => scope.slots.inject('plugins.detail.actions', () => scope.slots.register({
          name: 'plugins.detail.actions', id: 'luoxiaohei-skins-update', order: 40
        }, UpdateAction)), 'luoxiaohei-skins: plugin updates')
      })
    }

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
.luoxiaohei-cameo {
  /* Visual size is intentionally a single variable so it can be tuned later. */
  --luoxiaohei-cameo-width: 200px;
  display: none;
  position: absolute;
  right: 0;
  bottom: 0;
  z-index: 1;
  width: min(var(--luoxiaohei-cameo-width), 36vw);
  max-width: none;
  height: auto;
  object-fit: contain;
  pointer-events: none;
  user-select: none;
  -webkit-user-drag: none;
}
.luoxiaohei-character[data-luoxiaohei-cameo]::before {
  display: none;
}
.luoxiaohei-character[data-luoxiaohei-cameo] .luoxiaohei-face,
.luoxiaohei-character[data-luoxiaohei-cameo] .luoxiaohei-character-caption {
  display: none;
}
.luoxiaohei-character[data-luoxiaohei-cameo] .luoxiaohei-cameo {
  display: block;
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
      const backdrop = skin.background
      const staticBackground = backdrop
        ? `background-image: linear-gradient(180deg, rgba(2, 8, 5, 0.20) 0%, rgba(2, 8, 5, 0.06) 42%, rgba(2, 8, 5, 0.42) 100%), url("${BASE}${id}/${backdrop}");
  background-position: center, center;
  background-size: cover, cover;
  background-repeat: no-repeat, no-repeat;
  background-attachment: fixed, fixed;`
        : ''
      const background = skin.backgroundAnimated
        ? `body[${attr}] { background-color: #04100b; }
.luoxiaohei-wallpaper {
  position: fixed;
  inset: 0;
  z-index: -1;
  width: 100%;
  height: 100%;
  object-fit: cover;
  pointer-events: none;
  user-select: none;
}
${backdrop ? `@media (prefers-reduced-motion: reduce) {
  .luoxiaohei-wallpaper { display: none; }
  body[${attr}] { ${staticBackground} }
}` : ''}`
        : backdrop
          ? `body[${attr}] { background-color: #04100b; ${staticBackground} }`
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
  background: linear-gradient(145deg, rgba(13, 31, 22, 0.78), rgba(5, 15, 10, 0.72)) !important;
  border: 0 !important;
  box-shadow: 0 8px 18px rgba(0, 0, 0, 0.24), inset 0 0 0 1px rgba(168, 226, 188, 0.16), inset 0 1px 0 rgba(255, 255, 255, 0.07) !important;
  backdrop-filter: blur(10px) saturate(1.06);
}
body[${attr}] li[data-plugin-item]:hover,
body[${attr}] li[data-plugin-package]:hover {
  background: linear-gradient(145deg, rgba(20, 42, 30, 0.86), rgba(8, 21, 14, 0.80)) !important;
  box-shadow: 0 12px 24px rgba(0, 0, 0, 0.28), inset 0 0 0 1px rgba(147, 231, 179, 0.28), inset 0 1px 0 rgba(255, 255, 255, 0.08) !important;
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
      const heroLogo = skin.heroLogo
        ? `
body[${attr}] *:has(> [data-slot="${HERO_LOGO_SLOT}"] img[src*="${BASE}"]) {
  flex: 0 0 100%;
  width: 100%;
  justify-content: center;
}
body[${attr}] *:has(> * > [data-slot="${HERO_LOGO_SLOT}"] img[src*="${BASE}"]) {
  flex-direction: column;
  row-gap: 10px;
}
body[${attr}] [data-slot="${HERO_LOGO_SLOT}"] img[src*="${BASE}"] {
  width: 260px;
  height: 156px;
  max-width: min(260px, 72vw);
  aspect-ratio: 5 / 3;
  object-fit: contain;
  filter: drop-shadow(0 0 5px rgba(210, 236, 218, 0.26)) drop-shadow(0 10px 22px rgba(0, 0, 0, 0.48));
  animation: none !important;
  transform: none !important;
  pointer-events: none;
  user-select: none;
}
`
        : ''
      return `${background}\nbody[${attr}] { --luoxiaohei-accent: ${accent}; }\n${forest}\n${windows}\n${heroLogo}\n${menu}\n${surfaces}\n${characterCss()}`
    }

    return {
      inject: ['slots', 'theme', 'configForms'],
      apply(ctx) {
        registerUpdater(ctx)
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
          let wallpaper
          let disposeLogo
          const windowsClient = isWindowsClient()
          body.setAttribute(BODY_ATTR, skin.id)
          if (skin.backgroundAnimated) {
            wallpaper = document.createElement('img')
            wallpaper.className = 'luoxiaohei-wallpaper'
            wallpaper.alt = ''
            wallpaper.setAttribute('aria-hidden', 'true')
            wallpaper.draggable = false
            wallpaper.src = `${BASE}${skin.id}/${skin.backgroundAnimated}`
            wallpaper.addEventListener('error', () => {
              wallpaper?.remove()
              wallpaper = null
              if (skin.background) body.style.backgroundImage = `linear-gradient(180deg, rgba(2, 8, 5, 0.20) 0%, rgba(2, 8, 5, 0.06) 42%, rgba(2, 8, 5, 0.42) 100%), url("${BASE}${skin.id}/${skin.background}")`
            }, { once: true })
            body.append(wallpaper)
          }
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
            disposeLogo?.()
            style?.remove()
            document.querySelectorAll?.('.luoxiaohei-whisper').forEach(node => node.remove())
            disposeTokens?.()
            if (previousTheme && scheme && ctx.theme.getTheme().preference === scheme && previousTheme !== scheme) {
              try { ctx.theme.setTheme(previousTheme) } catch { ctx.theme.setTheme('system') }
            }
            if (hadAttribute) body.setAttribute(BODY_ATTR, previousAttribute ?? '')
            else body.removeAttribute(BODY_ATTR)
            body.removeAttribute(PLATFORM_ATTR)
            wallpaper?.remove()
            if (skin.backgroundAnimated) body.style.backgroundImage = ''
          }

          if (skin.heroLogo) {
            disposeLogo = registerHeroLogo(ctx, skin, () => {
              const dispose = disposeLogo
              disposeLogo = undefined
              dispose?.()
            })
          }
        }

        function sync() {
          if (disposed) return
          const formState = form.getSnapshot()
          const selected = formState.value?.selectedSkin ?? 'default'
          const active = loaded && formState.status === 'ready'
            ? catalog.find(skin => skin.id === selected && skin.available) ?? null : null
          changeActive(active)
          publish({ themes: catalog, selected, active, status: loaded ? formState.status : 'loading', writable: formState.writable, notifications: formState.value ?? {} })
        }

        async function saveSetting(field, value) {
          if (state.writing || state.status !== 'ready' || !state.writable) return
          publish({ writing: true, error: '' })
          try {
            if (!await form.set(field, value)) publish({ error: '保存失败，请重试。' })
          } catch {
            publish({ error: '保存失败，请检查 DSH 配置后重试。' })
          } finally {
            if (!disposed) { publish({ writing: false }); sync() }
          }
        }

        async function choose(id) {
          if (id !== 'default' && !catalog.some(skin => skin.id === id && skin.available)) return
          await saveSetting('selectedSkin', id)
        }

        function browserNotification(kind, sessionId, test = false) {
          if (typeof Notification === 'undefined' || Notification.permission !== 'granted') throw new Error('not-authorized')
          const [title, body] = test ? ['小黑 · 通知测试', '这是一条系统通知测试。'] : NOTIFICATION_COPY[kind]
          let tag = 0
          for (const character of String(sessionId || 'test')) tag = ((tag << 5) - tag + character.charCodeAt(0)) | 0
          const options = { body, tag: `lxh-${kind}-${Math.abs(tag).toString(36)}` }
          if (state.active?.notificationIcon) options.icon = new URL(`${BASE}${state.active.id}/${state.active.notificationIcon}`, window.location.href).href
          const notification = new Notification(title, options)
          notification.onclick = () => { window.focus?.(); notification.close?.() }
        }

        async function deliverNotification(kind, sessionId) {
          try {
            if (isMacDesktop() && await macHelperAvailable()) {
              if (disposed || form.getSnapshot().value?.notificationsEnabled !== true) return
              try { await notifyMac(kind); return } catch (error) {
                if (error?.message !== 'helper-unavailable') throw error
              }
            }
            if (disposed || form.getSnapshot().value?.notificationsEnabled !== true) return
            browserNotification(kind, sessionId)
          } catch (error) {
            if (!disposed) publish({ error: notificationError(error) })
          }
        }

        async function setNotificationsEnabled(enabled) {
          if (state.writing || state.status !== 'ready' || !state.writable) return
          if (!enabled) return saveSetting('notificationsEnabled', false)
          publish({ writing: true, error: '' })
          try {
            // Request browser permission while the user gesture is still active,
            // even if the macOS helper probe has not completed yet.
            let browserPermission
            if (typeof Notification !== 'undefined') {
              try {
                browserPermission = Notification.permission === 'default'
                  ? Promise.resolve(Notification.requestPermission()).catch(() => 'denied')
                  : Promise.resolve(Notification.permission)
              } catch { browserPermission = Promise.resolve('denied') }
            }
            let sent = false
            if (isMacDesktop() && await macHelperAvailable()) {
              try { await notifyMac('test'); sent = true } catch (error) {
                if (error?.message !== 'helper-unavailable') throw error
              }
            }
            if (!sent) {
              if (!browserPermission) throw new Error('unsupported')
              if (await browserPermission !== 'granted') throw new Error('not-authorized')
              browserNotification('completion', 'test', true)
            }
            if (!await form.set('notificationsEnabled', true)) throw new Error('save-failed')
          } catch (error) {
            if (!disposed) publish({ error: notificationError(error) })
          } finally {
            if (!disposed) { publish({ writing: false }); sync() }
          }
        }

        function SkinSelector() {
          const current = React.useSyncExternalStore(subscribe, () => state, () => empty)
          const disabled = current.status !== 'ready' || !current.writable || current.writing
          const options = [{ id: 'default', name: 'DSH 默认界面', tagline: '原始主题与布局', available: true }, ...current.themes]
          const ready = current.themes.filter(theme => theme.available).length
          return React.createElement('section', { 'aria-label': '罗小黑皮肤与管理', style: { padding: '8px 0 24px', color: 'var(--dsw-alias-label-primary, inherit)' } },
            React.createElement('h3', { style: { margin: '0 0 8px', fontSize: '18px' } }, `皮肤管理${current.themes.length ? ` · ${ready}/${current.themes.length} 可用` : ''}`),
            React.createElement('p', { style: { margin: '0 0 12px', opacity: 0.75 } }, '选择一个主题；标记为素材待制作的主题暂不可用。切换后会立即应用背景、配色与角色状态图。'),
            current.status === 'loading' ? React.createElement('p', null, '正在加载皮肤配置…') : null,
            current.status === 'unavailable' ? React.createElement('p', { role: 'alert' }, '皮肤配置暂不可用。') : null,
            current.error ? React.createElement('p', { role: 'alert' }, current.error) : null,
            React.createElement('div', { role: 'radiogroup', 'aria-label': '选择皮肤', style: { display: 'grid', gap: '10px', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 270px), 1fr))' } },
              ...options.map(option => {
                const selected = current.selected === option.id
                const available = option.available
                const cover = option.character?.idle ?? Object.values(option.character ?? {}).find(Boolean) ?? null
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
                  cover ? React.createElement('span', {
                    style: {
                      display: 'flex', alignItems: 'center', justifyContent: 'flex-start',
                      height: '88px', marginTop: '6px', padding: '0 4px', borderRadius: '9px',
                      background: 'radial-gradient(circle at 50% 58%, rgba(147, 231, 179, 0.16), transparent 70%)'
                    }
                  }, React.createElement('img', {
                    src: `${BASE}${option.id}/${cover}`, alt: option.name, title: option.name,
                    loading: 'lazy',
                    style: {
                      display: 'block', height: '100%', width: 'auto', maxWidth: '100%',
                      objectFit: 'contain', objectPosition: '50% 50%',
                      filter: 'drop-shadow(0 5px 10px rgba(0, 0, 0, 0.45))'
                    }
                  })) : null,
                  !available ? React.createElement('span', { style: { display: 'block', marginTop: '5px', fontSize: '12px', opacity: 0.8 } }, '素材待制作') : null))
              })),
            React.createElement('div', { style: { marginTop: '24px', paddingTop: '20px', borderTop: '1px solid var(--dsw-alias-border-l2, #888)', display: 'grid', gap: '10px' } },
              React.createElement('h3', { style: { margin: 0, fontSize: '18px' } }, '通知管理'),
              React.createElement('p', { style: { margin: 0, opacity: 0.75 } }, '任务本轮结束、需要审批或回答问题时提醒；通知不包含对话内容。'),
              React.createElement('button', {
                type: 'button', disabled,
                onClick: () => { void setNotificationsEnabled(current.notifications.notificationsEnabled !== true) },
                style: { justifySelf: 'start', cursor: disabled ? 'default' : 'pointer', padding: '8px 14px', borderRadius: '8px', border: '1px solid var(--dsw-alias-border-l2, #888)', color: 'inherit', background: 'var(--dsw-alias-bg-layer-2, transparent)', opacity: disabled ? 0.6 : 1 }
              }, current.notifications.notificationsEnabled === true ? '关闭系统通知' : '开启系统通知'),
              ...[['notifyCompletion', '本轮结束'], ['notifyApproval', '审批请求'], ['notifyQuestion', '需要回答的问题']].map(([field, label]) =>
                React.createElement('label', { key: field, style: { display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 0' } },
                  React.createElement('input', {
                    type: 'checkbox', checked: current.notifications[field] !== false,
                    disabled: disabled || current.notifications.notificationsEnabled !== true,
                    style: { accentColor: 'var(--dsw-alias-brand-primary, #93e7b3)' },
                    onChange: event => { void saveSetting(field, event.target.checked) }
                  }), ` ${label}`)),
              isMacDesktop() ? React.createElement('p', { style: { margin: 0, opacity: 0.75 } }, '开启时会发送一条测试通知。') : null)
          )
        }

        ctx.slots.inject('conversation.composer.dock', () => ctx.slots.register({
          name: 'conversation.composer.dock', id: 'luoxiaohei-skins-character', order: 100
        }, Character))
        ctx.slots.inject('conversation.session.header.actions', () => ctx.slots.register({
          name: 'conversation.session.header.actions', id: 'luoxiaohei-skins-compact-character', order: 40
        }, MiniCharacter))
        ctx.effect(() => ctx.slots.inject('settings.section', () => ctx.slots.register({
          name: 'settings.section', id: 'luoxiaohei-skins', order: 25,
          label: () => '罗小黑皮肤与管理'
        }, SkinSelector)), 'luoxiaohei-skins: settings page')
        ctx.effect(() => ctx.configForms.whileServed([ENTRY], () => ctx.slots.inject('plugins.bundle.config', () => ctx.slots.register({
          name: 'plugins.bundle.config', key: 'dsh-luoxiaohei-skins'
        }, SkinSelector))), 'luoxiaohei-skins: selector')
        ctx.effect(() => watchNotifications(ctx, () => form.getSnapshot().value ?? {}, deliverNotification), 'luoxiaohei-skins: local notifications')
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
