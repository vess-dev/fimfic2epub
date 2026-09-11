import isNode from 'detect-node'

const FIMFICTION_ORIGIN = 'https://www.fimfiction.net'

// Fimfiction's image CDN serves WebP when the Accept header allows it, which
// not every e-reader can display, so only ask for widely supported types.
const ACCEPT = 'text/*, application/json, image/png, image/jpeg, image/gif, image/svg+xml'

const nodeConfig = {
  cookie: 'view_mature=true',
  userAgent: null
}

// Configure the Node.js fetch (used by the command line tool). Cookies copied
// from a browser session (together with the matching user agent) allow the
// tool to pass through Fimfiction's bot protection.
export function configureFetch ({ cookie, userAgent } = {}) {
  if (cookie !== undefined) {
    let value = String(cookie || '').trim().replace(/;\s*$/, '')
    if (!/(^|;\s*)view_mature=/.test(value)) {
      value = value ? value + '; view_mature=true' : 'view_mature=true'
    }
    nodeConfig.cookie = value
  }
  if (userAgent !== undefined) {
    nodeConfig.userAgent = userAgent || null
  }
}

export class CloudflareChallengeError extends Error {
  constructor (url) {
    super('Fimfiction answered with a Cloudflare bot-protection challenge for ' + url + '. ' +
      'Story pages and downloads are blocked for non-browser clients. ' +
      'Either use a Fimfiction API token (--token or the FIMFICTION_TOKEN environment variable), ' +
      'or pass the cookies of a logged-in browser session with --cookie together with the matching --user-agent.')
    this.name = 'CloudflareChallengeError'
    this.url = url
  }
}

function isCloudflareChallenge (response) {
  return response.headers.get('cf-mitigated') === 'challenge' ||
    (response.status === 403 && (response.headers.get('server') || '').toLowerCase() === 'cloudflare' &&
      (response.headers.get('content-type') || '').startsWith('text/html'))
}

async function fetchNode (url, responseType) {
  if (url.startsWith('/')) {
    url = FIMFICTION_ORIGIN + url
  }
  const headers = {
    accept: ACCEPT,
    cookie: nodeConfig.cookie,
    referer: FIMFICTION_ORIGIN + '/'
  }
  if (nodeConfig.userAgent) {
    headers['user-agent'] = nodeConfig.userAgent
  }
  const response = await globalThis.fetch(url, {
    method: 'GET',
    redirect: 'follow',
    headers
  })
  if (isCloudflareChallenge(response)) {
    throw new CloudflareChallengeError(url)
  }
  if (!response.ok) {
    throw new Error('HTTP ' + response.status + ' ' + response.statusText + ' fetching ' + url)
  }
  if (responseType) {
    return Buffer.from(await response.arrayBuffer())
  }
  return response.text()
}

async function fetchBrowser (url, responseType) {
  if (url.startsWith('/')) {
    url = globalThis.location.origin + url
  }
  let response
  try {
    response = await globalThis.fetch(url, {
      method: 'GET',
      mode: 'cors',
      credentials: 'include',
      cache: 'default',
      headers: { accept: ACCEPT }
    })
  } catch (err) {
    throw new Error('Error fetching ' + url + ' (' + (err && err.message ? err.message : err) + ')')
  }
  if (!response.ok) {
    throw new Error('HTTP ' + response.status + ' ' + response.statusText + ' fetching ' + url)
  }
  if (responseType === 'blob') {
    return response.blob()
  } else if (responseType === 'arraybuffer') {
    return response.arrayBuffer()
  }
  return response.text()
}

// responseType: undefined (text), 'arraybuffer' or 'blob'.
// In Node.js binary responses are resolved as a Buffer.
export default function fetch (url, responseType) {
  if (url.startsWith('//')) {
    url = 'https:' + url
  }
  if (isNode) {
    return fetchNode(url, responseType)
  }
  return fetchBrowser(url, responseType)
}
