<template>
  <router-view />

  <div v-if="ui.toast" class="toast">{{ ui.toast }}</div>

  <div v-if="ui.loading" class="loading-mask"><div class="spinner"></div></div>

  <div v-if="ui.confirm" class="confirm-mask" @click.self="resolveConfirm(false)">
    <div class="confirm-box">
      <div class="confirm-title">{{ ui.confirm.title }}</div>
      <div v-if="ui.confirm.content" class="confirm-content">{{ ui.confirm.content }}</div>
      <div class="confirm-btns">
        <button class="cbtn" @click="resolveConfirm(false)">取消</button>
        <button class="cbtn primary" :class="{ danger: ui.confirm.danger }" @click="resolveConfirm(true)">
          {{ ui.confirm.confirmText || '确定' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, onUnmounted } from 'vue'
import { ui, resolveConfirm } from './utils/ui'
import { cleanupExpiredFeedings } from './utils/cleanup'
import { loadSettingsFromServer } from './utils/settings'

// 每次打开（冷启动 / 从后台回到前台）都清理一次过期喂奶记录。
// 窗口由服务端从 settings 表读，前端不必等设置同步；服务端幂等，没有过期数据时只返回 deleted=0。
// 顺便同步一次设置，让另一台设备改过的快捷词也能在这里生效。
function onVis() {
  if (document.hidden) return
  cleanupExpiredFeedings()
  loadSettingsFromServer()
}

onMounted(async () => {
  cleanupExpiredFeedings()

  // 首次升级时服务端还没有设置，这一步会把本机现有配置上传；
  // 上传成功后窗口才可用，补一次清理（之前那次会被服务端跳过）。
  const r = await loadSettingsFromServer()
  if (r && r.uploaded) cleanupExpiredFeedings(true)

  document.addEventListener('visibilitychange', onVis)
})
onUnmounted(() => document.removeEventListener('visibilitychange', onVis))
</script>
