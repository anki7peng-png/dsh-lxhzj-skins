import { readFile } from 'node:fs/promises'
import { readFileSync } from 'node:fs'
import z from '@deepseek-ai/schemastery'

export const name = 'luoxiaohei-skins'
export const Config = z.object({
  selectedSkin: z.string().default('default').volatile()
    .description('选择的罗小黑系列皮肤；default 为 DSH 原始界面')
})

const PREFIX = '/skin-assets/luoxiaohei'
const ROOT = new URL('../assets/', import.meta.url)
const MIME = { '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg' }
const SAFE_FILE = /^[a-zA-Z0-9][a-zA-Z0-9_-]*\.(?:png|webp|jpe?g)$/i
const SAFE_ID = /^[a-z][a-z0-9-]{0,63}$/

function filename(value) {
  return typeof value === 'string' && SAFE_FILE.test(value) ? value : null
}

function normalizeSkin(input) {
  const character = input.character && typeof input.character === 'object' ? input.character : {}
  const rawTheme = input.theme && typeof input.theme === 'object' ? input.theme : null
  const theme = rawTheme && ['light', 'dark'].includes(rawTheme.colorScheme) && rawTheme.tokens && typeof rawTheme.tokens === 'object' && !Array.isArray(rawTheme.tokens)
    ? { colorScheme: rawTheme.colorScheme, tokens: Object.fromEntries(Object.entries(rawTheme.tokens).filter(([key, v]) => /^--dsw-(?:alias|specific)-[a-z0-9-]+$/.test(key) && typeof v === 'string')) }
    : null
  const background = filename(input.background)
  const backgroundWindows = filename(input.backgroundWindows)
  const characters = Object.fromEntries(['working', 'waiting', 'idle', 'unknown'].map(key => [key, filename(character[key])]))
  const rawGaze = input.gaze && typeof input.gaze === 'object' ? input.gaze : {}
  const gaze = Object.fromEntries(['working', 'waiting', 'idle', 'unknown'].map(key => [key, filename(rawGaze[key])]))
  const tagline = typeof input.tagline === 'string' ? input.tagline.trim().slice(0, 80) : ''
  const accent = typeof input.accent === 'string' && /^#[0-9a-f]{3,8}$/i.test(input.accent.trim()) ? input.accent.trim() : null
  return {
    id: input.id,
    name: input.name.trim(),
    tagline,
    accent,
    theme,
    background,
    backgroundWindows,
    character: characters,
    gaze,
    available: Boolean(theme || background || backgroundWindows || Object.values(characters).some(Boolean) || Object.values(gaze).some(Boolean))
  }
}

export function normalizeVisuals(value) {
  const items = Array.isArray(value?.themes) ? value.themes : []
  const seen = new Set()
  const themes = []
  for (const item of items) {
    if (!item || typeof item !== 'object' || typeof item.id !== 'string' || !SAFE_ID.test(item.id) || item.id === 'default' || seen.has(item.id) || typeof item.name !== 'string' || !item.name.trim()) continue
    seen.add(item.id)
    themes.push(normalizeSkin(item))
  }
  return { themes }
}

export function createAssetHandler(root = ROOT) {
  let visuals
  try {
    visuals = normalizeVisuals(JSON.parse(readFileSync(new URL('visuals.json', root), 'utf8')))
  } catch (error) {
    console.warn('[luoxiaohei-skins] Unable to read visuals.json; using empty visuals.', error.message)
    visuals = normalizeVisuals({})
  }
  const allowed = new Set(visuals.themes.flatMap(skin => [skin.background, skin.backgroundWindows, ...Object.values(skin.character), ...Object.values(skin.gaze)].filter(Boolean).map(file => `${skin.id}/${file}`)))
  return async function handler(req, res) {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { Allow: 'GET, HEAD' }).end()
      return
    }
    const pathname = new URL(req.url ?? '/', 'http://localhost').pathname
    if (pathname === `${PREFIX}/visuals.json`) {
      const bytes = Buffer.from(JSON.stringify(visuals))
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': bytes.length, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' })
      res.end(req.method === 'HEAD' ? undefined : bytes)
      return
    }
    const path = pathname.startsWith(`${PREFIX}/`) ? pathname.slice(PREFIX.length + 1) : ''
    const [id, name, ...rest] = path.split('/')
    if (!SAFE_ID.test(id) || !SAFE_FILE.test(name ?? '') || rest.length || !allowed.has(path)) {
      res.writeHead(404).end()
      return
    }
    try {
      const bytes = await readFile(new URL(`${id}/${name}`, root))
      const extension = name.slice(name.lastIndexOf('.')).toLowerCase()
      res.writeHead(200, { 'Content-Type': MIME[extension], 'Content-Length': bytes.length, 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' })
      res.end(req.method === 'HEAD' ? undefined : bytes)
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error
      res.writeHead(404).end()
    }
  }
}

export function apply(ctx) {
  ctx.inject(['webServer'], webCtx => {
    webCtx.effect(() => {
      const handler = createAssetHandler()
      return webCtx.webServer.register({ kind: 'prefix', path: PREFIX, handler })
    }, 'luoxiaohei-skins: local presentation assets')
  })
}
