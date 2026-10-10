<template>
  <nav class="tabbar">
    <router-link
      v-for="t in tabs"
      :key="t.path"
      :to="t.path"
      class="tab"
      :class="{ active: isActive(t) }"
    >
      <span class="ti">{{ t.icon }}</span>{{ t.name }}
    </router-link>
  </nav>
</template>

<script setup>
import { useRoute } from 'vue-router'

const route = useRoute()
const tabs = [
  { path: '/', name: '喂奶', icon: '🍼' },
  { path: '/todos', name: '待办', icon: '✅' },
  { path: '/memos', name: '备忘', icon: '📝' }
]

function isActive(t) {
  if (t.path === '/') return route.path === '/'
  return route.path.startsWith(t.path) || (t.path === '/memos' && route.path.startsWith('/memo'))
}
</script>
