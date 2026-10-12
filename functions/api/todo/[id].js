import { json, nowISO } from '../../utils.js'

function normDue(v) {
  if (typeof v !== 'string' || !v.trim()) return null
  const d = new Date(v)
  return isNaN(d.getTime()) ? null : d.toISOString()
}

export async function onRequestPost({ env, request, params }) {
  const body = await request.json().catch(() => ({}))
  const { results } = await env.DB.prepare('SELECT * FROM todos WHERE id = ?').bind(params.id).all()
  const row = results[0]
  if (!row) return json({ error: 'not found' }, 404)

  const title = body.title !== undefined ? String(body.title).trim().slice(0, 2000) : row.title
  if (!title) return json({ error: '标题不能为空' }, 400)

  let image = row.image
  if (typeof body.image === 'string') {
    if (body.image.startsWith('/api/')) image = row.image
    else if (body.image === '' || body.image.startsWith('data:image/')) image = body.image
  }

  const done = body.done !== undefined ? (body.done ? 1 : 0) : row.done
  const completedAt = done ? (row.done ? row.completed_at : nowISO()) : null
  const pinned = body.pinned !== undefined ? (body.pinned ? 1 : 0) : row.pinned
  const due = body.due_time !== undefined ? normDue(body.due_time) : (row.due_time || null)

  await env.DB.prepare(
    'UPDATE todos SET title = ?, image = ?, done = ?, pinned = ?, due_time = ?, completed_at = ? WHERE id = ?'
  ).bind(title, image, done, pinned, due, completedAt, params.id).run()
  return json({ ok: true })
}

export async function onRequestDelete({ env, params }) {
  await env.DB.prepare('DELETE FROM todos WHERE id = ?').bind(params.id).run()
  return json({ ok: true })
}
