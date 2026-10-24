<template>
  <div class="page">
    <header class="app-header">
      <button class="icon-btn" @click="$router.back()">‹</button>
      <div class="title-sm">提醒与快捷设置</div>
      <div style="width:38px"></div>
    </header>

    <div class="body">
      <div v-if="settingsMeta.offline" class="tip-banner err" style="margin-bottom:10px">
        <span class="dot"></span>没连上服务器，现在看到的是上次同步的设置
        <button class="retry-btn" @click="retrySync">重试</button>
      </div>

      <div class="card set-group">
        <div class="set-row">
          <div class="sl">喂奶间隔<small>超过间隔后，打开首页会提示</small></div>
          <div class="stepper">
            <button class="st-btn" @click="step(-0.5)">−</button>
            <div class="st-val">{{ settings.interval }}<small> 小时</small></div>
            <button class="st-btn" @click="step(0.5)">＋</button>
          </div>
        </div>
      </div>

      <div class="card set-group">
        <div class="set-row">
          <div class="sl">展示时长<small>首页只显示这段时间内的记录</small></div>
          <div class="stepper">
            <button class="st-btn" @click="stepWindow(-1)">−</button>
            <div class="st-val">{{ settings.feedWindowHours }}<small> 小时</small></div>
            <button class="st-btn" @click="stepWindow(1)">＋</button>
          </div>
        </div>
        <div class="set-note">
          每次打开时，超出这段时长的喂奶记录会被永久删除（始终至少保留最近 6 条）。调小请谨慎。
        </div>
      </div>

      <div class="card set-group">
        <div class="set-row" style="border-bottom:none;padding-bottom:2px">
          <div class="sl">快捷奶量<small>点 × 删除，最多 8 个</small></div>
        </div>
        <div class="chips" style="padding:8px 0 4px">
          <span v-for="a in settings.amounts" :key="a" class="chip x">{{ a }}<i class="xi" @click="removeAmount(a)">×</i></span>
        </div>
        <div class="add-row">
          <input class="ar-input" type="number" inputmode="numeric" v-model.number="newAmount" placeholder="输入新奶量，如 150" />
          <button class="ar-btn" @click="addAmount">添加</button>
        </div>
      </div>

      <div class="card set-group">
        <div class="set-row" style="border-bottom:none;padding-bottom:2px">
          <div class="sl">喂奶备注词<small>记一笔时的快捷词，如「亲喂」「拍嗝」</small></div>
        </div>
        <div class="chips" style="padding:8px 0 4px">
          <span v-for="w in settings.words" :key="w" class="chip word x">{{ w }}<i class="xi" @click="removeWord('words', w)">×</i></span>
        </div>
        <div class="add-row">
          <input class="ar-input" v-model.trim="newWord" placeholder="输入新快捷词" maxlength="10" />
          <button class="ar-btn" @click="addWord('words')">添加</button>
        </div>
      </div>

      <div class="card set-group">
        <div class="set-row" style="border-bottom:none;padding-bottom:2px">
          <div class="sl">快捷事件<small>记事件时一键填入事件名，如「打疫苗」「外出」</small></div>
        </div>
        <div class="chips" style="padding:8px 0 4px">
          <span v-for="w in settings.eventWords" :key="w" class="chip word x">{{ w }}<i class="xi" @click="removeWord('eventWords', w)">×</i></span>
        </div>
        <div class="add-row">
          <input class="ar-input" v-model.trim="newEventWord" placeholder="输入新事件名" maxlength="10" />
          <button class="ar-btn" @click="addWord('eventWords')">添加</button>
        </div>
      </div>

      <div style="font-size:11px;color:var(--ink-3);text-align:center;padding:8px 0">
        <template v-if="settingsMeta.syncing">正在读取云端设置…</template>
        <template v-else-if="settingsMeta.offline">离线修改不会保存，联网后请重试</template>
        <template v-else-if="settingsMeta.saving || settingsMeta.pending">正在保存到云端…</template>
        <template v-else>设置已同步到云端，换设备自动一致</template>
      </div>
    </div>

    <TabBar />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { settings, settingsMeta, loadSettingsFromServer, mutate } from '../utils/settings'
import { showToast } from '../utils/ui'
import TabBar from '../components/TabBar.vue'

const newAmount = ref(null)
const newWord = ref('')
const newEventWord = ref('')

// 每次进设置页都拉一次，保证另一台设备改过的快捷词在这里生效
onMounted(() => {
  loadSettingsFromServer()
})

function retrySync() {
  loadSettingsFromServer()
}

// 统一的失败提示：reason 是本地校验（不发请求），error 是网络/服务端失败
function fail(r) {
  if (r.reason) return showToast(r.reason)
  if (!r.ok) showToast(r.error || '同步失败，请重试')
}

async function step(d) {
  const r = await mutate(s => {
    const v = Math.min(12, Math.max(1, Math.round((s.interval + d) * 2) / 2))
    if (v === s.interval) return 'unchanged'
    s.interval = v
  })
  if (r.reason === 'unchanged') return
  fail(r)
}

async function stepWindow(d) {
  const r = await mutate(s => {
    const v = Math.min(72, Math.max(1, s.feedWindowHours + d))
    if (v === s.feedWindowHours) return 'unchanged'
    s.feedWindowHours = v
  })
  if (r.reason === 'unchanged') return
  fail(r)
}

async function addAmount() {
  const v = Math.round(newAmount.value)
  if (!v || v < 1 || v > 999) return showToast('请输入有效奶量')
  const r = await mutate(s => {
    if (s.amounts.includes(v)) return '已存在'
    if (s.amounts.length >= 8) return '最多 8 个快捷值'
    s.amounts.push(v)
    s.amounts.sort((a, b) => a - b)
  })
  if (r.reason || !r.ok) return fail(r)
  newAmount.value = null
  showToast('已添加')
}

async function removeAmount(a) {
  const r = await mutate(s => {
    if (s.amounts.length <= 1) return '至少保留一个'
    s.amounts = s.amounts.filter(i => i !== a)
  })
  fail(r)
}

async function addWord(key) {
  const src = key === 'eventWords' ? newEventWord : newWord
  const v = src.value.trim()
  if (!v) return showToast('请输入快捷词')
  const r = await mutate(s => {
    if (s[key].includes(v)) return '已存在'
    if (s[key].length >= 8) return '最多 8 个快捷词'
    s[key].push(v)
  })
  if (r.reason || !r.ok) return fail(r)
  src.value = ''
  showToast('已添加')
}

async function removeWord(key, w) {
  const r = await mutate(s => {
    s[key] = s[key].filter(i => i !== w)
  })
  fail(r)
}
</script>
