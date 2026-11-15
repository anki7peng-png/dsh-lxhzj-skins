import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'

test('idle animation waits for a slow image, responds to activity, and cleans up', async () => {
  const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8')
  const tasks = new Map(), effects = [], components = {}, attributes = new Map()
  let plugin, nextTimer = 1, figure, cameo
  const eventHub = () => ({
    events: new Map(),
    addEventListener(type, fn) { const list = this.events.get(type) ?? []; list.push(fn); this.events.set(type, list) },
    removeEventListener(type, fn) { this.events.set(type, (this.events.get(type) ?? []).filter(item => item !== fn)) },
    fire(type) { for (const fn of [...(this.events.get(type) ?? [])]) fn({ type }) }
  })
  const win = eventHub(), doc = eventHub()
  win.matchMedia = () => ({ matches: false })
  const makeNode = () => ({
    attrs: new Map(), style: {},
    setAttribute(key, value) { this.attrs.set(key, value) },
    removeAttribute(key) { this.attrs.delete(key) },
    hasAttribute(key) { return this.attrs.has(key) },
    addEventListener() {}, remove() {}, append() {}
  })
  const body = makeNode()
  body.hasAttribute = key => attributes.has(key)
  body.getAttribute = key => attributes.get(key) ?? null
  body.setAttribute = (key, value) => attributes.set(key, value)
  body.removeAttribute = key => attributes.delete(key)
  doc.body = body
  doc.visibilityState = 'visible'
  doc.hasFocus = () => true
  doc.head = { append() {} }
  doc.createElement = () => makeNode()
  doc.querySelectorAll = () => []
  const React = {
    useSyncExternalStore(_subscribe, snapshot) { return snapshot() },
    useRef(value) { return { current: value } },
    useEffect(fn) { effects.push(fn) },
    createElement(type, props, ...children) {
      if (props?.ref) {
        const node = makeNode()
        if (props.className === 'luoxiaohei-cameo') { node.complete = false; node.naturalWidth = 0; cameo = node }
        if (type === 'figure') figure = node
        props.ref.current = node
      }
      return { type, props: props ?? {}, children }
    }
  }
  win.__ModuleLoader__ = { load(value) { plugin = value.factory(() => React) } }
  const form = { getSnapshot: () => ({ status: 'ready', writable: true, value: { selectedSkin: 'forest' } }), subscribe: () => () => {} }
  const ctx = {
    slots: { inject(_name, fn) { return fn() }, entries() { return [] }, register(options, fn) { components[options.name] = fn; return () => { delete components[options.name] } } },
    configForms: { get() { return form }, whileServed(_ids, fn) { return fn() } },
    effect(fn) { return fn() },
    theme: { getTheme() { return { preference: 'system' } }, setTheme() {}, overrideTokens() { return () => {} } }
  }
  const skin = { id: 'forest', name: '森林', available: true, heroLogo: 'logo.webp', background: null, theme: null, character: { idle: 'idle.webp' }, gaze: {} }
  const sandbox = {
    window: win, document: doc, AbortController, console,
    fetch: async () => ({ ok: true, json: async () => ({ themes: [skin] }) }),
    setTimeout(fn, delay) { const id = nextTimer++; tasks.set(id, { fn, delay }); return id },
    clearTimeout(id) { tasks.delete(id) }
  }
  vm.runInNewContext(source, sandbox)
  plugin.apply(ctx)
  await new Promise(resolve => setImmediate(resolve))
  components['conversation.composer.dock']({ sessionId: 's', useSessionStatus: select => select(new Map([['s', { running: false }]])) })
  assert.ok(figure && cameo)
  const cleanups = effects.map(effect => effect()).filter(Boolean)
  const runTimer = () => { const [id, task] = tasks.entries().next().value; tasks.delete(id); task.fn() }
  assert.equal(tasks.size, 1)
  assert.equal([...tasks.values()][0].delay, 10_000)
  runTimer()
  assert.equal(figure.hasAttribute('data-luoxiaohei-cameo'), false)
  assert.equal(tasks.size, 1)
  cameo.complete = true
  cameo.naturalWidth = 600
  runTimer()
  assert.equal(figure.hasAttribute('data-luoxiaohei-cameo'), true)
  win.fire('pointermove')
  assert.equal(figure.hasAttribute('data-luoxiaohei-cameo'), false)
  assert.equal(tasks.size, 1)
  doc.visibilityState = 'hidden'
  doc.fire('visibilitychange')
  assert.equal(tasks.size, 0)
  doc.visibilityState = 'visible'
  doc.fire('visibilitychange')
  assert.equal(tasks.size, 1)
  for (const cleanup of cleanups.reverse()) cleanup()
  assert.equal(tasks.size, 0)
  assert.equal((win.events.get('pointermove') ?? []).length, 0)
  assert.equal((doc.events.get('visibilitychange') ?? []).length, 0)
})
