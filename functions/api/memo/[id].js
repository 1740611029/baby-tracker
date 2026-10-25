import { json, nowISO, IMAGE_LIMITS, tooLargeImages } from '../../utils.js'

async function getRow(env, id) {
  const { results } = await env.DB.prepare('SELECT * FROM memos WHERE id = ?').bind(id).all()
  return results[0]
}

function parseImages(row) {
  try { return JSON.parse(row.images || '[]') } catch { return [] }
}

export async function onRequestGet({ env, request, params }) {
  const row = await getRow(env, params.id)
  if (!row) return json({ error: 'not found' }, 404)
  const images = parseImages(row)
  const url = new URL(request.url)
  // ?raw=1 返回 base64 本体，仅保留作调试用；正常编辑一律走地址，
  // 否则前端会把几 MB 的 base64 原样回传，弱网下请求体传不完就被边缘判 408。
  if (url.searchParams.get('raw') === '1') return json({ ...row, images })
  return json({
    id: row.id,
    title: row.title,
    content: row.content,
    pinned: row.pinned,
    created_at: row.created_at,
    updated_at: row.updated_at,
    images: images.map((_, i) => `/api/memo/image/${row.id}/${i}`),
    img_count: images.length
  })
}

export async function onRequestPost({ env, request, params }) {
  const row = await getRow(env, params.id)
  if (!row) return json({ error: 'not found' }, 404)
  const body = await request.json().catch(() => ({}))
  const old = parseImages(row)

  let images = old
  if (Array.isArray(body.images)) {
    // 前端只支持「追加」和「删除」，所以地址里的索引始终指向旧数组，
    // 删除中间一张后回传 [/0, /2] 也能按原索引取回原图，不会错位。
    const re = new RegExp(`^/api/memo/image/${parseInt(params.id, 10)}/(\\d+)$`)
    images = body.images.slice(0, IMAGE_LIMITS.MAX_COUNT).map(s => {
      if (typeof s !== 'string') return ''
      if (s.startsWith('data:image/')) return s
      const m = re.exec(s)
      if (m) return old[parseInt(m[1], 10)] || ''
      return ''
    }).filter(Boolean)
    const tooBig = tooLargeImages(images)
    if (tooBig) return json({ error: tooBig }, 413)
  }

  const title = body.title !== undefined ? String(body.title).trim().slice(0, 100) : row.title
  if (!title) return json({ error: '标题不能为空' }, 400)
  const content = body.content !== undefined ? String(body.content).slice(0, 5000) : row.content
  const pinned = body.pinned !== undefined ? (body.pinned ? 1 : 0) : row.pinned

  // 仅当确实修改了内容时才刷新 updated_at；只切换置顶时保留原值
  const touchesContent =
    body.title !== undefined || body.content !== undefined || Array.isArray(body.images)
  const updatedAt = touchesContent ? nowISO() : row.updated_at

  await env.DB.prepare(
    'UPDATE memos SET title = ?, content = ?, images = ?, pinned = ?, updated_at = ? WHERE id = ?'
  ).bind(title, content, JSON.stringify(images), pinned, updatedAt, params.id).run()
  return json({ ok: true })
}

export async function onRequestDelete({ env, params }) {
  await env.DB.prepare('DELETE FROM memos WHERE id = ?').bind(params.id).run()
  return json({ ok: true })
}
