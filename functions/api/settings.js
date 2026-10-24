import { json, nowISO, normalizeSettings, readSettings } from '../utils.js'

// 服务端没有设置时返回 empty=true，前端据此决定「上传本地设置」而不是「用默认值覆盖」
export async function onRequestGet({ env }) {
  const row = await readSettings(env)
  if (!row) {
    return json(
      { ok: true, empty: true, settings: null, updatedAt: null },
      200,
      { 'Cache-Control': 'no-store' }
    )
  }
  return json(
    { ok: true, empty: false, settings: row.settings, updatedAt: row.updatedAt },
    200,
    { 'Cache-Control': 'no-store' }
  )
}

// 全量快照写入：不信任前端，任何字段都先归一化。
// 因为是整体覆盖，重复提交天然幂等，前端可以放心合并连续操作。
export async function onRequestPost({ env, request }) {
  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') return json({ error: '请求格式错误' }, 400)

  const s = normalizeSettings(body)
  const updatedAt = nowISO()

  await env.DB.prepare(
    `INSERT INTO settings (id, json, updated_at) VALUES (1, ?, ?)
     ON CONFLICT(id) DO UPDATE SET json = excluded.json, updated_at = excluded.updated_at`
  ).bind(JSON.stringify(s), updatedAt).run()

  return json({ ok: true, empty: false, settings: s, updatedAt })
}
