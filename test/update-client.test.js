import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'

const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8')
const shaOld = 'a'.repeat(40), shaNew = 'b'.repeat(40)
const name = 'dsh-luoxiaohei-skins', repo = 'github:anki7peng-png/dsh-lxhzj-skins'
const own = { kind: 'bundle', pkg: { name } }
const flush = () => new Promise(resolve => setImmediate(resolve))

async function mount({ source: installedSource = `${repo}#${shaOld}`, update = 'git', response, onList, latest = { version: '0.1.18', commit: shaNew } } = {}) {
  const components = {}, effects = [], notices = [], calls = []
  let bundle = { name, version: '0.1.17', installed: true, availability: 'profile', official: false, removable: true, enabled: true, source: installedSource, update }
  const manager = {
    async listBundles() { if (onList) bundle = onList(bundle); return { ok: true, value: [bundle] } },
    async updateBundle(...args) { calls.push({ method: 'update', args }); return response ?? { ok: true, value: { result: { application: 'applied' } } } },
    async installBundle(...args) { calls.push({ method: 'install', args }); return response ?? { ok: true, value: { application: 'restart-required' } } }
  }
  const element = tag => ({ tagName: tag, style: {}, children: [], setAttribute() {}, append(...children) { this.children.push(...children) }, addEventListener() {}, remove() { this.removed = true } })
  const form = { getSnapshot: () => ({ status: 'ready', writable: true, value: { selectedSkin: 'default' } }), subscribe: () => () => {}, set: async () => true }
  const slots = {
    inject(_name, fn) { return fn() },
    register(options, value) { components[options.name] = value; return () => { delete components[options.name] } },
    entries() { return [] }
  }
  const ctx = {
    slots, remote: { pluginManager: manager },
    inject(_deps, fn) { fn(ctx) },
    effect(fn) { effects.push(fn()) },
    configForms: { get: () => form, whileServed: (_ids, fn) => fn() },
    theme: { getTheme: () => ({ preference: 'system' }), setTheme() {}, overrideTokens: () => () => {} }
  }
  const React = { useSyncExternalStore: (_subscribe, get) => get(), useEffect() {}, createElement: (type, props, ...children) => ({ type, props: props ?? {}, children }) }
  let plugin
  const sandbox = {
    window: { __ModuleLoader__: { load(value) { plugin = value.factory(() => React) } } },
    document: { body: { append(node) { notices.push(node) }, hasAttribute: () => false, getAttribute: () => null, removeAttribute() {}, style: {} }, head: { append() {} }, createElement: element },
    fetch: async url => ({ ok: true, json: async () => url.includes('/update') ? latest : { themes: [] } }),
    AbortController, console
  }
  vm.runInNewContext(source, sandbox)
  plugin.apply(ctx)
  await flush()
  const render = subject => components['plugins.detail.actions']({ subject })
  return { render, calls, notices, setBundle(value) { bundle = { ...bundle, ...value } }, dispose() { for (const effect of effects.reverse()) effect?.() } }
}

async function check(instance) {
  instance.render(own).children[0].props.onClick()
  await flush()
  return instance.render(own)
}

test('shows updates only for this bundle and uses DSH rollback-aware update for a pinned source', async () => {
  const instance = await mount()
  assert.equal(instance.render({ kind: 'bundle', pkg: { name: 'other' } }), null)
  assert.equal(instance.render({ kind: 'row', pkg: { name } }), null)
  assert.equal((await check(instance)).children[0].children[0], '更新到 0.1.18')
  instance.render(own).children[0].props.onClick()
  await flush()
  assert.equal(instance.calls.length, 1)
  assert.equal(instance.calls[0].method, 'update')
  assert.equal(instance.calls[0].args[0], name)
  assert.equal(instance.calls[0].args[1], '0.1.18')
  assert.equal(instance.calls[0].args[2].spec, `${repo}#${shaNew}`)
  assert.equal(instance.notices[0].children[0].textContent, '罗小黑皮肤已更新。')
  instance.dispose()
})

test('migrates a floating GitHub installation to an exact commit without removing it first', async () => {
  const instance = await mount({ source: repo, update: undefined })
  await check(instance)
  instance.render(own).children[0].props.onClick()
  await flush()
  assert.equal(instance.calls[0].method, 'install')
  assert.equal(instance.calls[0].args[0], `${repo}#${shaNew}`)
  assert.equal(instance.calls[0].args[1].enabled, true)
  assert.equal(instance.calls[0].args[1].expected.name, name)
  assert.equal(instance.calls[0].args[1].expected.version, '0.1.18')
  assert.match(instance.notices[0].children[0].textContent, /重启 DSH/)
  instance.dispose()
})

test('does not update a different source or a package whose source changed after checking', async () => {
  const other = await mount({ source: 'github:someone-else/dsh-lxhzj-skins' })
  const error = await check(other)
  assert.match(error.children[1].children[0], /安装来源不支持/)
  assert.equal(other.calls.length, 0)
  other.dispose()

  const changed = await mount()
  await check(changed)
  changed.setBundle({ source: repo, update: undefined })
  changed.render(own).children[0].props.onClick()
  await flush()
  assert.equal(changed.calls.length, 0)
  assert.match(changed.render(own).children[1].children[0], /安装状态已变化/)
  changed.dispose()
})

test('reports a failed update and successful rollback accurately', async () => {
  const instance = await mount({ response: { ok: true, value: { result: { application: 'failed' }, restore: { application: 'applied' } } } })
  await check(instance)
  instance.render(own).children[0].props.onClick()
  await flush()
  assert.equal(instance.notices[0].children[0].textContent, '更新失败，已恢复原版本。')
  instance.dispose()
})

test('explains when update metadata was found but GitHub download is unreachable', async () => {
  const instance = await mount({ response: { ok: true, value: { result: { application: 'failed', failedAt: 'spec-host' } } } })
  await check(instance)
  instance.render(own).children[0].props.onClick()
  await flush()
  assert.match(instance.notices[0].children[0].textContent, /无法连接 GitHub 下载/)
  instance.dispose()
})

test('does not offer an update when GitHub main is the same version or older', async () => {
  for (const version of ['0.1.17', '0.1.16']) {
    const instance = await mount({ latest: { version, commit: shaNew } })
    const result = await check(instance)
    assert.equal(result.children[0].children[0], '检查更新')
    assert.match(result.children[1].children[0], version === '0.1.17' ? /已是最新/ : /高于 GitHub main/)
    assert.equal(instance.calls.length, 0)
    instance.dispose()
  }
})
