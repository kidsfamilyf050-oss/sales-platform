import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface User {
  id: string
  name: string
  email: string
  role: 'OWNER' | 'ROP' | 'MANAGER' | 'MARKETER'
  managerType: 'LIDER' | 'CLOSER' | null
  companyId: string
  departmentId: string | null
  canManageGateways?: boolean
  /** Company's business sphere: 'edu' | 'med' | 'realty' | 'it' | 'retail' | 'services' | 'construction' | 'other' */
  businessSphere?: string | null
}

interface AuthState {
  token: string | null
  user: User | null
  setAuth: (token: string, user: User) => void
  setUser: (user: User) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      setAuth: (token, user) => set({ token, user }),
      setUser: (user) => set({ user }),
      logout: () => set({ token: null, user: null }),
    }),
    { name: 'auth-storage' }
  )
)
