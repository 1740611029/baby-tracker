import { json, nowISO } from '../utils.js'

export async function onRequestGet({ env }) {
  const { results } = await env.DB.prepare(
    'SELECT * FROM events ORDER BY event_time DESC LIMIT 500'
  ).all()
  return json(results)
}

export async function onRequestPost({ env, request }) {
  const body = await request.json().catch(() => null)
  if (!body) return json({ error: '请求格式错误' }, 400)
  const title = String(body.title || '').trim().slice(0, 100)
  if (!title) return json({ error: '事件不能为空' }, 400)
  const eventTime = body.event_time || nowISO()
  const note = String(body.note || '').slice(0, 200)
  const r = await env.DB.prepare(
    'INSERT INTO events (title, event_time, note, created_at) VALUES (?, ?, ?, ?)'
  ).bind(title, eventTime, note, nowISO()).run()
  return json({ ok: true, id: r.meta.last_row_id })
}
