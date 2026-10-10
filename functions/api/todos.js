import { json, nowISO } from '../utils.js'

export async function onRequestGet({ env }) {
  const { results } = await env.DB.prepare(
    `SELECT id, title, done, created_at, completed_at,
            CASE WHEN image <> '' THEN 1 ELSE 0 END AS has_image
     FROM todos ORDER BY done ASC, created_at DESC LIMIT 500`
  ).all()
  return json(results.map(t => ({
    id: t.id,
    title: t.title,
    done: t.done,
    created_at: t.created_at,
    completed_at: t.completed_at,
    image: t.has_image ? `/api/todo/image/${t.id}` : ''
  })))
}

export async function onRequestPost({ env, request }) {
  const body = await request.json().catch(() => null)
  const title = (body?.title || '').trim().slice(0, 100)
  if (!title) return json({ error: '标题不能为空' }, 400)
  const image = typeof body.image === 'string' && body.image.startsWith('data:image/') ? body.image : ''
  const r = await env.DB.prepare(
    'INSERT INTO todos (title, image, done, created_at) VALUES (?, ?, 0, ?)'
  ).bind(title, image, nowISO()).run()
  return json({ ok: true, id: r.meta.last_row_id })
}
