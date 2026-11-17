const REPOSITORY = 'anki7peng-png/dsh-lxhzj-skins'
const PACKAGE_NAME = 'dsh-luoxiaohei-skins'
const COMMIT = /^[0-9a-f]{40}$/i
const VERSION = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/
const DIRECT = { prefix: '', timeout: 5000 }
const MIRRORS = [
  { prefix: 'https://gh-proxy.com/', timeout: 10000 },
  { prefix: 'https://gh-proxy.org/', timeout: 10000 },
  { prefix: 'https://ghfast.top/', timeout: 10000, gitRefs: true },
  { prefix: 'https://ghproxy.net/', timeout: 10000, gitRefs: true }
]

export const UPDATE_ROUTE = '/__luoxiaohei-skins/update'

function mainCommitFromGitRefs(advertisement) {
  const bytes = Buffer.from(advertisement)
  if (bytes.length > 256_000) throw new Error('invalid-refs')
  let offset = 0
  while (offset + 4 <= bytes.length) {
    const header = bytes.toString('ascii', offset, offset + 4)
    if (!/^[0-9a-f]{4}$/i.test(header)) throw new Error('invalid-refs')
    const length = parseInt(header, 16)
    offset += 4
    if (length === 0) continue
    if (length < 4 || offset + length - 4 > bytes.length) throw new Error('invalid-refs')
    const packet = bytes.toString('utf8', offset, offset + length - 4)
    offset += length - 4
    const match = packet.match(/^([0-9a-f]{40}) refs\/heads\/main(?:\x00[^\n]*)?\n?$/i)
    if (match) return match[1]
  }
  throw new Error('invalid-refs')
}

// Read each manifest at the exact commit from the same source, not at a moving
// branch name. The Host also verifies the name and version while installing.
async function readMain(fetchImpl, { prefix, timeout, gitRefs }, cancel) {
  const timeoutSignal = AbortSignal.timeout(timeout)
  const signal = cancel ? AbortSignal.any([timeoutSignal, cancel]) : timeoutSignal
  const options = { signal, headers: { Accept: gitRefs ? '*/*' : 'application/vnd.github+json', 'User-Agent': PACKAGE_NAME }, cache: 'no-store' }
  const headUrl = gitRefs
    ? `https://github.com/${REPOSITORY}.git/info/refs?service=git-upload-pack`
    : `https://api.github.com/repos/${REPOSITORY}/commits/main`
  const head = await fetchImpl(`${prefix}${headUrl}`, options)
  if (!head.ok) throw new Error('github-unavailable')
  const sha = gitRefs ? mainCommitFromGitRefs(await head.arrayBuffer()) : (await head.json())?.sha
  if (typeof sha !== 'string' || !COMMIT.test(sha)) throw new Error('invalid-commit')
  const manifest = await fetchImpl(`${prefix}https://raw.githubusercontent.com/${REPOSITORY}/${sha}/package.json`, options)
  if (!manifest.ok) throw new Error('manifest-unavailable')
  const pkg = await manifest.json()
  if (pkg?.name !== PACKAGE_NAME || typeof pkg.version !== 'string' || !VERSION.test(pkg.version) || !pkg.dsh?.bundle) {
    throw new Error('invalid-manifest')
  }
  return { version: pkg.version, commit: sha.toLowerCase() }
}

export async function latestMain(fetchImpl = fetch) {
  try { return await readMain(fetchImpl, DIRECT) }
  catch { /* A timeout, invalid response, or connection error can use the mirrors. */ }
  const cancel = new AbortController()
  try {
    return await Promise.any(MIRRORS.map(source => readMain(fetchImpl, source, cancel.signal)))
  } catch {
    throw new Error('update-check-failed')
  } finally {
    cancel.abort()
  }
}

export function createUpdateHandler(fetchImpl = fetch) {
  return async (req, res) => {
    if (req.method !== 'GET') {
      res.writeHead(405, { Allow: 'GET' }).end()
      return
    }
    let status = 200
    let result
    try { result = await latestMain(fetchImpl) }
    catch { status = 503; result = { error: 'update-check-failed' } }
    const body = Buffer.from(JSON.stringify(result))
    res.writeHead(status, {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Length': body.length,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff'
    })
    res.end(body)
  }
}
