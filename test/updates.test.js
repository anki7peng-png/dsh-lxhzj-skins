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

test('rejects invalid GitHub metadata and reports network failures', async () => {
  await assert.rejects(latestMain(async () => ok({ sha: '../main' })), /invalid-commit/)
  let count = 0
  await assert.rejects(latestMain(async () => ++count === 1 ? ok({ sha }) : ok({ ...manifest, name: 'other' })), /invalid-manifest/)
  count = 0
  await assert.rejects(latestMain(async () => ++count === 1 ? ok({ sha }) : ok({ ...manifest, version: '0.1.19-beta' })), /invalid-manifest/)
  await assert.rejects(latestMain(async () => ({ ok: false })), /github-unavailable/)

  const handler = createUpdateHandler(async () => { throw new Error('offline') })
  const res = { writeHead(status, headers = {}) { this.status = status; this.headers = headers; return this }, end(body) { this.body = body; return this } }
  await handler({ method: 'GET' }, res)
  assert.equal(res.status, 503)
  assert.deepEqual(JSON.parse(res.body), { error: 'update-check-failed' })
  await handler({ method: 'POST' }, res)
  assert.equal(res.status, 405)
  assert.equal(res.headers.Allow, 'GET')
})
