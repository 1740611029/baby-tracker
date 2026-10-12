import { json, nowISO } from '../utils.js'

function normDue(v) {
  if (typeof v !== 'string' || !v.trim()) return null
  const d = new Date(v)
  return isNaN(d.getTime()) ? null : d.toISOString()
}

export async function onRequestGet({ env }) {
  const { results } = await env.DB.prepare(
    `SELECT id, title, done, pinned, due_time, created_at, completed_at,
            CASE WHEN image <> '' THEN 1 ELSE 0 END AS has_image
     FROM todos ORDER BY pinned DESC, done ASC, created_at DESC LIMIT 500`
  ).all()
  return json(results.map(t => ({
    id: t.id,
    title: t.title,
    done: t.done,
    pinned: t.pinned,
    due_time: t.due_time || null,
    created_at: t.created_at,
    completed_at: t.completed_at,
    image: t.has_image ? `/api/todo/image/${t.id}` : ''
  })))
}

export async function onRequestPost({ env, request }) {
  const body = await request.json().catch(() => null)
  const title = String(body?.title || '').trim().slice(0, 2000)
  if (!title) return json({ error: '标题不能为空' }, 400)
  const image = typeof body.image === 'string' && body.image.startsWith('data:image/') ? body.image : ''
  const due = normDue(body.due_time)
  const r = await env.DB.prepare(
    'INSERT INTO todos (title, image, done, pinned, due_time, created_at) VALUES (?, ?, 0, 0, ?, ?)'
  ).bind(title, image, due, nowISO()).run()
  return json({ ok: true, id: r.meta.last_row_id })
}
