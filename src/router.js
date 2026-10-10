import { createRouter, createWebHistory } from 'vue-router'

export default createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: () => import('./pages/Feedings.vue') },
    { path: '/todos', component: () => import('./pages/Todos.vue') },
    { path: '/memos', component: () => import('./pages/Memos.vue') },
    { path: '/memo/new', component: () => import('./pages/MemoEdit.vue') },
    { path: '/memo/:id', component: () => import('./pages/MemoEdit.vue') },
    { path: '/settings', component: () => import('./pages/Settings.vue') }
  ]
})
