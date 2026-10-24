import { reactive } from 'vue'

const KEY = 'bt_settings'
const DEFAULTS = {
  interval: 3,
  // 首页只展示这段时间内的记录，超出部分每次打开时从库里清理
  feedWindowHours: 12,
  amounts: [30, 60, 90, 120],
  words: ['瓶喂', '亲喂', '拍嗝', '剩10ml'],
  eventWords: ['打疫苗', '外出', '洗澡', '换尿布']
}

function clampWindow(v) {
  const n = Math.round(Number(v))
  if (!Number.isFinite(n)) return DEFAULTS.feedWindowHours
  return Math.min(72, Math.max(1, n))
}

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || '{}')
    const merged = { ...DEFAULTS, ...saved }
    merged.feedWindowHours = clampWindow(merged.feedWindowHours)
    if (!Array.isArray(merged.words)) merged.words = [...DEFAULTS.words]
    if (!Array.isArray(merged.eventWords)) merged.eventWords = [...DEFAULTS.eventWords]
    if (!Array.isArray(merged.amounts) || !merged.amounts.length) merged.amounts = [...DEFAULTS.amounts]
    return merged
  } catch {
    return { ...DEFAULTS, words: [...DEFAULTS.words], eventWords: [...DEFAULTS.eventWords], amounts: [...DEFAULTS.amounts] }
  }
}

export const settings = reactive(load())

export function saveSettings() {
  localStorage.setItem(KEY, JSON.stringify({
    interval: settings.interval,
    feedWindowHours: settings.feedWindowHours,
    amounts: settings.amounts,
    words: settings.words,
    eventWords: settings.eventWords
  }))
}
