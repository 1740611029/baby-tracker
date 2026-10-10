export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' }
  })
}

export function nowISO() {
  return new Date().toISOString()
}

export function etagOf(s) {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0
  return `"${(h >>> 0).toString(16)}"`
}

export function serveImage(dataUrl, request) {
  if (!dataUrl || typeof dataUrl !== 'string') return json({ error: 'not found' }, 404)
  const m = /^data:([\w/+.-]+);base64,(.+)$/.exec(dataUrl)
  if (!m) return json({ error: 'not found' }, 404)
  const etag = etagOf(dataUrl)
  const headers = {
    'Content-Type': m[1],
    'Cache-Control': 'private, max-age=86400',
    'ETag': etag
  }
  if (request.headers.get('If-None-Match') === etag) {
    return new Response(null, { status: 304, headers })
  }
  const bin = atob(m[2])
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new Response(bytes, { headers })
}
