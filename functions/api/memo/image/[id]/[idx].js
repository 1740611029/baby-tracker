import { json, serveImage } from '../../../../utils.js'

export async function onRequestGet({ env, request, params }) {
  const { results } = await env.DB.prepare('SELECT images FROM memos WHERE id = ?').bind(params.id).all()
  if (!results[0]) return json({ error: 'not found' }, 404)
  let images = []
  try { images = JSON.parse(results[0].images || '[]') } catch {}
  const img = images[parseInt(params.idx, 10)]
  if (!img) return json({ error: 'not found' }, 404)
  return serveImage(img, request)
}
