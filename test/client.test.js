import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'

const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8')

async function mount(themes, initial = 'default', { logoSlot = true, existingLogo, rejectLogo = false } = {}) {
  const attrs = new Map(), effects = [], subscribers = new Set(), styles = [], components = {}
  const logoName = 'conversation.hero.brand.mark', logoEntries = [], logoWaiters = new Set(), warnings = []
  let logoDeclared = logoSlot
  let plugin, preference = 'system', formState = { status: 'ready', writable: true, value: { selectedSkin: initial } }
  const overrides = new Map()
  const body = { hasAttribute: key => attrs.has(key), getAttribute: key => attrs.get(key) ?? null, setAttribute: (key, value) => attrs.set(key, value), removeAttribute: key => attrs.delete(key), style: {}, append() {}, remove() {} }
  const React = {
    useSyncExternalStore: (_subscribe, snapshot) => snapshot(),
    useRef: value => ({ current: value }),
    useEffect: () => {},
    createElement: (type, props, ...children) => ({ type, props: props ?? {}, children })
  }
  const form = {
    getSnapshot: () => formState,
    subscribe(listener) { subscribers.add(listener); return () => subscribers.delete(listener) },
    async set(field, value) { formState = { ...formState, value: { ...formState.value, [field]: value } }; for (const listener of subscribers) listener(); return true }
  }
  const electLogo = () => {
    const winner = [...logoEntries].sort((a, b) => (a.options.priority ?? 0) - (b.options.priority ?? 0))[0]
    if (winner) components[logoName] = winner.component
    else delete components[logoName]
  }
  const slots = {
    inject(slot, fn) {
      if (slot !== logoName) return fn()
      let active
      const waiter = {
        sync() {
          if (logoDeclared && !active) active = fn()
          if (!logoDeclared && active) { active(); active = undefined }
        }
      }
      logoWaiters.add(waiter)
      waiter.sync()
      return () => { logoWaiters.delete(waiter); active?.(); active = undefined }
    },
    entries(slot) { return slot === logoName ? logoEntries : [] },
    register(options, value) {
      if (options.name === logoName) {
        if (!logoDeclared) throw new Error('logo slot is not declared')
        if (rejectLogo && value !== existingLogo) throw new Error('logo registration rejected')
        if ('id' in options || 'order' in options) throw new Error('single slot cannot use id or order')
        const priority = options.priority ?? 0
        if (logoEntries.some(entry => (entry.options.priority ?? 0) === priority)) throw new Error('duplicate priority')
        const entry = { options, component: value }
        logoEntries.push(entry)
        electLogo()
        return () => {
          const index = logoEntries.indexOf(entry)
          if (index >= 0) logoEntries.splice(index, 1)
          electLogo()
        }
      }
      components[options.name] = value
      return () => { if (components[options.name] === value) delete components[options.name] }
    }
  }
  if (existingLogo) slots.register({ name: logoName }, existingLogo)
  const ctx = {
    slots,
    configForms: { get() { return form }, whileServed(_ids, fn) { return fn() } },
    effect(fn) { effects.push(fn()) },
    theme: {
      getTheme: () => ({ preference }),
      setTheme(id) { preference = id },
      overrideTokens(source, tokens) { overrides.set(source, tokens); return () => overrides.delete(source) }
    }
  }
  const sandbox = { window: { __ModuleLoader__: { load(value) { plugin = value.factory(() => React) } } }, document: { body, head: { append(value) { styles.push(value) } }, createElement: type => ({ tagName: String(type).toUpperCase(), className: '', style: {}, setAttribute() {}, addEventListener() {}, append() {}, remove() { this.removed = true } }) }, fetch: async () => ({ ok: true, json: async () => ({ themes }) }), AbortController, console: { ...console, warn: (...args) => warnings.push(args) } }
  vm.runInNewContext(source, sandbox)
  plugin.apply(ctx)
  await new Promise(resolve => setImmediate(resolve))
  return {
    components, attrs, styles, form, overrides, logoEntries, warnings,
    setLogoSlot(value) {
      logoDeclared = value
      for (const waiter of [...logoWaiters]) waiter.sync()
      if (!value) { logoEntries.splice(0); electLogo() }
    },
    get preference() { return preference },
    setPreference(value) { preference = value },
    dispose() { for (const effect of effects.reverse()) effect?.() }
  }
}

const forest = { id: 'forest', name: '森林', available: true, background: 'forest.png', backgroundAnimated: 'background-animated.webp', backgroundWindows: 'forest-win.png', theme: null, character: { working: 'work.png', waiting: 'wait.png', idle: 'idle.png', unknown: null }, gaze: { working: 'work-gaze.png', waiting: 'wait-gaze.png', idle: 'idle-gaze.png', unknown: null } }
const mountain = { id: 'mountain', name: '山水', available: true, background: 'mountain.png', theme: { colorScheme: 'dark', tokens: { '--dsw-alias-bg-base': 'transparent' } }, character: {} }
const future = { id: 'future', name: '待制作', available: false, background: null, theme: null, character: {} }
const forestLogo = { ...forest, heroLogo: 'forest-logo.webp' }
const mountainLogo = { ...mountain, heroLogo: 'mountain-logo.png' }
const buttons = instance => instance.components['plugins.bundle.config']().children[5].children
const countPupils = node => Array.isArray(node)
  ? node.reduce((sum, child) => sum + countPupils(child), 0)
  : (node?.props?.className?.includes('luoxiaohei-pupil') ? 1 : 0) + (node?.children ?? []).reduce((sum, child) => sum + countPupils(child), 0)
const imageOf = node => { const walk = value => { if (!value) return null; if (value.type === 'img') return value.props; for (const child of value.children ?? []) { const found = walk(child); if (found) return found } return null }; return walk(node) }

test('selects independent skins through the DSH form and restores the default', async () => {
  const instance = await mount([forest, mountain, future])
  assert.equal(buttons(instance).length, 4)
  assert.equal(buttons(instance)[3].props.disabled, true)
  buttons(instance)[1].props.onClick()
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(instance.form.getSnapshot().value.selectedSkin, 'forest')
  assert.equal(instance.attrs.get('data-dsh-luoxiaohei-skin'), 'forest')
  assert.match(instance.styles[0].textContent, /luoxiaohei-wallpaper/)
  assert.match(instance.styles[0].textContent, /data-dsh-luoxiaohei-platform/)
  assert.match(instance.styles[0].textContent, /role="menu"\]\[data-menu-material="translucent"\]/)
  assert.match(instance.styles[0].textContent, /--dsw-menu-surface-fill: rgba\(9, 21, 15, 0\.96\)/)
  assert.match(instance.styles[0].textContent, /--dsw-alias-menu-icon: #dbe9dd/)
  assert.match(instance.styles[0].textContent, /li\[data-plugin-item\],/)
  assert.match(instance.styles[0].textContent, /li\[data-plugin-package\]/)
  assert.match(instance.styles[0].textContent, /data-shortcut-modal="settings"/)
  assert.match(instance.styles[0].textContent, /filter: saturate\(0\.78\) contrast\(1\.02\)/)
  assert.doesNotMatch(instance.styles[0].textContent, /--dsw-menu-surface-fill: var\(--dsw-specific-menu/)
  assert.match(instance.styles[0].textContent, /luoxiaohei-whisper/)
  assert.match(instance.styles[0].textContent, /translateY\(-1px\)/)
  buttons(instance)[2].props.onClick()
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(instance.styles[0].removed, true)
  assert.equal(instance.attrs.get('data-dsh-luoxiaohei-skin'), 'mountain')
  assert.equal(instance.preference, 'dark')
  assert.equal(instance.overrides.has('luoxiaohei-skins:mountain'), true)
  const pair = instance.overrides.get('luoxiaohei-skins:mountain')['--dsw-alias-bg-base']
  assert.equal(pair.light, 'transparent')
  assert.equal(pair.dark, 'transparent')
  buttons(instance)[0].props.onClick()
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(instance.attrs.has('data-dsh-luoxiaohei-skin'), false)
  assert.equal(instance.preference, 'system')
  instance.dispose()
})

test('uses each selected skin logo and restores the previous occupant on switch or unload', async () => {
  const previous = () => 'existing logo'
  const instance = await mount([forestLogo, mountainLogo], 'forest', { existingLogo: previous })
  const logo = () => instance.components['conversation.hero.brand.mark']
  let image = logo()({ size: 40, className: 'host-mark' })
  assert.equal(image.type, 'img')
  assert.equal(image.props.src, '/skin-assets/luoxiaohei/forest/forest-logo.webp')
  assert.equal(image.props.width, 40)
  assert.equal(image.props.height, 40)
  assert.equal(image.props.className, 'host-mark')
  assert.equal(image.props.alt, '')
  assert.match(instance.styles[0].textContent, /\*:has\(> \* > \[data-slot="conversation\.hero\.brand\.mark"\] img\[src\*="\/skin-assets\/luoxiaohei\/"\]\)/)
  assert.match(instance.styles[0].textContent, /\*:has\(> \[data-slot="conversation\.hero\.brand\.mark"\] img\[src\*="\/skin-assets\/luoxiaohei\/"\]\)/)
  assert.doesNotMatch(instance.styles[0].textContent, /_headline|_fishHitbox/)
  assert.match(instance.styles[0].textContent, /flex-direction: column/)
  assert.match(instance.styles[0].textContent, /aspect-ratio: 5 \/ 3/)
  assert.deepEqual(instance.logoEntries.map(entry => entry.options.priority ?? 0).sort(), [-1, 0])
  buttons(instance)[2].props.onClick()
  await new Promise(resolve => setImmediate(resolve))
  image = logo()({ size: 34 })
  assert.equal(image.props.src, '/skin-assets/luoxiaohei/mountain/mountain-logo.png')
  buttons(instance)[0].props.onClick()
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(logo(), previous)
  buttons(instance)[1].props.onClick()
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(logo()({}).props.src, '/skin-assets/luoxiaohei/forest/forest-logo.webp')
  instance.dispose()
  assert.equal(logo(), previous)
})

test('waits for the logo slot and cancels pending registration when the skin changes or unloads', async () => {
  const instance = await mount([forestLogo, mountain], 'forest', { logoSlot: false })
  const logo = () => instance.components['conversation.hero.brand.mark']
  assert.equal(logo(), undefined)
  buttons(instance)[2].props.onClick()
  await new Promise(resolve => setImmediate(resolve))
  instance.setLogoSlot(true)
  assert.equal(logo(), undefined)
  buttons(instance)[1].props.onClick()
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(logo()({}).props.src, '/skin-assets/luoxiaohei/forest/forest-logo.webp')
  instance.setLogoSlot(false)
  assert.equal(logo(), undefined)
  instance.dispose()
  instance.setLogoSlot(true)
  assert.equal(logo(), undefined)
})

test('keeps the skin usable if logo registration fails', async () => {
  const instance = await mount([forestLogo], 'forest', { rejectLogo: true })
  assert.equal(instance.attrs.get('data-dsh-luoxiaohei-skin'), 'forest')
  assert.equal(instance.components['conversation.hero.brand.mark'], undefined)
  assert.equal(instance.warnings.length, 1)
  instance.dispose()
})

test('keeps the previous logo when no artwork is configured or an image fails to load', async () => {
  const previous = () => 'existing logo'
  const empty = await mount([forest], 'forest', { existingLogo: previous })
  assert.equal(empty.components['conversation.hero.brand.mark'], previous)
  assert.equal(empty.logoEntries.length, 1)
  empty.dispose()

  const broken = await mount([forestLogo], 'forest', { existingLogo: previous })
  const image = broken.components['conversation.hero.brand.mark']({})
  image.props.onError()
  assert.equal(broken.components['conversation.hero.brand.mark'], previous)
  assert.equal(broken.logoEntries.length, 1)
  assert.equal(broken.attrs.get('data-dsh-luoxiaohei-skin'), 'forest')
  broken.dispose()
})

test('maps the active session status to the selected skin character', async () => {
  const instance = await mount([forest], 'forest')
  const render = status => instance.components['conversation.composer.dock']({ sessionId: 'one', useSessionStatus: select => select(new Map([['one', status]])) })
    assert.equal(render({ running: true }).props['data-luoxiaohei-state'], 'working')
  assert.equal(imageOf(render({ running: true })).src, '/skin-assets/luoxiaohei/forest/work-gaze.png')
  assert.equal(render({ running: true, pendingInteraction: { kind: 'approval' } }).props['data-luoxiaohei-state'], 'waiting')
  assert.equal(imageOf(render({ running: true, pendingInteraction: { kind: 'approval' } })).src, '/skin-assets/luoxiaohei/forest/wait-gaze.png')
  assert.equal(imageOf(render({ running: false })).src, '/skin-assets/luoxiaohei/forest/idle-gaze.png')
  assert.equal(render(undefined), null)
  const full = render({ running: true })
  assert.equal(countPupils(full), 2)
  instance.dispose()
  assert.equal(instance.attrs.has('data-dsh-luoxiaohei-skin'), false)
  assert.equal(instance.styles[0].removed, true)
})


test('renders a hidden idle cameo image only when the active skin has a hero logo', async () => {
  const withLogo = await mount([forestLogo], 'forest')
  const renderLogo = status => withLogo.components['conversation.composer.dock']({ sessionId: 'one', useSessionStatus: select => select(new Map([['one', status]])) })
  const idle = renderLogo({ running: false })
  const cameo = idle.children.find(child => child?.props?.className === 'luoxiaohei-cameo')
  assert.ok(cameo)
  assert.equal(cameo.props.src, '/skin-assets/luoxiaohei/forest/forest-logo.webp')
  assert.equal(cameo.props.alt, '')
  assert.match(withLogo.styles[0].textContent, /data-luoxiaohei-cameo/)
  assert.match(withLogo.styles[0].textContent, /luoxiaohei-cameo/)
  withLogo.dispose()

  const plain = await mount([forest], 'forest')
  const idlePlain = plain.components['conversation.composer.dock']({ sessionId: 'one', useSessionStatus: select => select(new Map([['one', { running: false }]])) })
  assert.equal(idlePlain.children.some(child => child?.props?.className === 'luoxiaohei-cameo'), false)
  plain.dispose()
})

test('does not overwrite a later external theme preference on unload', async () => {
  const instance = await mount([mountain], 'mountain')
  assert.equal(instance.preference, 'dark')
  instance.setPreference('light')
  instance.dispose()
  assert.equal(instance.preference, 'light')
  assert.equal(instance.overrides.size, 0)
})


test('renders a compact waiting avatar only when the composer is taken over', async () => {
  const instance = await mount([forest], 'forest')
  const compact = instance.components['conversation.session.header.actions']
  const withStatus = status => {
    const wrapper = compact({ sessionId: 'one', useSessionStatus: select => select(new Map([['one', status]])) })
    return wrapper.type(wrapper.props)
  }
  assert.equal(withStatus({ running: true }), null)
  const waiting = withStatus({ running: true, pendingInteraction: { kind: 'question' } })
  assert.match(waiting.props.className, /luoxiaohei-character--compact/)
  assert.equal(waiting.props['data-luoxiaohei-state'], 'waiting')
  const image = imageOf(waiting)
  assert.equal(image.src, '/skin-assets/luoxiaohei/forest/wait.png')
  assert.equal(countPupils(waiting), 0)
  instance.dispose()
})
