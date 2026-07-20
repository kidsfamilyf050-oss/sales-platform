import { useEffect } from 'react'
import { api } from '../api/client'
import { useAuthStore } from '../store/auth'

/** Sends a heartbeat to /api/auth/heartbeat every 5 minutes to keep lastSeenAt fresh */
export function useHeartbeat() {
  const token = useAuthStore(s => s.token)
  useEffect(() => {
    if (!token) return
    const send = () => api.post('/auth/heartbeat').catch(() => {})
    send() // send on mount
    const id = setInterval(send, 5 * 60 * 1000)
    return () => clearInterval(id)
  }, [token])
}
