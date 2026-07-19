import axios from 'axios'
import { useAdminStore } from '../store/adminAuth'

// Derive server root from VITE_API_URL (e.g. https://server.railway.app/api → https://server.railway.app)
// In dev (no env var): empty string → relative URLs like /api/admin/login work via vite proxy
const viteApiUrl = import.meta.env.VITE_API_URL || ''
const serverBase = viteApiUrl.endsWith('/api') ? viteApiUrl.slice(0, -4) : viteApiUrl

export const adminApi = axios.create({ baseURL: serverBase })

adminApi.interceptors.request.use((config) => {
  const token = useAdminStore.getState().token
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

adminApi.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      useAdminStore.getState().logout()
      window.location.href = '/admin/login'
    }
    return Promise.reject(err)
  }
)
