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

// 每次打开（冷启动 / 从后台回到前台）都清理一次过期喂奶记录。
// 服务端幂等，没有过期数据时只返回 deleted=0，成本可忽略。
function onVis() {
  if (!document.hidden) cleanupExpiredFeedings()
}

onMounted(() => {
  cleanupExpiredFeedings()
  document.addEventListener('visibilitychange', onVis)
})
onUnmounted(() => document.removeEventListener('visibilitychange', onVis))
</script>
