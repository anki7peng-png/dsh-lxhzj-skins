const REPOSITORY = 'anki7peng-png/dsh-lxhzj-skins'
const PACKAGE_NAME = 'dsh-luoxiaohei-skins'
const COMMIT = /^[0-9a-f]{40}$/i
const VERSION = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/

export const UPDATE_ROUTE = '/__luoxiaohei-skins/update'

// Read the manifest at the exact commit returned by GitHub, not at a moving
// branch name. The Host will also verify the name and version while installing.
export async function latestMain(fetchImpl = fetch) {
  const signal = AbortSignal.timeout(15000)
  const options = { signal, headers: { Accept: 'application/vnd.github+json', 'User-Agent': PACKAGE_NAME }, cache: 'no-store' }
  const head = await fetchImpl(`https://api.github.com/repos/${REPOSITORY}/commits/main`, options)
  if (!head.ok) throw new Error('github-unavailable')
  const sha = (await head.json())?.sha
  if (typeof sha !== 'string' || !COMMIT.test(sha)) throw new Error('invalid-commit')
  const manifest = await fetchImpl(`https://raw.githubusercontent.com/${REPOSITORY}/${sha}/package.json`, options)
  if (!manifest.ok) throw new Error('manifest-unavailable')
  const pkg = await manifest.json()
  if (pkg?.name !== PACKAGE_NAME || typeof pkg.version !== 'string' || !VERSION.test(pkg.version) || !pkg.dsh?.bundle) {
    throw new Error('invalid-manifest')
  }
  return { version: pkg.version, commit: sha.toLowerCase() }
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
