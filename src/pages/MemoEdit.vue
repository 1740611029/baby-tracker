<template>
  <div class="page">
    <header class="app-header">
      <button class="icon-btn" @click="$router.back()">‹</button>
      <div class="title-sm">{{ isNew ? '新增备忘' : '备忘详情' }}</div>
      <button v-if="!isNew" class="icon-btn" style="color:var(--danger)" @click="del">🗑</button>
      <div v-else style="width:38px"></div>
    </header>

    <div class="body">
      <input class="memo-edit-title-input" v-model.trim="form.title" placeholder="标题" maxlength="50" />
      <div v-if="!isNew" class="memo-edit-meta">创建于 {{ createdText }} · 可直接编辑</div>
      <textarea class="memo-edit-body" v-model="form.content" placeholder="记点什么…" rows="6"></textarea>

      <div class="memo-imgs">
        <div v-for="(img, i) in form.images" :key="i" class="mi">
          <img :src="img" @click="preview = img" />
          <span class="del" @click="form.images.splice(i, 1)">×</span>
        </div>
        <button v-if="form.images.length < 9" class="mi add" @click="pick">＋</button>
      </div>

      <button class="btn-save" style="margin-top:auto" @click="save">{{ isNew ? '保 存' : '保存修改' }}</button>
    </div>

    <div v-if="preview" class="lightbox" @click="preview = ''"><img :src="preview" /></div>

    <TabBar />
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api } from '../utils/api'
import { pickImages, MEMO_IMG } from '../utils/image'
import { showToast, showConfirm, showLoading, hideLoading } from '../utils/ui'
import TabBar from '../components/TabBar.vue'

const route = useRoute()
const router = useRouter()
const isNew = computed(() => route.path === '/memo/new')
const preview = ref('')
const createdText = ref('')
const form = reactive({ title: '', content: '', images: [] })

onMounted(async () => {
  if (isNew.value) return
  showLoading()
  try {
    // 拿地址而不是 base64：旧图在保存时原样回传地址，服务端按索引取回原图，
    // 这样「新增一张图」的请求体只有新图那么大，不会把几 MB 全量重传。
    const m = await api.get(`/api/memo/${route.params.id}`)
    form.title = m.title
    form.content = m.content
    form.images = m.images || []
    const d = new Date(m.created_at)
    createdText.value = `${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  } catch (e) {
    showToast('加载失败')
    router.back()
  } finally {
    hideLoading()
  }
})

async function pick() {
  // 串行压缩 9 张在低端机上要好几秒，期间主线程基本卡住，先给个遮罩
  showLoading()
  try {
    const imgs = await pickImages(true, MEMO_IMG)
    form.images.push(...imgs.slice(0, 9 - form.images.length))
  } catch (e) {
    showToast('图片处理失败，请换一张试试')
  } finally {
    hideLoading()
  }
}

async function save() {
  if (!form.title) return showToast('请输入标题')
  showLoading()
  try {
    if (isNew.value) {
      await api.post('/api/memos', { title: form.title, content: form.content, images: form.images })
    } else {
      // 编辑是整行覆盖，重试一次不会产生副作用；新建是 INSERT，绝不能重试
      await api.post(
        `/api/memo/${route.params.id}`,
        { title: form.title, content: form.content, images: form.images },
        { retry: true }
      )
    }
    showToast('已保存')
    router.back()
  } catch (e) {
    showToast(e.message || '保存失败')
  } finally {
    hideLoading()
  }
}

async function del() {
  const ok = await showConfirm({ title: '删除这条备忘？', content: form.title, confirmText: '删除', danger: true })
  if (!ok) return
  showLoading()
  try {
    await api.del(`/api/memo/${route.params.id}`)
    showToast('已删除')
    router.replace('/memos')
  } catch (e) {
    showToast(e.message || '删除失败')
  } finally {
    hideLoading()
  }
}
</script>
