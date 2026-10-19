<template>
  <div class="page">
    <header class="app-header">
      <button class="icon-btn" @click="$router.back()">‹</button>
      <div class="title-sm">提醒与快捷设置</div>
      <div style="width:38px"></div>
    </header>

    <div class="body">
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
        设置保存在本机浏览器，即时生效
      </div>
    </div>

    <TabBar />
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { settings, saveSettings } from '../utils/settings'
import { showToast } from '../utils/ui'
import TabBar from '../components/TabBar.vue'

const newAmount = ref(null)
const newWord = ref('')
const newEventWord = ref('')

function step(d) {
  const v = Math.round((settings.interval + d) * 10) / 10
  settings.interval = Math.min(12, Math.max(1, v))
  saveSettings()
}

function addAmount() {
  const v = Math.round(newAmount.value)
  if (!v || v < 1 || v > 999) return showToast('请输入有效奶量')
  if (settings.amounts.includes(v)) return showToast('已存在')
  if (settings.amounts.length >= 8) return showToast('最多 8 个快捷值')
  settings.amounts.push(v)
  settings.amounts.sort((a, b) => a - b)
  newAmount.value = null
  saveSettings()
  showToast('已添加')
}
function removeAmount(a) {
  if (settings.amounts.length <= 1) return showToast('至少保留一个')
  settings.amounts = settings.amounts.filter(i => i !== a)
  saveSettings()
}

function addWord(key) {
  const src = key === 'eventWords' ? newEventWord : newWord
  const list = settings[key]
  const v = src.value.trim()
  if (!v) return showToast('请输入快捷词')
  if (list.includes(v)) return showToast('已存在')
  if (list.length >= 8) return showToast('最多 8 个快捷词')
  list.push(v)
  src.value = ''
  saveSettings()
  showToast('已添加')
}
function removeWord(key, w) {
  settings[key] = settings[key].filter(i => i !== w)
  saveSettings()
}
</script>
