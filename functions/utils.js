export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' }
  })
}

export function nowISO() {
  return new Date().toISOString()
}

// 喂奶记录的保留策略：只保留近 N 小时的数据，但无论多久，最近 6 条永远保留。
// 「展示集 = 窗口内 ∪ 最近 6 条」与「删除集 = 全表 − 展示集」恒互斥，
// 所以不会出现「列表里显示了、清理时却被删掉」的情况。
export const RETENTION = { DEF_HOURS: 12, MIN_KEEP: 6 }

export function clampHours(v) {
  const n = Number(v)
  if (!Number.isFinite(n)) return RETENTION.DEF_HOURS
  return Math.min(72, Math.max(1, Math.round(n)))
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
