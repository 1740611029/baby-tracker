import { reactive } from 'vue'
import { api } from './api'
import { settings } from './settings'

let running = false
let lastAttemptAt = 0
// 冷启动的 onMounted 与 visibilitychange 可能在同一瞬间各触发一次，
// 10 秒内只发一次请求，避免同一次「打开」打两次接口。
const MIN_GAP = 10000

// startedAt: 本次清理请求的发起时刻，给喂奶列表页判断「这次加载是否已经晚于删除」
// tick:      只有真的删了数据才 +1，作为列表刷新的信号
export const cleanupState = reactive({ startedAt: 0, deleted: 0, tick: 0 })

/**
 * 每次打开系统时，让服务端把超出窗口的喂奶记录删掉。
 * 接口幂等（没有过期数据时 deleted=0），所以每次打开都调是安全的。
 */
export async function cleanupExpiredFeedings() {
  if (running) return
  const now = Date.now()
  if (now - lastAttemptAt < MIN_GAP) return
  lastAttemptAt = now
  cleanupState.startedAt = now
  running = true
  try {
    const r = await api.post('/api/cleanup', { hours: settings.feedWindowHours })
    const deleted = Number(r?.deleted) || 0
    if (deleted > 0) {
      cleanupState.deleted = deleted
      cleanupState.tick += 1
    }
  } catch (e) {
    lastAttemptAt = 0 // 弱网/离线：允许下一次触发立即重试
  } finally {
    running = false
  }
}
