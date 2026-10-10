import { json, nowISO } from '../../utils.js'

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
  if (url.searchParams.get('raw') === '1') return json({ ...row, images })
  return json({
    id: row.id,
    title: row.title,
    content: row.content,
    created_at: row.created_at,
    updated_at: row.updated_at,
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
    images = body.images.slice(0, 9).map(s => {
      if (typeof s !== 'string') return ''
      if (s.startsWith('data:image/')) return s
      const m = /^\/api\/memo\/image\/\d+\/(\d+)$/.exec(s)
      if (m) return old[parseInt(m[1], 10)] || ''
      return ''
    }).filter(Boolean)
  }

  const title = body.title !== undefined ? String(body.title).trim().slice(0, 100) : row.title
  if (!title) return json({ error: '标题不能为空' }, 400)
  const content = body.content !== undefined ? String(body.content).slice(0, 5000) : row.content

  await env.DB.prepare(
    'UPDATE memos SET title = ?, content = ?, images = ?, updated_at = ? WHERE id = ?'
  ).bind(title, content, JSON.stringify(images), nowISO(), params.id).run()
  return json({ ok: true })
}

export async function onRequestDelete({ env, params }) {
  await env.DB.prepare('DELETE FROM memos WHERE id = ?').bind(params.id).run()
  return json({ ok: true })
}
