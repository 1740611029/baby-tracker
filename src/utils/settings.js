import { reactive } from 'vue'

const KEY = 'bt_settings'
const DEFAULTS = {
  interval: 3,
  amounts: [30, 60, 90, 120],
  words: ['瓶喂', '亲喂', '拍嗝', '剩10ml'],
  eventWords: ['打疫苗', '外出', '洗澡', '换尿布']
}

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || '{}')
    const merged = { ...DEFAULTS, ...saved }
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
    amounts: settings.amounts,
    words: settings.words,
    eventWords: settings.eventWords
  }))
}
