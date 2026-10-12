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

      <div class="btn-row">
        <button class="btn-record" @click="openSheet('feeding')">🍼&nbsp;记一笔</button>
        <button class="btn-secondary" @click="openSheet('event')">📌 记事件</button>
      </div>

      <template v-if="groups.length">
        <template v-for="g in groups" :key="g.key">
          <div class="day-group">{{ groupLabel(g) }}</div>
          <div v-for="f in g.items" :key="f._kind + '-' + f.id" class="swipe-wrap">
            <button class="swipe-delete" @click="del(f)">删除</button>
            <div
              class="card feed-item"
              :class="{ event: f._kind === 'event' }"
              :style="{ transform: `translateX(${f._x || 0}px)` }"
              @touchstart.passive="onTouchStart($event, f)"
              @touchmove="onTouchMove($event, f)"
              @touchend="onTouchEnd(f)"
            >
              <div class="ft">{{ timeOf(f._time) }}<small>{{ periodOf(f._time) }}</small></div>
              <div v-if="f._kind === 'feeding'" class="ml"><b>{{ f.amount_ml }}</b><span>ml</span></div>
              <div v-else class="ev-main">{{ f.title }}</div>
              <span
                v-if="f.note"
                class="note-chip"
                :class="{ apricot: f._kind === 'event' || f.note.includes('剩') }"
              >{{ f.note }}</span>
            </div>
          </div>
        </template>
      </template>

      <div v-else-if="!loadingList" class="empty">
        <div class="empty-art">🍼</div>
        <div class="empty-title">还没有喂奶记录</div>
        <div class="empty-desc">点下面按钮记下第一顿奶<br>也可以记录打疫苗、逛街等事件</div>
        <button class="btn-empty" @click="openSheet('feeding')">记一笔</button>
      </div>
    </div>

    <div v-if="sheet" class="dim" @click="sheet = ''"></div>

    <div v-if="sheet === 'feeding'" class="sheet">
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

    <div v-if="sheet === 'event'" class="sheet">
      <div class="grab"></div>
      <h5>记事件 📌</h5>
      <input type="datetime-local" class="time-pill" v-model="evForm.time" />
      <div class="field-label"><span>事件</span></div>
      <input class="note-input" style="margin-top:0" v-model.trim="evForm.title" placeholder="例如：打疫苗、逛街、打游戏…" maxlength="50" />
      <div class="field-label"><span>备注（可选）</span></div>
      <input class="note-input" v-model="evForm.note" placeholder="其他备注…" maxlength="50" />
      <button class="btn-save" @click="saveEvent">保 存</button>
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
const feedings = ref([])
const list = ref([])
const loadingList = ref(true)
const sheet = ref('')
const nowTick = ref(Date.now())
const form = reactive({ time: '', amount: 90, words: [], customNote: '' })
const evForm = reactive({ time: '', title: '', note: '' })

let timer = null
let swipe = null

const lastFeed = computed(() => feedings.value[0] || null)
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
    const d = new Date(f._time)
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
    if (!map.has(key)) map.set(key, { key, label: dayLabel(d), items: [], sum: 0, feedCount: 0, eventCount: 0 })
    const g = map.get(key)
    g.items.push(f)
    if (f._kind === 'feeding') { g.sum += f.amount_ml; g.feedCount++ }
    else g.eventCount++
  }
  return [...map.values()]
})

function groupLabel(g) {
  const parts = []
  if (g.feedCount) parts.push(`喂奶 ${g.feedCount} 次共 ${g.sum}ml`)
  if (g.eventCount) parts.push(`事件 ${g.eventCount} 个`)
  return `${g.label} · ${parts.join(' · ')}`
}

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
    const [fs, es] = await Promise.all([
      api.get('/api/feedings'),
      api.get('/api/events')
    ])
    feedings.value = fs
    list.value = [
      ...fs.map(x => ({ ...x, _kind: 'feeding', _time: x.feed_time })),
      ...es.map(x => ({ ...x, _kind: 'event', _time: x.event_time }))
    ].sort((a, b) => new Date(b._time) - new Date(a._time))
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

function openSheet(mode) {
  if (mode === 'feeding') {
    form.time = toLocalInputValue(new Date())
    form.amount = settings.amounts[Math.min(2, settings.amounts.length - 1)] || 90
    form.words = []
    form.customNote = ''
  } else {
    evForm.time = toLocalInputValue(new Date())
    evForm.title = ''
    evForm.note = ''
  }
  sheet.value = mode
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
    sheet.value = ''
    showToast('已记录 🍼')
    nowTick.value = Date.now()
    await load()
  } catch (e) {
    showToast(e.message || '保存失败')
  } finally {
    hideLoading()
  }
}

async function saveEvent() {
  if (!evForm.title.trim()) return showToast('请输入事件')
  if (!evForm.time) return showToast('请选择时间')
  showLoading()
  try {
    await api.post('/api/events', {
      title: evForm.title.trim(),
      event_time: new Date(evForm.time).toISOString(),
      note: evForm.note.trim()
    })
    sheet.value = ''
    showToast('已记录 📌')
    await load()
  } catch (e) {
    showToast(e.message || '保存失败')
  } finally {
    hideLoading()
  }
}

async function del(f) {
  f._x = 0
  const isEvent = f._kind === 'event'
  const ok = await showConfirm({
    title: isEvent ? '删除这条事件？' : '删除这条喂奶记录？',
    content: isEvent ? `${timeOf(f._time)} · ${f.title}` : `${timeOf(f._time)} · ${f.amount_ml}ml`,
    confirmText: '删除', danger: true
  })
  if (!ok) return
  try {
    await api.del(isEvent ? `/api/event/${f.id}` : `/api/feeding/${f.id}`)
    showToast('已删除')
    await load()
  } catch (e) {
    showToast(e.message || '删除失败')
  }
}

function goSettings() {
  sheet.value = ''
  router.push('/settings')
}

function onTouchStart(e, f) {
  list.value.forEach(i => { if (i !== f) i._x = 0 })
  swipe = { id: f.id, kind: f._kind, startX: e.touches[0].clientX, base: f._x || 0 }
}
function onTouchMove(e, f) {
  if (!swipe || swipe.id !== f.id || swipe.kind !== f._kind) return
  const dx = e.touches[0].clientX - swipe.startX
  f._x = Math.max(-72, Math.min(0, swipe.base + dx))
}
function onTouchEnd(f) {
  if (!swipe) return
  f._x = (f._x || 0) <= -36 ? -72 : 0
  swipe = null
}
</script>
