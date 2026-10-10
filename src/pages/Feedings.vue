<template>
  <div class="page">
    <header class="app-header">
      <div class="title">喂奶记录</div>
      <button class="icon-btn" @click="$router.push('/settings')">⚙️</button>
    </header>

    <div class="body">
      <div v-if="tipVisible" class="tip-banner">
        <span class="dot"></span>宝宝该吃奶啦，距上次已&nbsp;<b>{{ elapsedText }}</b>
      </div>

      <div v-if="lastFeed" class="card last-feed">
        <div>
          <div class="lf-label">距上次喂奶</div>
          <div class="lf-time">{{ elapsedText }}</div>
        </div>
        <div class="lf-badge">间隔 {{ settings.interval }} 小时</div>
      </div>

      <button class="btn-record" @click="openSheet">🍼&nbsp;记一笔</button>

      <template v-if="groups.length">
        <template v-for="g in groups" :key="g.key">
          <div class="day-group">{{ g.label }} · {{ g.items.length }} 次，共 {{ g.sum }}ml</div>
          <div v-for="f in g.items" :key="f.id" class="swipe-wrap">
            <button class="swipe-delete" @click="del(f)">删除</button>
            <div
              class="card feed-item swipe-content"
              :style="{ transform: `translateX(${f._x || 0}px)` }"
              @touchstart.passive="onTouchStart($event, f)"
              @touchmove="onTouchMove($event, f)"
              @touchend="onTouchEnd(f)"
            >
              <div class="ft">{{ timeOf(f.feed_time) }}<small>{{ periodOf(f.feed_time) }}</small></div>
              <div class="ml"><b>{{ f.amount_ml }}</b><span>ml</span></div>
              <span v-if="f.note" class="note-chip" :class="{ apricot: f.note.includes('剩') }">{{ f.note }}</span>
            </div>
          </div>
        </template>
      </template>

      <div v-else-if="!loadingList" class="empty">
        <div class="empty-art">🍼</div>
        <div class="empty-title">还没有喂奶记录</div>
        <div class="empty-desc">点下面按钮记下第一顿奶<br>之后会自动提醒下次喂奶时间</div>
        <button class="btn-empty" @click="openSheet">记一笔</button>
      </div>
    </div>

    <div v-if="sheet" class="dim" @click="sheet = false"></div>
    <div v-if="sheet" class="sheet">
      <div class="grab"></div>
      <h5>记一笔 🍼</h5>
      <input type="datetime-local" class="time-pill" v-model="form.time" />
      <div class="field-label">
        <span>奶量</span>
        <button class="quick-set" @click="goSettings">快捷值可在设置中改 ›</button>
      </div>
      <div class="chips">
        <button
          v-for="a in settings.amounts" :key="a"
          class="chip" :class="{ on: form.amount === a }"
          @click="form.amount = a"
        >{{ a }}</button>
      </div>
      <div class="ml-input-wrap">
        <input class="ml-input" type="number" inputmode="numeric" min="1" max="999" v-model.number="form.amount" placeholder="0" />
        <span>ml</span>
      </div>
      <div class="field-label"><span>备注（可选）</span></div>
      <div class="chips">
        <button
          v-for="w in settings.words" :key="w"
          class="chip word" :class="{ on: form.words.includes(w) }"
          @click="toggleWord(w)"
        >{{ w }}</button>
      </div>
      <input class="note-input" v-model="form.customNote" placeholder="其他备注…" maxlength="50" />
      <button class="btn-save" @click="save">保 存</button>
    </div>

    <TabBar />
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '../utils/api'
import { settings } from '../utils/settings'
import { showToast, showConfirm, showLoading, hideLoading } from '../utils/ui'
import TabBar from '../components/TabBar.vue'

const router = useRouter()
const list = ref([])
const loadingList = ref(true)
const sheet = ref(false)
const nowTick = ref(Date.now())
const form = reactive({ time: '', amount: 90, words: [], customNote: '' })

let timer = null
let swipe = null

const lastFeed = computed(() => list.value[0] || null)
const elapsedMs = computed(() => lastFeed.value ? nowTick.value - new Date(lastFeed.value.feed_time).getTime() : 0)
const elapsedText = computed(() => {
  const ms = Math.max(0, elapsedMs.value)
  const h = Math.floor(ms / 36e5)
  const m = Math.floor((ms % 36e5) / 6e4)
  if (h >= 24) return `${Math.floor(h / 24)}天${h % 24}小时`
  return `${h}小时${m}分`
})
const tipVisible = computed(() => lastFeed.value && elapsedMs.value >= settings.interval * 36e5)

const groups = computed(() => {
  const map = new Map()
  for (const f of list.value) {
    const d = new Date(f.feed_time)
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
    if (!map.has(key)) map.set(key, { key, label: dayLabel(d), items: [], sum: 0 })
    const g = map.get(key)
    g.items.push(f)
    g.sum += f.amount_ml
  }
  return [...map.values()]
})

function dayLabel(d) {
  const today = new Date()
  const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
  if (sameDay(d, today)) return '今天'
  const y = new Date(today); y.setDate(y.getDate() - 1)
  if (sameDay(d, y)) return '昨天'
  return `${d.getMonth() + 1}月${d.getDate()}日`
}

function timeOf(iso) {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
function periodOf(iso) {
  const h = new Date(iso).getHours()
  if (h < 6) return '凌晨'
  if (h < 12) return '上午'
  if (h < 14) return '中午'
  if (h < 18) return '下午'
  return '晚上'
}

function toLocalInputValue(d) {
  const p = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

async function load() {
  try {
    list.value = await api.get('/api/feedings')
  } catch (e) {
    showToast('加载失败，请下拉重试')
  } finally {
    loadingList.value = false
  }
}

function onVis() {
  if (!document.hidden) {
    nowTick.value = Date.now()
    load()
  }
}

onMounted(() => {
  load()
  timer = setInterval(() => { nowTick.value = Date.now() }, 30000)
  document.addEventListener('visibilitychange', onVis)
})
onUnmounted(() => {
  clearInterval(timer)
  document.removeEventListener('visibilitychange', onVis)
})

function openSheet() {
  form.time = toLocalInputValue(new Date())
  form.amount = settings.amounts[Math.min(2, settings.amounts.length - 1)] || 90
  form.words = []
  form.customNote = ''
  sheet.value = true
}

function toggleWord(w) {
  const i = form.words.indexOf(w)
  if (i >= 0) form.words.splice(i, 1)
  else form.words.push(w)
}

async function save() {
  if (!form.amount || form.amount < 1) return showToast('请输入奶量')
  if (!form.time) return showToast('请选择时间')
  const note = [...form.words, form.customNote.trim()].filter(Boolean).join(' ')
  showLoading()
  try {
    await api.post('/api/feedings', {
      feed_time: new Date(form.time).toISOString(),
      amount_ml: Math.round(form.amount),
      note
    })
    sheet.value = false
    showToast('已记录 🍼')
    nowTick.value = Date.now()
    await load()
  } catch (e) {
    showToast(e.message || '保存失败')
  } finally {
    hideLoading()
  }
}

async function del(f) {
  f._x = 0
  const ok = await showConfirm({ title: '删除这条喂奶记录？', content: `${timeOf(f.feed_time)} · ${f.amount_ml}ml`, confirmText: '删除', danger: true })
  if (!ok) return
  try {
    await api.del(`/api/feeding/${f.id}`)
    list.value = list.value.filter(i => i.id !== f.id)
    showToast('已删除')
  } catch (e) {
    showToast(e.message || '删除失败')
  }
}

function goSettings() {
  sheet.value = false
  router.push('/settings')
}

function onTouchStart(e, f) {
  list.value.forEach(i => { if (i !== f) i._x = 0 })
  swipe = { id: f.id, startX: e.touches[0].clientX, base: f._x || 0 }
}
function onTouchMove(e, f) {
  if (!swipe || swipe.id !== f.id) return
  const dx = e.touches[0].clientX - swipe.startX
  f._x = Math.max(-72, Math.min(0, swipe.base + dx))
}
function onTouchEnd(f) {
  if (!swipe) return
  f._x = (f._x || 0) <= -36 ? -72 : 0
  swipe = null
}
</script>
