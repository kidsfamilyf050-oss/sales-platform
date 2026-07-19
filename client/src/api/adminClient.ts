import axios from 'axios'
import { useAdminStore } from '../store/adminAuth'

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

export const adminApi = axios.create({ baseURL: BASE_URL })

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
