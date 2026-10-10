async function request(url, options = {}, canRetry = true) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 30000)
  try {
    const res = await fetch(url, {
      ...options,
      signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body.error || `请求失败 (${res.status})`)
    }
    return await res.json()
  } catch (e) {
    const isGet = !options.method || options.method === 'GET'
    if (canRetry && isGet) return request(url, options, false)
    throw e
  } finally {
    clearTimeout(timer)
  }
}

export const api = {
  get: url => request(url),
  post: (url, body) => request(url, { method: 'POST', body: JSON.stringify(body) }),
  del: url => request(url, { method: 'DELETE' })
}
