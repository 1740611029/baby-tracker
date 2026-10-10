import { json, serveImage } from '../../../utils.js'

export async function onRequestGet({ env, request, params }) {
  const { results } = await env.DB.prepare('SELECT image FROM todos WHERE id = ?').bind(params.id).all()
  if (!results[0] || !results[0].image) return json({ error: 'not found' }, 404)
  return serveImage(results[0].image, request)
}
