import { json, RETENTION, readSettings } from '../utils.js'

// 每次打开时清理：只删 feedings，events 一律不动。
// 窗口不再信任客户端传参，改由服务端从 settings 表读取权威值 ——
// 这样冷启动时不必等前端同步完设置，也堵掉了「随便传个 hours=1 就能清库」的口子。
// keep 数硬编码在服务端，最坏情况也只删到剩最近 6 条。
export async function onRequestPost({ env }) {
  // 表还没建（迁移没跑）时也按「没有权威窗口」处理，不让清理接口报错
  let row = null
  try {
    row = await readSettings(env)
  } catch {
    row = null
  }

  // 首次部署 / 还没同步过设置：服务端没有权威窗口。
  // 宁可不删，也不能用默认 12 小时误删用户本意是 48 小时的旧记录。
  if (!row) {
    return json({ ok: true, deleted: 0, skipped: true, hours: null, cutoff: null })
  }

  const hours = row.settings.feedWindowHours
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

  return json({ ok: true, deleted: r.meta?.changes ?? 0, cutoff, hours })
}
