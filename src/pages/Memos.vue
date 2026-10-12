<template>
  <div class="page">
    <header class="app-header">
      <div class="title">备忘录</div>
      <div style="width:38px"></div>
    </header>

    <div class="body">
      <div class="search-bar">
        <input
          class="search-input"
          v-model="keyword"
          placeholder="搜索标题或内容…"
          @keyup.enter="doSearch"
        />
        <button class="search-btn" @click="doSearch">搜索</button>
        <button class="search-reset" @click="reset">重置</button>
      </div>
      <div v-if="query" class="search-hint">找到 {{ filtered.length }} 条结果</div>

      <template v-if="filtered.length">
        <div v-for="m in filtered" :key="m.id" class="card memo-card" @click="$router.push(`/memo/${m.id}`)">
          <button class="pin-btn" :class="{ on: m.pinned }" @click.stop="togglePin(m)">📌</button>
          <div class="mc-main">
            <div class="mc-title"><template v-for="(seg, i) in highlight(m.title)" :key="i"><mark v-if="seg.hit" class="hl">{{ seg.t }}</mark><template v-else>{{ seg.t }}</template></template></div>
            <div v-if="m.content" class="mc-excerpt"><template v-for="(seg, i) in highlight(m.content)" :key="i"><mark v-if="seg.hit" class="hl">{{ seg.t }}</mark><template v-else>{{ seg.t }}</template></template></div>
            <div v-if="m.img_count" class="mc-imgs">🖼 {{ m.img_count }} 张图</div>
            <div class="mc-date">{{ dateOf(m.updated_at) }}</div>
          </div>
          <img v-if="m.img_count" class="mc-thumb" :src="`/api/memo/image/${m.id}/0`" loading="lazy" />
        </div>
      </template>

      <div v-else-if="!loadingList" class="empty">
        <div class="empty-art">📝</div>
        <div class="empty-title">{{ query ? '没有匹配的备忘' : '还没有备忘' }}</div>
        <div class="empty-desc">{{ query ? '换个关键词再试试' : '医嘱、生长数据、哄睡心得…' }}<br>{{ query ? '' : '都可以图文记在这里' }}</div>
        <button v-if="!query" class="btn-empty" @click="$router.push('/memo/new')">写一篇</button>
      </div>
    </div>

    <button class="fab" @click="$router.push('/memo/new')">＋</button>

    <TabBar />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { api } from '../utils/api'
import { showToast } from '../utils/ui'
import TabBar from '../components/TabBar.vue'

const list = ref([])
const loadingList = ref(true)
const keyword = ref('')
const query = ref('')

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return list.value
  return list.value.filter(m =>
    (m.title || '').toLowerCase().includes(q) ||
    (m.content || '').toLowerCase().includes(q)
  )
})

function highlight(text) {
  const t = String(text || '')
  const q = query.value.trim()
  if (!q) return [{ t, hit: false }]
  const lower = t.toLowerCase()
  const ql = q.toLowerCase()
  const out = []
  let i = 0
  while (i < t.length) {
    const idx = lower.indexOf(ql, i)
    if (idx === -1) { out.push({ t: t.slice(i), hit: false }); break }
    if (idx > i) out.push({ t: t.slice(i, idx), hit: false })
    out.push({ t: t.slice(idx, idx + q.length), hit: true })
    i = idx + q.length
  }
  return out
}

function doSearch() {
  query.value = keyword.value.trim()
}

function reset() {
  keyword.value = ''
  query.value = ''
}

function dateOf(iso) {
  const d = new Date(iso)
  const today = new Date()
  const sameDay = d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate()
  if (sameDay) return '今天 · 更新'
  return `${d.getMonth() + 1}月${d.getDate()}日`
}

async function load() {
  try {
    list.value = await api.get('/api/memos')
  } catch (e) {
    showToast('加载失败，请重试')
  } finally {
    loadingList.value = false
  }
}

async function togglePin(m) {
  const prev = m.pinned
  m.pinned = prev ? 0 : 1
  try {
    await api.post(`/api/memo/${m.id}`, { pinned: m.pinned })
    await load()
  } catch (e) {
    m.pinned = prev
    showToast(e.message || '操作失败')
  }
}

onMounted(load)
</script>
