import { json } from '../../utils.js'

export async function onRequestDelete({ env, params }) {
  await env.DB.prepare('DELETE FROM feedings WHERE id = ?').bind(params.id).run()
  return json({ ok: true })
}
