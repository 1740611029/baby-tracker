import { createRouter, createWebHistory } from 'vue-router'
import Feedings from './pages/Feedings.vue'
import Todos from './pages/Todos.vue'
import Memos from './pages/Memos.vue'
import MemoEdit from './pages/MemoEdit.vue'
import Settings from './pages/Settings.vue'

// 页面全部静态打包：整站 JS 只有 100 多 KB，拆包省不了多少流量，
// 却让每次切页都要多一次网络往返 —— 弱网/切网时正是这一步最容易失败
// （表现为 Failed to fetch dynamically imported module，按钮点了没反应）。
const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: Feedings },
    { path: '/todos', component: Todos },
    { path: '/memos', component: Memos },
    { path: '/memo/new', component: MemoEdit },
    { path: '/memo/:id', component: MemoEdit },
    { path: '/settings', component: Settings }
  ]
})

// 兜底：将来若又改回懒加载，分包拉取失败时自动刷新一次，而不是静默无响应
router.onError(err => {
  console.error('[router]', err)
  if (/dynamically imported module|Importing a module script failed/i.test(String(err && err.message))) {
    try {
      if (!sessionStorage.getItem('bt_chunk_retry')) {
        sessionStorage.setItem('bt_chunk_retry', '1')
        location.reload()
      }
    } catch (e) { /* 隐私模式下 sessionStorage 不可用，忽略 */ }
  }
})

router.afterEach(() => {
  try { sessionStorage.removeItem('bt_chunk_retry') } catch (e) { /* ignore */ }
})

export default router
