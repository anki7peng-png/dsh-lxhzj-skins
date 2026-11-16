import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { EventEmitter } from 'node:events'
import { Readable } from 'node:stream'
import vm from 'node:vm'
import { createMacNotificationHandler } from '../lib/notification-mac.js'

const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8')

function store(initial) {
  let snapshot = initial
  const listeners = new Set()
  return {
    getSnapshot: () => snapshot,
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn) },
    set(value) { snapshot = value; for (const fn of [...listeners]) fn() },
    count: () => listeners.size
  }
}

async function boot() {
  let plugin, config = { selectedSkin: 'forest', notificationsEnabled: false }
  const effects = [], components = {}, notices = [], timers = new Map(), intervals = new Map(), formListeners = new Set()
  let nextTimer = 1
  const schedule = (fn, ms) => { const id = nextTimer++; timers.set(id, { fn, ms }); return id }
  const sessionStatus = store(new Map())
  const list = store({ byId: { s1: { running: false, retainedBy: { mainView: 1 } } } })
  const face = store({ sessionId: 's1', running: false, pending: [] })
  const services = { sessions: { list, binding: () => ({ session: face }) }, uiSession: { sessionStatus } }
  const form = {
    getSnapshot: () => ({ status: 'ready', writable: true, value: config }),
    subscribe(fn) { formListeners.add(fn); return () => formListeners.delete(fn) },
    async set(field, value) { config = { ...config, [field]: value }; for (const fn of formListeners) fn(); return true }
  }
  const React = {
    useSyncExternalStore: (_subscribe, snapshot) => snapshot(),
    createElement: (type, props, ...children) => ({ type, props: props ?? {}, children })
  }
  class Notification {
    static permission = 'default'
    static async requestPermission() { Notification.permission = 'granted'; return 'granted' }
    constructor(title, options) { notices.push({ title, options }) }
    close() {}
  }
  const body = { hasAttribute: () => false, getAttribute: () => null, setAttribute() {}, removeAttribute() {}, append() {}, style: {} }
  const ctx = {
    get: name => services[name],
    slots: { inject(_name, fn) { return fn() }, register(options, component) { components[options.name] = component; return () => { delete components[options.name] } } },
    configForms: { get: () => form, whileServed: (_ids, fn) => fn() },
    theme: { getTheme: () => ({ preference: 'system' }), setTheme() {}, overrideTokens: () => () => {} },
    effect(fn) { effects.push(fn()) }
  }
  const window = {
    location: { protocol: 'http:', href: 'http://127.0.0.1:3080/' },
    __ModuleLoader__: { load(value) { plugin = value.factory(() => React) } },
    setInterval(fn) { const id = nextTimer++; intervals.set(id, fn); return id },
    clearInterval(id) { intervals.delete(id) }, focus() {}
  }
  const sandbox = {
    window, Notification, URL, AbortController, console, navigator: { userAgent: 'Windows' },
    setTimeout: schedule, clearTimeout: id => timers.delete(id),
    document: { body, head: { append() {} }, createElement: () => ({ setAttribute() {}, addEventListener() {}, remove() {} }), querySelectorAll: () => [] },
    fetch: async () => ({ ok: true, json: async () => ({ themes: [{ id: 'forest', name: '森林', available: true, theme: null, character: {}, gaze: {}, notificationIcon: 'notification-heixiu.png' }] }) })
  }
  vm.runInNewContext(source, sandbox)
  plugin.apply(ctx)
  await new Promise(resolve => setImmediate(resolve))
  const controls = () => components['settings.section']().children[6]
  const flush = () => { for (const [id, timer] of [...timers]) { timers.delete(id); timer.fn() } }
  return { notices, Notification, form, controls, view: () => components['settings.section'](), sessionStatus, list, face, flush, timers, intervals, config: () => config, dispose: () => effects.reverse().forEach(fn => fn?.()) }
}

const status = (running, pendingInteraction = null, completionUnread = false) => ({ running, pendingInteraction, completionUnread })
const next = () => new Promise(resolve => setImmediate(resolve))

test('local notifications require opt-in and cover three kinds with deduplication, controls and cleanup', async () => {
  const h = await boot()
  h.sessionStatus.set(new Map([['s1', status(true, { kind: 'approval', key: 'old' })]]))
  assert.equal(h.notices.length, 0)
  assert.equal(h.config().notificationsEnabled, false)
  h.controls().children[2].props.onClick()
  await next()
  assert.equal(h.config().notificationsEnabled, true)
  assert.equal(h.notices.length, 1) // opt-in test, after permission
  assert.equal(h.notices[0].options.icon, 'http://127.0.0.1:3080/skin-assets/luoxiaohei/forest/notification-heixiu.png')
  h.notices.length = 0
  h.sessionStatus.set(new Map([['s1', status(true, { kind: 'approval', key: 'new' })]]))
  h.sessionStatus.set(new Map([['s1', status(true, { kind: 'approval', key: 'new' })]]))
  h.sessionStatus.set(new Map([['s1', status(true, { kind: 'question', key: 'q1' })]]))
  assert.deepEqual(h.notices.map(n => n.title), ['小黑 · 需要审批', '小黑 · 有问题需要回答'])
  h.notices.length = 0
  h.sessionStatus.set(new Map([['s1', status(false)]])) // a resolved wait is not completion
  h.flush()
  assert.equal(h.notices.length, 0)
  h.sessionStatus.set(new Map([['s1', status(true)]]))
  h.face.set({ running: true, pending: [] })
  h.face.set({ running: false, pending: [] })
  h.sessionStatus.set(new Map([['s1', status(false)]]))
  h.flush()
  assert.deepEqual(h.notices.map(n => n.title), ['小黑 · 本轮结束'])
  h.notices.length = 0
  const approvalCheckbox = h.controls().children[4]
  approvalCheckbox.children[0].props.onChange({ target: { checked: false } })
  await next()
  h.sessionStatus.set(new Map([['s1', status(true, { kind: 'approval', key: 'disabled' })]]))
  assert.equal(h.notices.length, 0)
  h.dispose()
  assert.equal(h.sessionStatus.count(), 0)
  assert.equal(h.list.count(), 0)
  assert.equal(h.face.count(), 0)
  assert.equal(h.intervals.size, 0)
  assert.equal(h.timers.size, 0)
})

test('a late approval cancels a queued completion and unsupported interactions do not notify', async () => {
  const h = await boot()
  h.controls().children[2].props.onClick(); await next(); h.notices.length = 0
  h.sessionStatus.set(new Map([['s1', status(true)]]))
  h.face.set({ running: true, pending: [] })
  h.face.set({ running: false, pending: [] })
  h.sessionStatus.set(new Map([['s1', status(false, { kind: 'approval', key: 'late' })]]))
  h.flush()
  assert.deepEqual(h.notices.map(n => n.title), ['小黑 · 需要审批'])
  h.sessionStatus.set(new Map([['s1', status(false, { kind: 'plan-review', key: 'plan' })]]))
  assert.equal(h.notices.length, 1)
  h.dispose()
})

test('denied permission leaves notifications disabled and shows the reason', async () => {
  const h = await boot()
  h.Notification.requestPermission = async () => 'denied'
  h.controls().children[2].props.onClick()
  await next()
  assert.equal(h.config().notificationsEnabled, false)
  assert.equal(h.notices.length, 0)
  assert.match(h.view().children[4].children[0], /未获授权/)
  h.dispose()
})

test('background sessions notify while background subagent steps stay quiet', async () => {
  const h = await boot()
  h.controls().children[2].props.onClick(); await next(); h.notices.length = 0
  h.list.set({ byId: {
    s1: { running: false, retainedBy: { mainView: 1 } },
    s2: { running: true, retainedBy: {} },
    child: { running: true, retainedBy: {}, origin: 'subagent' }
  } })
  h.sessionStatus.set(new Map([
    ['s2', status(true, { kind: 'question', key: 'bg' })],
    ['child', status(true, { kind: 'approval', key: 'child' })]
  ]))
  assert.deepEqual(h.notices.map(n => n.title), ['小黑 · 有问题需要回答'])
  h.dispose()
})

function request(method, { host = '127.0.0.1:3080', origin = 'dsh-app://app', remote = '127.0.0.1', marker = 'notify', body = '{"kind":"approval"}' } = {}) {
  const req = Readable.from(method === 'POST' ? [Buffer.from(body)] : [])
  req.method = method; req.headers = { host, origin, 'x-luoxiaohei-notify': marker }; req.socket = { remoteAddress: remote }
  return req
}
async function call(handler, req) {
  const res = { writeHead(status) { this.status = status; return this }, end(body) { this.body = JSON.parse(body); return this } }
  await handler(req, res)
  return res
}

test('macOS bridge accepts only local authenticated requests and fixed notification types', async () => {
  const calls = []
  const spawnFn = (path, args) => {
    calls.push({ path, args })
    const child = new EventEmitter(); child.stdout = new EventEmitter(); child.kill = () => {}
    process.nextTick(() => child.emit('close', 0))
    return child
  }
  const handler = createMacNotificationHandler({ helper: '/test/Helper.app/Contents/MacOS/bin', available: () => true, spawnFn, registerFn: async () => true })
  assert.equal((await call(handler, request('GET'))).body.available, true)
  assert.equal((await call(handler, request('POST'))).status, 200)
  assert.deepEqual(calls[0].args, ['--title', '小黑 · 需要审批', '--body', '请回到 DSH 查看审批请求。'])
  for (const options of [
    { host: 'evil.example:3080' }, { origin: 'https://evil.example' }, { remote: '192.168.1.3' }, { marker: '' }, { body: '{"kind":"__proto__"}' }
  ]) assert.notEqual((await call(handler, request('POST', options))).status, 200)
  assert.equal(calls.length, 1)
  const locked = createMacNotificationHandler({ connection: () => ({ requestRejection: () => 401 }), available: () => true })
  assert.equal((await call(locked, request('GET'))).status, 403)
  const missing = createMacNotificationHandler({ available: () => false })
  assert.equal((await call(missing, request('POST'))).body.reason, 'helper-unavailable')
})
