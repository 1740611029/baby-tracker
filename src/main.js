import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import './styles/global.css'

createApp(App).use(router).mount('#app')

// 通知 index.html 里的启动兜底脚本：应用已经正常挂载
router.isReady().then(() => {
  window.dispatchEvent(new Event('bt:ready'))
})
