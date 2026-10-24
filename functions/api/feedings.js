import { json, nowISO, clampHours, RETENTION } from '../utils.js'

function normTime(v) {
  if (typeof v !== 'string' || !v.trim()) return nowISO()
  const d = new Date(v)
  return isNaN(d.getTime()) ? nowISO() : d.toISOString()
}

// ?hours=12 → 返回「窗口内 ∪ 最近 6 条」。
// 前端不再做二次时间过滤，否则会把兜底的 6 条滤掉。
export async function onRequestGet({ env, request }) {
  const hours = clampHours(new URL(request.url).searchParams.get('hours'))
  const cutoff = new Date(Date.now() - hours * 3600e3).toISOString()

  const { results: inWindow } = await env.DB.prepare(
    'SELECT * FROM feedings WHERE feed_time >= ? ORDER BY feed_time DESC LIMIT 500'
  ).bind(cutoff).all()

  if (inWindow.length >= RETENTION.MIN_KEEP) return json(inWindow)

  // 窗口内不足 6 条：最近 6 条必然包含窗口内的全部行，直接用它兜底。
  // MIN_KEEP 是服务端常量整数，直接内联，避免 LIMIT 绑定参数的兼容性差异。
  const { results: latest } = await env.DB.prepare(
    `SELECT * FROM feedings ORDER BY feed_time DESC, id DESC LIMIT ${RETENTION.MIN_KEEP}`
  ).all()
  return json(latest)
}

export async function onRequestPost({ env, request }) {
  const body = await request.json().catch(() => null)
  if (!body) return json({ error: '请求格式错误' }, 400)
  const amount = parseInt(body.amount_ml, 10)
  if (!amount || amount < 1 || amount > 2000) return json({ error: '奶量无效' }, 400)
  // 统一归一化成 ISO，避免非标准时间字符串破坏字典序比较（清理和窗口查询都依赖它）
  const feedTime = normTime(body.feed_time)
  const note = String(body.note || '').slice(0, 100)
  const r = await env.DB.prepare(
    'INSERT INTO feedings (feed_time, amount_ml, note, created_at) VALUES (?, ?, ?, ?)'
  ).bind(feedTime, amount, note, nowISO()).run()
  return json({ ok: true, id: r.meta.last_row_id })
}
