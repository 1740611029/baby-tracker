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
import { ui, resolveConfirm } from './utils/ui'
</script>
