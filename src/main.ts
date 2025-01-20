import { createApp } from 'vue'
import App from './App.vue'
import './style.css'

// 只在选项页面启用 Vue
if (location.protocol === 'chrome-extension:') {
  const root = document.getElementById('app')
  if (root) {
    const app = createApp(App)
    app.mount(root)
  }
}
