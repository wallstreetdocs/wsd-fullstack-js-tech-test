import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router/index.js'
import vuetify from './plugins/vuetify.js'
import './styles/main.scss'
import socket from './plugins/socket.js'

// Initialize socket connection
console.log('🚀 Initializing socket connection...')
socket.connect()

const app = createApp(App)

app.use(createPinia())
app.use(router)
app.use(vuetify)

app.mount('#app')
