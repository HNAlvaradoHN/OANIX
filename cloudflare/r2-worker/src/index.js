const OBJECT_KEY_RE = /^[A-Za-z0-9_-]{1,240}$/

function corsHeaders(request, env) {
  const origin = request.headers.get('Origin') || ''
  const allowed = (env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
  const allowOrigin = allowed.includes(origin) ? origin : ''
  return {
    ...(allowOrigin ? { 'Access-Control-Allow-Origin': allowOrigin, Vary: 'Origin' } : {}),
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Allow-Methods': 'GET, PUT, DELETE, OPTIONS',
    'Access-Control-Max-Age': '86400',
  }
}

function response(request, env, body, status = 200, extraHeaders = {}) {
  return new Response(body, {
    status,
    headers: {
      ...corsHeaders(request, env),
      ...extraHeaders,
    },
  })
}

async function authenticatedUser(request, env) {
  const authorization = request.headers.get('Authorization') || ''
  if (!authorization.startsWith('Bearer ')) return null
  const token = authorization.slice('Bearer '.length).trim()
  if (!token) return null

  const authResponse = await fetch(`${env.SUPABASE_URL.replace(/\/$/, '')}/auth/v1/user`, {
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: env.SUPABASE_PUBLISHABLE_KEY,
    },
  })
  if (!authResponse.ok) return null
  const user = await authResponse.json()
  return typeof user?.id === 'string' && user.id ? user : null
}

function objectKeyFromUrl(request) {
  const url = new URL(request.url)
  const match = url.pathname.match(/^\/v1\/objects\/([^/]+)$/)
  if (!match) return null
  let key
  try {
    key = decodeURIComponent(match[1])
  } catch {
    return null
  }
  return OBJECT_KEY_RE.test(key) ? key : null
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return response(request, env, null, 204)
    }

    const objectKey = objectKeyFromUrl(request)
    if (!objectKey) return response(request, env, 'Not found', 404)

    const user = await authenticatedUser(request, env)
    if (!user) return response(request, env, 'Unauthorized', 401)

    // The user id is server-derived from the validated Supabase token. Clients never choose another user's prefix.
    const storageKey = `${user.id}/${objectKey}`

    if (request.method === 'PUT') {
      const body = await request.arrayBuffer()
      if (body.byteLength === 0) return response(request, env, 'Empty object', 400)
      await env.OANIX_R2.put(storageKey, body, {
        httpMetadata: { contentType: 'application/json; charset=utf-8' },
      })
      return response(request, env, null, 204)
    }

    if (request.method === 'GET') {
      const object = await env.OANIX_R2.get(storageKey)
      if (!object) return response(request, env, 'Not found', 404)
      return response(request, env, object.body, 200, {
        'Content-Type': object.httpMetadata?.contentType || 'application/octet-stream',
        ETag: object.httpEtag,
        'Cache-Control': 'private, no-store',
      })
    }

    if (request.method === 'DELETE') {
      await env.OANIX_R2.delete(storageKey)
      return response(request, env, null, 204)
    }

    return response(request, env, 'Method not allowed', 405)
  },
}
