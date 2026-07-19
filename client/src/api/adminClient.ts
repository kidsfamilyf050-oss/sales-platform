import axios from 'axios'
import { useAdminStore } from '../store/adminAuth'

// Use relative URL so it works on any domain (Railway, localhost, etc.)
export const adminApi = axios.create({ baseURL: '' })

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
