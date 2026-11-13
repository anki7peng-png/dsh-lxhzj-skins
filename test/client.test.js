import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'

const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8')

async function mount(themes, initial = 'default') {
  const attrs = new Map(), effects = [], subscribers = new Set(), styles = [], components = {}
  let plugin, preference = 'system', formState = { status: 'ready', writable: true, value: { selectedSkin: initial } }
  const overrides = new Map()
  const body = { hasAttribute: key => attrs.has(key), getAttribute: key => attrs.get(key) ?? null, setAttribute: (key, value) => attrs.set(key, value), removeAttribute: key => attrs.delete(key) }
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
  const ctx = {
    slots: { inject(_slot, fn) { fn(); return () => {} }, register(options, value) { components[options.name] = value; return () => {} } },
    configForms: { get() { return form }, whileServed(_ids, fn) { return fn() } },
    effect(fn) { effects.push(fn()) },
    theme: {
      getTheme: () => ({ preference }),
      setTheme(id) { preference = id },
      overrideTokens(source, tokens) { overrides.set(source, tokens); return () => overrides.delete(source) }
    }
  }
  const sandbox = { window: { __ModuleLoader__: { load(value) { plugin = value.factory(() => React) } } }, document: { body, head: { append(value) { styles.push(value) } }, createElement: () => ({ setAttribute() {}, removed: false, remove() { this.removed = true } }) }, fetch: async () => ({ ok: true, json: async () => ({ themes }) }), AbortController, console }
  vm.runInNewContext(source, sandbox)
  plugin.apply(ctx)
  await new Promise(resolve => setImmediate(resolve))
  return {
    components, attrs, styles, form, overrides,
    get preference() { return preference },
    setPreference(value) { preference = value },
    dispose() { for (const effect of effects.reverse()) effect?.() }
  }
}

const forest = { id: 'forest', name: '森林', available: true, background: 'forest.png', backgroundWindows: 'forest-win.png', theme: null, character: { working: 'work.png', waiting: 'wait.png', idle: 'idle.png', unknown: null }, gaze: { working: 'work-gaze.png', waiting: 'wait-gaze.png', idle: 'idle-gaze.png', unknown: null } }
const mountain = { id: 'mountain', name: '山水', available: true, background: 'mountain.png', theme: { colorScheme: 'dark', tokens: { '--dsw-alias-bg-base': 'transparent' } }, character: {} }
const future = { id: 'future', name: '待制作', available: false, background: null, theme: null, character: {} }
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
  assert.match(instance.styles[0].textContent, /forest\/forest\.png/)
  assert.match(instance.styles[0].textContent, /data-dsh-luoxiaohei-platform/)
  assert.match(instance.styles[0].textContent, /role="menu"\]\[data-menu-material="translucent"\]/)
  assert.match(instance.styles[0].textContent, /--dsw-menu-surface-fill: rgba\(9, 21, 15, 0\.96\)/)
  assert.match(instance.styles[0].textContent, /--dsw-alias-menu-icon: #dbe9dd/)
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
