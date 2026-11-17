import test from 'node:test'
import assert from 'node:assert/strict'
import { createUpdateHandler, latestMain } from '../lib/updates.js'

const sha = 'a'.repeat(40)
const manifest = { name: 'dsh-luoxiaohei-skins', version: '0.1.18', dsh: { bundle: { patch: './cordis.patch.yml' } } }
const ok = value => ({ ok: true, async json() { return value } })

test('reads the main manifest at the exact GitHub commit', async () => {
  const calls = []
  const fetch = async (url, options) => {
    calls.push({ url, options })
    return calls.length === 1 ? ok({ sha }) : ok(manifest)
  }
  assert.deepEqual(await latestMain(fetch), { version: '0.1.18', commit: sha })
  assert.match(calls[0].url, /github\.com\/repos\/anki7peng-png\/dsh-lxhzj-skins\/commits\/main$/)
  assert.equal(calls[1].url, `https://raw.githubusercontent.com/anki7peng-png/dsh-lxhzj-skins/${sha}/package.json`)
  assert.equal(calls[0].options.signal, calls[1].options.signal)
})

test('retries through the GitHub mirror when direct access fails', async () => {
  const calls = []
  const fetch = async (url, options) => {
    calls.push({ url, options })
    if (!url.startsWith('https://gh-proxy.com/')) throw new Error('network')
    return url.includes('api.github.com/') ? ok({ sha }) : ok(manifest)
  }
  assert.deepEqual(await latestMain(fetch), { version: '0.1.18', commit: sha })
  const mirror = calls.filter(call => call.url.startsWith('https://gh-proxy.com/'))
  assert.equal(mirror.length, 2)
  assert.equal(mirror[0].url, 'https://gh-proxy.com/https://api.github.com/repos/anki7peng-png/dsh-lxhzj-skins/commits/main')
  assert.equal(mirror[1].url, `https://gh-proxy.com/https://raw.githubusercontent.com/anki7peng-png/dsh-lxhzj-skins/${sha}/package.json`)
  assert.equal(mirror[0].options.signal, mirror[1].options.signal)
  assert.notEqual(calls[0].options.signal, mirror[0].options.signal)
})

test('uses the second mirror when GitHub and the first mirror fail', async () => {
  const fetch = async url => {
    if (!url.startsWith('https://gh-proxy.org/')) throw new Error('network')
    return url.includes('api.github.com/') ? ok({ sha }) : ok(manifest)
  }
  assert.deepEqual(await latestMain(fetch), { version: '0.1.18', commit: sha })
})

test('uses Git refs when the API mirrors are unavailable', async () => {
  const packet = value => (Buffer.byteLength(value) + 4).toString(16).padStart(4, '0') + value
  const refs = packet('# service=git-upload-pack\n') + '0000' + packet(`${sha} HEAD\0caps\n`) + packet(`${sha} refs/heads/测试\n`) + packet(`${sha} refs/heads/main\n`) + '0000'
  const calls = []
  const fetch = async url => {
    calls.push(url)
    if (!url.startsWith('https://ghfast.top/')) throw new Error('network')
    return url.includes('/info/refs?') ? { ok: true, async arrayBuffer() { return Buffer.from(refs) } } : ok(manifest)
  }
  assert.deepEqual(await latestMain(fetch), { version: '0.1.18', commit: sha })
  assert.ok(calls.includes(`https://ghfast.top/https://raw.githubusercontent.com/anki7peng-png/dsh-lxhzj-skins/${sha}/package.json`))
})

test('does not accept a malformed or unrelated Git ref', async () => {
  const packet = value => (Buffer.byteLength(value) + 4).toString(16).padStart(4, '0') + value
  for (const refs of [`ffff${sha} refs/heads/main\n`, packet(`${sha} refs/heads/main-other\n`)]) {
    const fetch = async url => {
      if (!url.startsWith('https://ghfast.top/')) throw new Error('network')
      return { ok: true, async arrayBuffer() { return Buffer.from(refs) } }
    }
    await assert.rejects(latestMain(fetch), /update-check-failed/)
  }
})

test('rechecks both the commit and manifest through the mirror when the direct manifest is invalid', async () => {
  const seen = []
  const fetch = async url => {
    seen.push(url)
    if (url.includes('api.github.com/')) return ok({ sha })
    return ok(url.startsWith('https://gh-proxy.com/') ? manifest : { ...manifest, name: 'other' })
  }
  assert.deepEqual(await latestMain(fetch), { version: '0.1.18', commit: sha })
  assert.ok(seen.length >= 5)
  assert.ok(seen.some(url => url.startsWith('https://gh-proxy.com/https://api.github.com/')))
  assert.ok(seen.some(url => url.startsWith('https://gh-proxy.com/https://raw.githubusercontent.com/')))
})

test('rejects invalid metadata from both sources and reports network failures', async () => {
  await assert.rejects(latestMain(async () => ok({ sha: '../main' })), /update-check-failed/)
  const invalidManifest = value => async url => url.includes('api.github.com/') ? ok({ sha }) : ok({ ...manifest, ...value })
  await assert.rejects(latestMain(invalidManifest({ name: 'other' })), /update-check-failed/)
  await assert.rejects(latestMain(invalidManifest({ version: '0.1.19-beta' })), /update-check-failed/)
  await assert.rejects(latestMain(async () => ({ ok: false })), /update-check-failed/)

  const handler = createUpdateHandler(async () => { throw new Error('offline') })
  const res = { writeHead(status, headers = {}) { this.status = status; this.headers = headers; return this }, end(body) { this.body = body; return this } }
  await handler({ method: 'GET' }, res)
  assert.equal(res.status, 503)
  assert.deepEqual(JSON.parse(res.body), { error: 'update-check-failed' })
  await handler({ method: 'POST' }, res)
  assert.equal(res.status, 405)
  assert.equal(res.headers.Allow, 'GET')
})
