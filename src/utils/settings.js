import { reactive } from 'vue'

const KEY = 'bt_settings'
const DEFAULTS = {
  interval: 3,
  amounts: [30, 60, 90, 120],
  words: ['瓶喂', '亲喂', '拍嗝', '剩10ml']
}

function load() {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') }
  } catch {
    return { ...DEFAULTS }
  }
}

export const settings = reactive(load())

export function saveSettings() {
  localStorage.setItem(KEY, JSON.stringify({
    interval: settings.interval,
    amounts: settings.amounts,
    words: settings.words
  }))
}
