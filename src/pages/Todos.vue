<template>
  <div class="page">
    <header class="app-header">
      <div class="title">待办事项</div>
      <div style="width:38px"></div>
    </header>

    <div class="body">
      <div class="seg">
        <span :class="{ on: tab === 'doing' }" @click="tab = 'doing'">进行中 {{ doing.length }}</span>
        <span :class="{ on: tab === 'done' }" @click="tab = 'done'">已完成 {{ doneList.length }}</span>
      </div>

      <template v-if="shown.length">
        <div v-for="t in shown" :key="t.id" class="card todo-item" :class="{ done: t.done }">
          <button class="pin-btn" :class="{ on: t.pinned }" @click.stop="togglePin(t)">📌</button>
          <div class="tt" @click="edit(t)">
            <span class="tt-title">{{ t.title }}</span>
            <small>{{ subtitle(t) }}</small>
            <span v-if="t.due_time" class="due-chip">{{ dueText(t.due_time) }}</span>
          </div>
          <img v-if="t.image" class="todo-thumb" :src="t.image" loading="lazy" @click.stop="preview = t.image" />
          <button v-if="!t.done" class="btn-finish" @click.stop="toggle(t)">完成</button>
          <span v-else class="done-mark">✓</span>
        </div>
      </template>

      <div v-else-if="!loadingList" class="empty">
        <div class="empty-art">✅</div>
        <div class="empty-title">{{ tab === 'doing' ? '没有进行中的待办' : '还没有已完成的待办' }}</div>
        <div class="empty-desc">点右下角 ＋ 记下要做的事<br>还可以设置时间、贴上截图</div>
      </div>
    </div>

    <button class="fab" @click="openNew">＋</button>

    <div v-if="sheet" class="dim" @click="sheet = false"></div>
    <div v-if="sheet" class="sheet">
      <div class="grab"></div>
      <h5>{{ form.id ? '编辑待办' : '新增待办' }} ✅</h5>
      <textarea
        ref="titleEl"
        class="title-input"
        rows="1"
        v-model="form.title"
        placeholder="要做什么？（可多行，随输入自动增高）"
        @input="autoGrow"
      ></textarea>
      <div class="field-label"><span>时间（可选）</span></div>
      <input type="datetime-local" class="time-pill" v-model="form.due" />
      <div class="field-label"><span>截图 / 图片（可选）</span></div>
      <div class="img-upload">
        <div v-if="form.image" class="thumb">
          <img :src="form.image" />
          <span class="del" @click="form.image = ''">×</span>
        </div>
        <button v-else class="ph" @click="pick"><span class="pi">🖼</span>添加图片</button>
      </div>
      <button class="btn-save" @click="save">保 存</button>
      <button v-if="form.id" class="btn-danger-ghost" @click="del">删除此待办</button>
    </div>

    <div v-if="preview" class="lightbox" @click="preview = ''"><img :src="preview" /></div>

    <TabBar />
  </div>
</template>

<script setup>
import { ref, reactive, computed, nextTick, onMounted, onUnmounted } from 'vue'
import { api } from '../utils/api'
import { pickImages, compressImage } from '../utils/image'
import { showToast, showConfirm, showLoading, hideLoading } from '../utils/ui'
import TabBar from '../components/TabBar.vue'

const list = ref([])
const loadingList = ref(true)
const tab = ref('doing')
const sheet = ref(false)
const preview = ref('')
const titleEl = ref(null)
const form = reactive({ id: null, title: '', image: '', due: '' })

const doing = computed(() => list.value.filter(t => !t.done))
const doneList = computed(() => list.value.filter(t => t.done))
const shown = computed(() => tab.value === 'doing' ? doing.value : doneList.value)

function subtitle(t) {
  const d = new Date(t.created_at)
  const created = `${d.getMonth() + 1}月${d.getDate()}日`
  if (t.done && t.completed_at) {
    const c = new Date(t.completed_at)
    return `已完成 · ${c.getMonth() + 1}月${c.getDate()}日`
  }
  return created
}

function dueText(iso) {
  const d = new Date(iso)
  const p = n => String(n).padStart(2, '0')
  return `${d.getMonth() + 1}月${d.getDate()}日 ${p(d.getHours())}:${p(d.getMinutes())}`
}

function toLocalInputValue(iso) {
  const d = new Date(iso)
  const p = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

function autoGrow() {
  const el = titleEl.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = Math.min(el.scrollHeight, 240) + 'px'
}

async function load() {
  try {
    list.value = await api.get('/api/todos')
  } catch (e) {
    showToast('加载失败，请重试')
  } finally {
    loadingList.value = false
  }
}

onMounted(() => {
  load()
  document.addEventListener('paste', onPaste)
})
onUnmounted(() => document.removeEventListener('paste', onPaste))

function openNew() {
  form.id = null
  form.title = ''
  form.image = ''
  form.due = ''
  sheet.value = true
  nextTick(autoGrow)
}

function edit(t) {
  form.id = t.id
  form.title = t.title
  form.image = t.image || ''
  form.due = t.due_time ? toLocalInputValue(t.due_time) : ''
  sheet.value = true
  nextTick(autoGrow)
}

async function pick() {
  const [img] = await pickImages()
  if (img) form.image = img
}

async function onPaste(e) {
  if (!sheet.value) return
  const file = [...(e.clipboardData?.files || [])].find(f => f.type.startsWith('image/'))
  if (file) form.image = await compressImage(file)
}

async function toggle(t) {
  const prev = t.done
  t.done = prev ? 0 : 1
  try {
    await api.post(`/api/todo/${t.id}`, { done: t.done })
    if (t.done) showToast('已完成 🎉')
  } catch (e) {
    t.done = prev
    showToast(e.message || '操作失败')
  }
}

async function togglePin(t) {
  const prev = t.pinned
  t.pinned = prev ? 0 : 1
  try {
    await api.post(`/api/todo/${t.id}`, { pinned: t.pinned })
    await load()
  } catch (e) {
    t.pinned = prev
    showToast(e.message || '操作失败')
  }
}

async function save() {
  const title = form.title.trim()
  if (!title) return showToast('请输入待办内容')
  const payload = {
    title,
    image: form.image,
    due_time: form.due ? new Date(form.due).toISOString() : ''
  }
  showLoading()
  try {
    if (form.id) {
      await api.post(`/api/todo/${form.id}`, payload)
    } else {
      await api.post('/api/todos', payload)
    }
    sheet.value = false
    showToast('已保存')
    await load()
  } catch (e) {
    showToast(e.message || '保存失败')
  } finally {
    hideLoading()
  }
}

async function del() {
  const ok = await showConfirm({ title: '删除这条待办？', confirmText: '删除', danger: true })
  if (!ok) return
  showLoading()
  try {
    await api.del(`/api/todo/${form.id}`)
    sheet.value = false
    showToast('已删除')
    await load()
  } catch (e) {
    showToast(e.message || '删除失败')
  } finally {
    hideLoading()
  }
}
</script>
