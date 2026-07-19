import axios from 'axios'
import { useAuthStore } from '../store/auth'

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
})

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (r) => r,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout()
      window.location.href = '/login'
    }
    if (error.response?.status === 403) {
      const code = error.response?.data?.error
      const message = error.response?.data?.message
      if (code === 'SUBSCRIPTION_INACTIVE' || code === 'TRIAL_EXPIRED') {
        // Show a blocking overlay — don't logout, owner can still access billing
        if (!document.getElementById('subscription-error-overlay')) {
          const overlay = document.createElement('div')
          overlay.id = 'subscription-error-overlay'
          overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:9999;display:flex;align-items:center;justify-content:center;'
          overlay.innerHTML = `<div style="background:#fff;border-radius:16px;padding:32px;max-width:420px;text-align:center;margin:16px">
            <div style="font-size:2.5rem;margin-bottom:12px">⏰</div>
            <h2 style="font-size:1.25rem;font-weight:700;color:#111;margin-bottom:8px">${code === 'TRIAL_EXPIRED' ? 'Пробный период истёк' : 'Доступ приостановлен'}</h2>
            <p style="color:#666;font-size:0.9rem;margin-bottom:20px">${message || 'Обратитесь к руководителю для продления доступа.'}</p>
            <button onclick="document.getElementById('subscription-error-overlay').remove()" style="background:#3b82f6;color:#fff;border:none;padding:10px 24px;border-radius:8px;cursor:pointer;font-size:0.9rem">Понятно</button>
          </div>`
          document.body.appendChild(overlay)
        }
      }
    }
    return Promise.reject(error)
  }
)
