<template>
  <div class="page">
    <header class="app-header">
      <div class="title">备忘录</div>
      <div style="width:38px"></div>
    </header>

    <div class="body">
      <template v-if="list.length">
        <div v-for="m in list" :key="m.id" class="card memo-card" @click="$router.push(`/memo/${m.id}`)">
          <div class="mc-main">
            <div class="mc-title">{{ m.title }}</div>
            <div v-if="m.content" class="mc-excerpt">{{ m.content }}</div>
            <div v-if="m.img_count" class="mc-imgs">🖼 {{ m.img_count }} 张图</div>
            <div class="mc-date">{{ dateOf(m.updated_at) }}</div>
          </div>
          <img v-if="m.img_count" class="mc-thumb" :src="`/api/memo/image/${m.id}/0`" loading="lazy" />
        </div>
      </template>

      <div v-else-if="!loadingList" class="empty">
        <div class="empty-art">📝</div>
        <div class="empty-title">还没有备忘</div>
        <div class="empty-desc">医嘱、生长数据、哄睡心得…<br>都可以图文记在这里</div>
        <button class="btn-empty" @click="$router.push('/memo/new')">写一篇</button>
      </div>
    </div>

    <button class="fab" @click="$router.push('/memo/new')">＋</button>

    <TabBar />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { api } from '../utils/api'
import { showToast } from '../utils/ui'
import TabBar from '../components/TabBar.vue'

const list = ref([])
const loadingList = ref(true)

function dateOf(iso) {
  const d = new Date(iso)
  const today = new Date()
  const sameDay = d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate()
  if (sameDay) return '今天 · 更新'
  return `${d.getMonth() + 1}月${d.getDate()}日`
}

onMounted(async () => {
  try {
    list.value = await api.get('/api/memos')
  } catch (e) {
    showToast('加载失败，请重试')
  } finally {
    loadingList.value = false
  }
})
</script>
