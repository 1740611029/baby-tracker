import { reactive } from 'vue'
import { api } from './api'

// 设置现在以服务端（D1 settings 表）为准，localStorage 只做两件事：
// 1. 首屏缓存 —— 打开就渲染，不用等网络；
// 2. 离线兜底 —— 接口挂了也能看到上次同步到的值。
const KEY = 'bt_settings'

const MAX_ITEMS = 8
const MAX_WORD_LEN = 10
// 连点 ＋ 号时把 120ms 内的操作合并成一次提交
const FLUSH_DELAY = 120

export const DEFAULTS = {
  interval: 3,
  // 首页只展示这段时间内的记录，超出部分由服务端按同一个值清理
  feedWindowHours: 12,
  amounts: [30, 60, 90, 120],
  words: ['瓶喂', '亲喂', '拍嗝', '剩10ml'],
  eventWords: ['打疫苗', '外出', '洗澡', '换尿布']
}

// 注意：functions/utils.js 里有一份同规则的 normalizeSettings，
// 两边改动必须保持一致，否则前端展示与库里数据会漂移。

function clampInterval(v) {
  const n = Number(v)
  if (!Number.isFinite(n)) return DEFAULTS.interval
  return Math.min(12, Math.max(1, Math.round(n * 2) / 2))
}

function clampWindow(v) {
  const n = Math.round(Number(v))
  if (!Number.isFinite(n)) return DEFAULTS.feedWindowHours
  return Math.min(72, Math.max(1, n))
}

function normAmounts(v) {
  if (!Array.isArray(v)) return [...DEFAULTS.amounts]
  const nums = []
  for (const x of v) {
    if (typeof x !== 'number' && typeof x !== 'string') continue
    const n = Math.round(Number(x))
    if (!Number.isFinite(n) || n < 1 || n > 999 || nums.includes(n)) continue
    nums.push(n)
  }
  nums.sort((a, b) => a - b)
  const out = nums.slice(0, MAX_ITEMS)
  // 奶量至少保留一个：过滤后为空（含显式传空数组）都回落默认值
  return out.length ? out : [...DEFAULTS.amounts]
}

function normWords(v, fallback) {
  // 字段缺失 / 类型错乱 → 默认值；显式空数组 → 保留空，尊重用户主动删干净
  if (!Array.isArray(v)) return [...fallback]
  const out = []
  for (const x of v) {
    if (typeof x !== 'string') continue
    const s = x.trim().slice(0, MAX_WORD_LEN)
    if (!s || out.includes(s)) continue
    out.push(s)
    if (out.length >= MAX_ITEMS) break
  }
  return out
}

export function normalizeSettings(raw) {
  const src = raw && typeof raw === 'object' ? raw : {}
  return {
    interval: clampInterval(src.interval),
    feedWindowHours: clampWindow(src.feedWindowHours),
    amounts: normAmounts(src.amounts),
    words: normWords(src.words, DEFAULTS.words),
    eventWords: normWords(src.eventWords, DEFAULTS.eventWords)
  }
}

function snapshot(s) {
  return {
    interval: s.interval,
    feedWindowHours: s.feedWindowHours,
    amounts: [...s.amounts],
    words: [...s.words],
    eventWords: [...s.eventWords]
  }
}

function readCache() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || '{}')
    return normalizeSettings({ ...DEFAULTS, ...saved })
  } catch {
    return normalizeSettings(DEFAULTS)
  }
}

function writeCache(s) {
  try {
    localStorage.setItem(KEY, JSON.stringify(snapshot(s)))
  } catch {
    // 隐私模式 / 配额满：退化成纯内存，功能不受影响
  }
}

function apply(s) {
  const n = normalizeSettings(s)
  settings.interval = n.interval
  settings.feedWindowHours = n.feedWindowHours
  settings.amounts = n.amounts
  settings.words = n.words
  settings.eventWords = n.eventWords
}

// 模块级单例：Feedings.vue 的模板大量同步插值依赖它，不能改成异步对象
export const settings = reactive(readCache())

export const settingsMeta = reactive({
  loaded: false, // 本次会话是否成功读到过服务端
  syncing: false, // GET 进行中
  saving: false, // POST 进行中
  pending: false, // 有还没提交上去的本地改动
  offline: false, // 最近一次同步失败
  error: ''
})

let confirmed = normalizeSettings(snapshot(settings)) // 服务端最近一次确认的值
let flushTimer = null
let running = false
let waiters = []
let inflightLoad = null
let mutationSeq = 0

function isSameAsConfirmed() {
  return JSON.stringify(normalizeSettings(snapshot(settings))) === JSON.stringify(confirmed)
}

// 拉取服务端设置。服务端为空时把本地缓存上传，绝不反过来用默认值覆盖用户配置。
export function loadSettingsFromServer() {
  if (inflightLoad) return inflightLoad
  // 有未提交 / 正在提交的改动时不拉，避免把用户刚做的修改冲掉
  if (settingsMeta.saving || settingsMeta.pending) {
    return Promise.resolve({ ok: false, skipped: true })
  }

  const seq = mutationSeq
  inflightLoad = (async () => {
    settingsMeta.syncing = true
    try {
      const r = await api.get('/api/settings')

      // 拉取期间用户已经改过：不要用服务端旧值覆盖用户意图
      if (mutationSeq !== seq) return { ok: true, skipped: true }

      if (r && r.empty) {
        // 服务端还没有设置（首次升级）：把本地现有值推上去
        const local = normalizeSettings(snapshot(settings))
        const saved = await api.post('/api/settings', local)
        const s = normalizeSettings(saved?.settings || local)
        confirmed = s
        writeCache(s)
        if (mutationSeq === seq) apply(s)
        settingsMeta.loaded = true
        settingsMeta.offline = false
        settingsMeta.error = ''
        return { ok: true, uploaded: true }
      }

      const s = normalizeSettings(r?.settings)
      confirmed = s
      writeCache(s)
      apply(s)
      settingsMeta.loaded = true
      settingsMeta.offline = false
      settingsMeta.error = ''
      return { ok: true, uploaded: false }
    } catch (e) {
      // 离线 / 接口挂了：继续用缓存，页面上给一个可点的重试入口
      settingsMeta.offline = true
      settingsMeta.error = e?.message || '设置同步失败'
      return { ok: false, error: settingsMeta.error }
    } finally {
      settingsMeta.syncing = false
      inflightLoad = null
    }
  })()

  return inflightLoad
}

/**
 * 修改设置：先乐观改本地（数字/标签立刻变），120ms 内合并成一次全量提交。
 * mutator 直接改传入的对象；返回字符串表示校验不通过（不提交），返回空表示成功。
 * resolve 时这一批改动已经落库，或已经回滚到服务端确认值。
 */
export function mutate(mutator) {
  let reason = ''
  try {
    reason = mutator(settings) || ''
  } catch {
    reason = '设置修改失败'
  }
  if (reason) return Promise.resolve({ ok: false, reason })

  mutationSeq += 1
  settingsMeta.pending = true

  return new Promise(resolve => {
    waiters.push(resolve)
    if (running || flushTimer) return
    flushTimer = setTimeout(() => {
      flushTimer = null
      flushLoop()
    }, FLUSH_DELAY)
  })
}

async function flushLoop() {
  if (running) return
  running = true
  settingsMeta.saving = true
  let ok = true
  let error = ''

  try {
    // 提交期间用户又改了 → 循环再发一次，保证最后一次改动一定落库
    while (!isSameAsConfirmed()) {
      const payload = normalizeSettings(snapshot(settings))
      try {
        const r = await api.post('/api/settings', payload)
        const s = normalizeSettings(r?.settings || payload)
        confirmed = s
        writeCache(s)
        // 期间没有新改动才回写 UI，否则会把用户刚点的值冲掉
        if (isSameAsConfirmed()) apply(s)
        settingsMeta.offline = false
        settingsMeta.error = ''
        ok = true
        error = ''
      } catch (e) {
        ok = false
        error = e?.message || '设置保存失败'
        apply(confirmed)
        writeCache(confirmed)
        settingsMeta.offline = true
        settingsMeta.error = error
        break
      }
    }
  } finally {
    running = false
    settingsMeta.saving = false
    settingsMeta.pending = !isSameAsConfirmed()
    const list = waiters
    waiters = []
    list.forEach(fn => fn({ ok, error }))
  }
}
