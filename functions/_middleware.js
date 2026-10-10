function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  }
}

export async function onRequest(context) {
  if (context.request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders() })
  }
  const res = await context.next()
  const headers = new Headers(res.headers)
  for (const [k, v] of Object.entries(corsHeaders())) headers.set(k, v)
  return new Response(res.body, { status: res.status, headers })
}
