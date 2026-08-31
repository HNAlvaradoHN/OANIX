const BASE_URL = process.env.OANIX_PAGES_BASE_URL ?? 'https://hnalvaradohn.github.io/OANIX/'
const CACHE_BUSTER = process.env.GITHUB_SHA ?? Date.now().toString()
const RETRIES = 8
const RETRY_DELAY_MS = 3000

function withSmokeQuery(url) {
  const next = new URL(url)
  next.searchParams.set('oanix_smoke', CACHE_BUSTER)
  return next
}

async function fetchWithRetry(url) {
  let lastError

  for (let attempt = 1; attempt <= RETRIES; attempt += 1) {
    try {
      const response = await fetch(url, { redirect: 'follow' })
      if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`)
      return response
    } catch (error) {
      lastError = error
      if (attempt === RETRIES) break
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS))
    }
  }

  throw lastError
}

const shellUrl = withSmokeQuery(BASE_URL)
const html = await (await fetchWithRetry(shellUrl)).text()
const cssPath = html.match(/href="(\/OANIX\/assets\/[^"]+\.css)"/)?.[1]
const jsPath = html.match(/src="(\/OANIX\/assets\/[^"]+\.js)"/)?.[1]

if (!cssPath || !jsPath) {
  throw new Error('Deployed shell does not reference the expected OANIX CSS and JS assets.')
}

const origin = new URL(BASE_URL).origin
const cssUrl = withSmokeQuery(new URL(cssPath, origin))
const jsUrl = withSmokeQuery(new URL(jsPath, origin))
const [css, js] = await Promise.all([
  (await fetchWithRetry(cssUrl)).text(),
  (await fetchWithRetry(jsUrl)).text(),
])

if (Buffer.byteLength(css) <= 10000) throw new Error('Deployed CSS bundle is unexpectedly small.')
if (Buffer.byteLength(js) <= 10000) throw new Error('Deployed JS bundle is unexpectedly small.')
if (!css.includes('.vault-shell')) throw new Error('Deployed CSS bundle is missing the vault shell marker.')
if (!css.includes('.rebuild-shell')) throw new Error('Deployed CSS bundle is missing the active rebuild shell marker.')
if (!js.includes('encrypted_records_v2')) throw new Error('Deployed JS bundle is missing the encrypted v2 storage marker.')

console.log(`Verified deployed OANIX shell: ${cssPath} and ${jsPath}`)
