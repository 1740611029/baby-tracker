const TIMEOUT = 30000
const UPLOAD_TIMEOUT = 60000          // 请求体较大（图片上传）时放宽，30s 在弱网上不够
const UPLOAD_THRESHOLD = 120000       // body 超过 120KB 就按上传档处理
// 边缘网关错误：Cloudflare 返回的是 HTML 错误页，取不到 body.error
const GATEWAY_ERR = new Set([408, 502, 503, 504])

// 业务/HTTP 错误：不参与网络重试
class ApiError extends Error {
  constructor(message, status = 0) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

const sleep = ms => new Promise(r => setTimeout(r, ms))

// 手机在 WiFi 与流量之间切换时，浏览器会掐断进行中的连接（net::ERR_NETWORK_CHANGED）。
// 等网络恢复再重试，比立刻失败有效得多。
function waitOnline(maxMs = 8000) {
  if (navigator.onLine) return sleep(400)
  return new Promise(resolve => {
    const done = () => {
      window.removeEventListener('online', done)
      clearTimeout(t)
      resolve()
    }
    const t = setTimeout(done, maxMs)
    window.addEventListener('online', done)
  })
}

async function request(url, options = {}, attempt = 0) {
  const method = (options.method || 'GET').toUpperCase()
  // GET / DELETE 幂等，可安全重试一次；POST 默认不重试（新建会重复插入），
  // 只有调用方显式传 retry: true（整行覆盖的编辑接口）才重试。
  const canRetry = attempt === 0 && (
    method === 'GET' || method === 'DELETE' || (method === 'POST' && options.retry === true)
  )
  const bodyLen = typeof options.body === 'string' ? options.body.length : 0
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), bodyLen > UPLOAD_THRESHOLD ? UPLOAD_TIMEOUT : TIMEOUT)
  try {
    const res = await fetch(url, {
      ...options,
      signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
    })
    if (!res.ok) {
      if (GATEWAY_ERR.has(res.status)) {
        const e = new ApiError('网络太慢，数据没传完，请重试', res.status)
        e.retriable = true
        throw e
      }
      const body = await res.json().catch(() => ({}))
      throw new ApiError(body.error || `请求失败 (${res.status})`, res.status)
    }
    return await res.json()
  } catch (e) {
    if (e instanceof ApiError) {
      if (e.retriable && canRetry) {
        await waitOnline()
        return request(url, options, attempt + 1)
      }
      throw e
    }
    if (e && e.name === 'AbortError') throw new ApiError('请求超时，请检查网络后重试')
    if (canRetry) {
      await waitOnline()
      return request(url, options, attempt + 1)
    }
    throw new ApiError(method === 'POST' ? '网络中断，请刷新确认是否已保存' : '网络不稳定，请重试')
  } finally {
    clearTimeout(timer)
  }
}

export const api = {
  get: url => request(url),
  post: (url, body, opts) => request(url, { method: 'POST', body: JSON.stringify(body), ...(opts || {}) }),
  del: url => request(url, { method: 'DELETE' })
}
