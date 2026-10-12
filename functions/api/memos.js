import { json, nowISO } from '../utils.js'

export async function onRequestGet({ env }) {
  const { results } = await env.DB.prepare(
    'SELECT id, title, content, images, pinned, created_at, updated_at FROM memos ORDER BY pinned DESC, updated_at DESC LIMIT 500'
  ).all()
  return json(results.map(m => {
    let imgs = []
    try { imgs = JSON.parse(m.images || '[]') } catch {}
    return {
      id: m.id,
      title: m.title,
      content: m.content,
      pinned: m.pinned,
      created_at: m.created_at,
      updated_at: m.updated_at,
      img_count: imgs.length
    }
  }))
}

export async function onRequestPost({ env, request }) {
  const body = await request.json().catch(() => null)
  const title = (body?.title || '').trim().slice(0, 100)
  if (!title) return json({ error: '标题不能为空' }, 400)
  const images = Array.isArray(body.images)
    ? body.images.filter(s => typeof s === 'string' && s.startsWith('data:image/')).slice(0, 9)
    : []
  const t = nowISO()
  const r = await env.DB.prepare(
    'INSERT INTO memos (title, content, images, pinned, created_at, updated_at) VALUES (?, ?, ?, 0, ?, ?)'
  ).bind(title, String(body.content || '').slice(0, 5000), JSON.stringify(images), t, t).run()
  return json({ ok: true, id: r.meta.last_row_id })
}
