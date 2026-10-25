export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers }
  })
}

export function nowISO() {
  return new Date().toISOString()
}

// 喂奶记录的保留策略：只保留近 N 小时的数据，但无论多久，最近 6 条永远保留。
// 「展示集 = 窗口内 ∪ 最近 6 条」与「删除集 = 全表 − 展示集」恒互斥，
// 所以不会出现「列表里显示了、清理时却被删掉」的情况。
export const RETENTION = { DEF_HOURS: 12, MIN_KEEP: 6 }

export function clampHours(v) {
  const n = Number(v)
  if (!Number.isFinite(n)) return RETENTION.DEF_HOURS
  return Math.min(72, Math.max(1, Math.round(n)))
}

// 图片体积护栏：D1 单行/单字符串上限 2MB，这里留出 JSON 结构与其它字段的余量。
// 前端压缩后单张约 80~160KB，正常使用远低于上限；护栏只拦异常大的图。
export const IMAGE_LIMITS = {
  MAX_COUNT: 9,
  MAX_ONE: 400 * 1024,      // 单张 base64 字符数上限
  MAX_TOTAL: 1_700_000      // 整个 images 合计字符数上限
}

// 返回空串表示通过，否则返回给用户看的中文提示
export function tooLargeImages(images) {
  for (let i = 0; i < images.length; i++) {
    if (images[i].length > IMAGE_LIMITS.MAX_ONE) {
      return `第 ${i + 1} 张图片太大，请换一张或压缩后重试`
    }
  }
  const total = images.reduce((n, s) => n + s.length, 0)
  if (total > IMAGE_LIMITS.MAX_TOTAL) {
    return `图片合计 ${Math.round(total / 1024)}KB，超过上限 ${Math.round(IMAGE_LIMITS.MAX_TOTAL / 1024)}KB，请删掉几张再保存`
  }
  return ''
}

export function etagOf(s) {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0
  return `"${(h >>> 0).toString(16)}"`
}

export function serveImage(dataUrl, request) {
  if (!dataUrl || typeof dataUrl !== 'string') return json({ error: 'not found' }, 404)
  const m = /^data:([\w/+.-]+);base64,(.+)$/.exec(dataUrl)
  if (!m) return json({ error: 'not found' }, 404)
  const etag = etagOf(dataUrl)
  const headers = {
    'Content-Type': m[1],
    'Cache-Control': 'private, max-age=86400',
    'ETag': etag
  }
  if (request.headers.get('If-None-Match') === etag) {
    return new Response(null, { status: 304, headers })
  }
  const bin = atob(m[2])
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new Response(bytes, { headers })
}

// ---------------------------------------------------------------------------
// 设置项：全局单租户，整体存成一行 JSON（settings 表 id=1）
// 注意：src/utils/settings.js 里有一份同规则的 normalizeSettings，
// 两边改动必须保持一致，否则前端展示与库里数据会漂移。
// ---------------------------------------------------------------------------

export const DEFAULT_SETTINGS = {
  interval: 3,
  feedWindowHours: RETENTION.DEF_HOURS,
  amounts: [30, 60, 90, 120],
  words: ['瓶喂', '亲喂', '拍嗝', '剩10ml'],
  eventWords: ['打疫苗', '外出', '洗澡', '换尿布']
}

export const SETTINGS_LIMITS = {
  MAX_ITEMS: 8,
  MAX_WORD_LEN: 10,
  MIN_AMOUNT: 1,
  MAX_AMOUNT: 999
}

// 喂奶间隔 1~12 小时，按 0.5 步进
export function clampInterval(v) {
  const n = Number(v)
  if (!Number.isFinite(n)) return DEFAULT_SETTINGS.interval
  return Math.min(12, Math.max(1, Math.round(n * 2) / 2))
}

function normAmounts(v) {
  if (!Array.isArray(v)) return [...DEFAULT_SETTINGS.amounts]
  const nums = []
  for (const x of v) {
    if (typeof x !== 'number' && typeof x !== 'string') continue
    const n = Math.round(Number(x))
    if (!Number.isFinite(n) || n < SETTINGS_LIMITS.MIN_AMOUNT || n > SETTINGS_LIMITS.MAX_AMOUNT) continue
    if (!nums.includes(n)) nums.push(n)
  }
  nums.sort((a, b) => a - b)
  const out = nums.slice(0, SETTINGS_LIMITS.MAX_ITEMS)
  // 奶量至少保留一个：过滤后为空（含显式传空数组）都回落默认值
  return out.length ? out : [...DEFAULT_SETTINGS.amounts]
}

function normWords(v, fallback) {
  // 字段缺失 / 类型错乱 → 默认值；显式空数组 → 保留空，尊重用户主动删干净
  if (!Array.isArray(v)) return [...fallback]
  const out = []
  for (const x of v) {
    if (typeof x !== 'string') continue
    const s = x.trim().slice(0, SETTINGS_LIMITS.MAX_WORD_LEN)
    if (!s || out.includes(s)) continue
    out.push(s)
    if (out.length >= SETTINGS_LIMITS.MAX_ITEMS) break
  }
  return out
}

// 任何输入都返回一份合法设置。接口不因「值不合法」报 400，
// 而是归一化后落库，保证库里永远是干净数据。
export function normalizeSettings(raw) {
  const src = raw && typeof raw === 'object' ? raw : {}
  return {
    interval: clampInterval(src.interval),
    feedWindowHours: clampHours(src.feedWindowHours),
    amounts: normAmounts(src.amounts),
    words: normWords(src.words, DEFAULT_SETTINGS.words),
    eventWords: normWords(src.eventWords, DEFAULT_SETTINGS.eventWords)
  }
}

// 没有行、或 JSON 损坏都返回 null —— 调用方据此判断「服务端还没有权威设置」
export async function readSettings(env) {
  const row = await env.DB.prepare('SELECT json, updated_at FROM settings WHERE id = 1').first()
  if (!row) return null
  let parsed
  try {
    parsed = JSON.parse(row.json)
  } catch {
    return null
  }
  return { settings: normalizeSettings(parsed), updatedAt: row.updated_at }
}
