// Local macOS Desktop notification bridge. No network relay or approval actions.
import { execFile, spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

export const MAC_NOTIFICATION_ROUTE = '/__luoxiaohei-skins/notification'
const HELPER = fileURLToPath(new URL('../macos/Luoxiaohei Notify.app/Contents/MacOS/luoxiaohei-notify', import.meta.url))
const LSREGISTER = '/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister'
const MESSAGES = {
  completion: ['小黑 · 本轮结束', '请回到 DSH 查看结果。'],
  approval: ['小黑 · 需要审批', '请回到 DSH 查看审批请求。'],
  question: ['小黑 · 有问题需要回答', '请回到 DSH 查看问题。'],
  test: ['小黑 · 通知测试', '这是一条系统通知测试。']
}

function loopback(host) {
  return host === 'localhost' || host === '::1' || /^127(?:\.\d{1,3}){3}$/.test(host)
}

// The desktop forwards requests to localhost. Require both the loopback peer
// and a loopback Host, then enforce the desktop or same-origin page and DSH's
// own authentication when the host exposes it.
function admitted(req, connection) {
  try {
    const service = typeof connection === 'function' ? connection() : connection
    if (typeof service?.requestRejection === 'function' && typeof service.requestRejection(req) === 'number') return false
    const peer = String(req.socket?.remoteAddress ?? '').replace(/^::ffff:/i, '').toLowerCase()
    if (!loopback(peer)) return false
    const rawHost = req.headers.host
    if (typeof rawHost !== 'string' || !/^(?:\[[0-9a-f:]+\]|[a-z0-9.-]+)(?::\d{1,5})?$/i.test(rawHost)) return false
    const host = new URL(`http://${rawHost}`)
    if (!loopback(host.hostname.replace(/^\[|\]$/g, '').toLowerCase())) return false
    const origin = req.headers.origin
    if (!origin || origin === 'dsh-app://app') return true
    const parsed = new URL(origin)
    if (!['http:', 'https:'].includes(parsed.protocol)) return false
    const originPort = parsed.port || (parsed.protocol === 'https:' ? '443' : '80')
    const hostPort = host.port || (req.socket?.encrypted ? '443' : '80')
    return parsed.hostname.toLowerCase() === host.hostname.toLowerCase() && originPort === hostPort
  } catch { return false }
}

function respond(res, status, body) {
  const text = JSON.stringify(body)
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Content-Length': Buffer.byteLength(text) })
  res.end(text)
}

function readBody(req) {
  return new Promise(resolve => {
    let bytes = 0, overflow = false, done = false
    const chunks = []
    const finish = value => { if (!done) { done = true; resolve(value) } }
    req.on('data', chunk => {
      bytes += chunk.length
      if (bytes > 2048) { overflow = true; chunks.length = 0 } else if (!overflow) chunks.push(chunk)
    })
    req.on('end', () => finish(overflow ? null : Buffer.concat(chunks).toString('utf8')))
    req.on('error', () => finish(null))
    req.on('close', () => finish(null))
  })
}

function runHelper(spawnFn, helper, title, body) {
  return new Promise(resolve => {
    let child, result = '', done = false
    const finish = (ok, reason) => { if (!done) { done = true; clearTimeout(timer); resolve({ ok, reason }) } }
    let timer
    try { child = spawnFn(helper, ['--title', title, '--body', body], { stdio: ['ignore', 'pipe', 'ignore'] }) } catch { finish(false, 'spawn-failed'); return }
    timer = setTimeout(() => { try { child.kill() } catch {} finish(false, 'timeout') }, 25000)
    child.stdout?.on('data', chunk => { result = (result + chunk).slice(0, 200) })
    child.on('error', () => finish(false, 'spawn-failed'))
    child.on('close', code => finish(code === 0, code === 0 ? 'sent' : result.includes('not-authorized') ? 'not-authorized' : 'helper-failed'))
  })
}

function registerHelper(helper) {
  const app = dirname(dirname(dirname(helper)))
  return new Promise(resolve => execFile(LSREGISTER, ['-f', app], { timeout: 5000 }, error => resolve(!error)))
}

export function createMacNotificationHandler({ connection, helper = HELPER, available = () => existsSync(helper), spawnFn = spawn, registerFn = registerHelper } = {}) {
  let registration
  return async (req, res) => {
    if (!['GET', 'POST'].includes(req.method)) return respond(res, 405, { ok: false, reason: 'method-not-allowed' })
    if (!admitted(req, connection)) return respond(res, 403, { ok: false, reason: 'forbidden' })
    if (req.method === 'GET') return respond(res, 200, { ok: true, available: available() })
    if (req.headers['x-luoxiaohei-notify'] !== 'notify') return respond(res, 403, { ok: false, reason: 'forbidden' })
    if (!available()) return respond(res, 503, { ok: false, reason: 'helper-unavailable' })
    const body = await readBody(req)
    let kind
    try { kind = JSON.parse(body)?.kind } catch { /* invalid body */ }
    if (typeof kind !== 'string' || !Object.hasOwn(MESSAGES, kind)) return respond(res, 400, { ok: false, reason: 'invalid-kind' })
    registration ??= Promise.resolve().then(() => registerFn(helper)).catch(() => false)
    if (!await registration) { registration = undefined; return respond(res, 502, { ok: false, reason: 'registration-failed' }) }
    const [title, message] = MESSAGES[kind]
    const result = await runHelper(spawnFn, helper, title, message)
    respond(res, result.ok ? 200 : 502, result)
  }
}
