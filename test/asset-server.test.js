import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createAssetHandler, normalizeVisuals } from '../lib/index.js'

function response() {
  return { status: null, headers: null, body: undefined, writeHead(status, headers = {}) { this.status = status; this.headers = headers; return this }, end(body) { this.body = body; return this } }
}

test('validates theme ids, configured image names and semantic colors', () => {
  const normalized = normalizeVisuals({ themes: [
    { id: 'forest', name: '森林', tagline: ' 月下巡林 ', accent: '#93E7B3', theme: { colorScheme: 'dark', tokens: { '--dsw-alias-bg-base': '#123', '--other': 'red' } }, background: '../secret.png', backgroundAnimated: 'anim.webp', backgroundWindows: 'win.png', character: { working: 'working.png', idle: 'https://elsewhere/x.png' }, gaze: { working: 'gaze.png', unknown: '../bad.png' } },
    { id: '../bad', name: 'bad' }, { id: 'forest', name: 'duplicate' }
  ] })
  assert.equal(normalized.themes.length, 1)
  const skin = normalized.themes[0]
  assert.equal(skin.background, null)
  assert.equal(skin.backgroundWindows, 'win.png')
  assert.equal(skin.backgroundAnimated, 'anim.webp')
  assert.equal(skin.character.working, 'working.png')
  assert.equal(skin.character.idle, null)
  assert.deepEqual(skin.theme.tokens, { '--dsw-alias-bg-base': '#123' })
  assert.equal(skin.tagline, '月下巡林')
  assert.equal(skin.accent, '#93E7B3')
  assert.equal(skin.gaze.working, 'gaze.png')
  assert.equal(skin.gaze.unknown, null)
  assert.equal(normalizeVisuals({ themes: [{ id: 'x', name: 'x', accent: 'red; background:url(x)' }] }).themes[0].accent, null)
})

test('ships and serves the complete 小黑·森林 visual set', async () => {
  const visuals = normalizeVisuals(JSON.parse(await readFile(new URL('../assets/visuals.json', import.meta.url), 'utf8')))
  assert.equal(visuals.themes.length, 6)
  const forest = visuals.themes.find(theme => theme.id === 'xiaohei-forest')
  assert.equal(forest.available, true)
  assert.equal(forest.theme.colorScheme, 'dark')
  assert.ok(Object.keys(forest.theme.tokens).length >= 30)
  assert.equal(forest.character.working, 'working.webp')
  assert.equal(forest.character.waiting, 'waiting.webp')
  assert.equal(forest.character.idle, 'idle.webp')
  assert.equal(forest.character.unknown, 'unknown.webp')
  assert.equal(forest.gaze.working, 'working-gaze.webp')
  assert.equal(forest.gaze.waiting, 'waiting-gaze.webp')
  assert.equal(forest.gaze.idle, 'idle-gaze.webp')
  assert.equal(forest.gaze.unknown, null)
  assert.ok((await stat(new URL('../assets/xiaohei-forest/background.webp', import.meta.url))).size > 100_000)
  assert.ok((await stat(new URL('../assets/xiaohei-forest/background-win.webp', import.meta.url))).size > 100_000)
  assert.ok((await stat(new URL('../assets/xiaohei-forest/background-animated.webp', import.meta.url))).size > 100_000)
  for (const state of ['working', 'waiting', 'idle', 'unknown']) {
    assert.ok((await stat(new URL(`../assets/xiaohei-forest/${state}.webp`, import.meta.url))).size > 10_000)
  }
  for (const state of ['working', 'waiting', 'idle']) {
    assert.ok((await stat(new URL(`../assets/xiaohei-forest/${state}-gaze.webp`, import.meta.url))).size > 10_000)
  }
  assert.equal(visuals.themes.filter(theme => theme.available).length, 1)
  const handler = createAssetHandler()
  const res = response()
  await handler({ method: 'GET', url: '/skin-assets/luoxiaohei/xiaohei-forest/background.webp' }, res)
  assert.equal(res.status, 200)
  assert.equal(res.headers['Content-Type'], 'image/webp')
  const win = response()
  await handler({ method: 'GET', url: '/skin-assets/luoxiaohei/xiaohei-forest/background-win.webp' }, win)
  assert.equal(win.status, 200)
  assert.equal(win.headers['Content-Type'], 'image/webp')
  const anim = response()
  await handler({ method: 'GET', url: '/skin-assets/luoxiaohei/xiaohei-forest/background-animated.webp' }, anim)
  assert.equal(anim.status, 200)
  assert.equal(anim.headers['Content-Type'], 'image/webp')
  const gaze = response()
  await handler({ method: 'GET', url: '/skin-assets/luoxiaohei/xiaohei-forest/working-gaze.webp' }, gaze)
  assert.equal(gaze.status, 200)
  assert.equal(gaze.headers['Content-Type'], 'image/webp')
})

test('serves only each theme’s configured files and respects GET and HEAD', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-luoxiaohei-assets-'))
  try {
    await mkdir(join(dir, 'forest'))
    await mkdir(join(dir, 'mountain'))
    await writeFile(join(dir, 'visuals.json'), JSON.stringify({ themes: [
      { id: 'forest', name: '森林', background: 'background.png', character: { working: 'missing.png' } },
      { id: 'mountain', name: '山水', background: null }
    ] }))
    await writeFile(join(dir, 'forest', 'background.png'), 'image bytes')
    await writeFile(join(dir, 'forest', 'private.png'), 'not exposed')
    await writeFile(join(dir, 'mountain', 'background.png'), 'not configured here')
    const handler = createAssetHandler(pathToFileURL(`${dir}/`))
    let res = response(); await handler({ method: 'GET', url: '/skin-assets/luoxiaohei/forest/background.png' }, res)
    assert.equal(res.status, 200); assert.equal(res.headers['Content-Type'], 'image/png'); assert.equal(res.body.toString(), 'image bytes')
    res = response(); await handler({ method: 'HEAD', url: '/skin-assets/luoxiaohei/forest/background.png' }, res)
    assert.equal(res.status, 200); assert.equal(res.body, undefined)
    for (const path of ['forest/private.png', 'forest/missing.png', 'mountain/background.png', 'forest/../private.png']) {
      res = response(); await handler({ method: 'GET', url: `/skin-assets/luoxiaohei/${path}` }, res)
      assert.equal(res.status, 404)
    }
    res = response(); await handler({ method: 'POST', url: '/skin-assets/luoxiaohei/visuals.json' }, res)
    assert.equal(res.status, 405)
  } finally { await rm(dir, { recursive: true, force: true }) }
})
