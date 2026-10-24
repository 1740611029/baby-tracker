import { json, clampHours, RETENTION } from '../utils.js'

// 每次打开时清理：只删 feedings，events 一律不动。
// keep 数硬编码在服务端，客户端传参改不动 —— 最坏情况也只删到剩最近 6 条，不会清库。
export async function onRequestPost({ env, request }) {
  const body = await request.json().catch(() => ({}))
  const hours = clampHours(body?.hours)
  const cutoff = new Date(Date.now() - hours * 3600e3).toISOString()

  // SQLite 不支持 DELETE ... LIMIT，用子查询圈定要保留的 id。
  // id 是 NOT NULL 主键，NOT IN 没有 NULL 陷阱；MIN_KEEP 是常量整数，直接内联。
  const r = await env.DB.prepare(
    `DELETE FROM feedings
      WHERE feed_time < ?
        AND id NOT IN (
          SELECT id FROM feedings ORDER BY feed_time DESC, id DESC LIMIT ${RETENTION.MIN_KEEP}
        )`
  ).bind(cutoff).run()

  return json({ ok: true, deleted: r.meta?.changes ?? 0, cutoff })
}
