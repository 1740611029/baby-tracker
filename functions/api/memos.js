import { json, nowISO, IMAGE_LIMITS, tooLargeImages } from '../utils.js'

export async function onRequestGet({ env }) {
  // 只在 SQL 里算张数，不把每行几 MB 的 base64 搬进 Worker 再 JSON.parse
  const { results } = await env.DB.prepare(
    `SELECT id, title, content, pinned, created_at, updated_at,
            CASE WHEN images IS NULL OR json_valid(images) = 0 THEN 0
                 ELSE json_array_length(images) END AS img_count
     FROM memos ORDER BY pinned DESC, updated_at DESC LIMIT 500`
  ).all()
  return json(results.map(m => ({ ...m, img_count: m.img_count || 0 })))
}

export async function onRequestPost({ env, request }) {
  const body = await request.json().catch(() => null)
  const title = (body?.title || '').trim().slice(0, 100)
  if (!title) return json({ error: '标题不能为空' }, 400)
  const images = Array.isArray(body.images)
    ? body.images.filter(s => typeof s === 'string' && s.startsWith('data:image/')).slice(0, IMAGE_LIMITS.MAX_COUNT)
    : []
  const tooBig = tooLargeImages(images)
  if (tooBig) return json({ error: tooBig }, 413)
  const t = nowISO()
  const r = await env.DB.prepare(
    'INSERT INTO memos (title, content, images, pinned, created_at, updated_at) VALUES (?, ?, ?, 0, ?, ?)'
  ).bind(title, String(body.content || '').slice(0, 5000), JSON.stringify(images), t, t).run()
  return json({ ok: true, id: r.meta.last_row_id })
}
