import { json, nowISO } from '../utils.js'

export async function onRequestGet({ env }) {
  const { results } = await env.DB.prepare(
    'SELECT * FROM feedings ORDER BY feed_time DESC LIMIT 500'
  ).all()
  return json(results)
}

export async function onRequestPost({ env, request }) {
  const body = await request.json().catch(() => null)
  if (!body) return json({ error: '请求格式错误' }, 400)
  const amount = parseInt(body.amount_ml, 10)
  if (!amount || amount < 1 || amount > 2000) return json({ error: '奶量无效' }, 400)
  const feedTime = body.feed_time || nowISO()
  const note = String(body.note || '').slice(0, 100)
  const r = await env.DB.prepare(
    'INSERT INTO feedings (feed_time, amount_ml, note, created_at) VALUES (?, ?, ?, ?)'
  ).bind(feedTime, amount, note, nowISO()).run()
  return json({ ok: true, id: r.meta.last_row_id })
}
