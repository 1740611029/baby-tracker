import { json, serveImage } from '../../../../utils.js'

export async function onRequestGet({ env, request, params }) {
  const idx = parseInt(params.idx, 10)
  if (!Number.isInteger(idx) || idx < 0) return json({ error: 'not found' }, 404)

  // 只取第 idx 张：整行 SELECT 会把该备忘所有图片的 base64 都搬进 Worker，
  // 编辑页一次渲染 9 张就是 9 次整行传输。json_valid 保证脏数据不会让 json_extract 抛错。
  // 路径必须在 JS 里拼好再绑定：D1 把数字参数当 REAL，SQL 里拼会得到非法的 '$[0.0]'。
  const path = `$[${idx}]`
  const row = await env.DB.prepare(
    `SELECT CASE WHEN json_valid(images) THEN json_extract(images, ?) ELSE NULL END AS img
     FROM memos WHERE id = ?`
  ).bind(path, params.id).first()

  let img = row?.img
  if (!img) {
    // 兜底：images 不是合法 JSON 时退回整行解析，保证历史脏数据仍能显示
    const { results } = await env.DB.prepare('SELECT images FROM memos WHERE id = ?').bind(params.id).all()
    if (!results[0]) return json({ error: 'not found' }, 404)
    try { img = JSON.parse(results[0].images || '[]')[idx] } catch {}
  }
  if (!img) return json({ error: 'not found' }, 404)
  return serveImage(img, request)
}
