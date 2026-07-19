import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AdminState {
  token: string | null
  admin: { id: string; email: string } | null
  setAuth: (token: string, admin: { id: string; email: string }) => void
  logout: () => void
}

export const useAdminStore = create<AdminState>()(
  persist(
    (set) => ({
      token: null,
      admin: null,
      setAuth: (token, admin) => set({ token, admin }),
      logout: () => set({ token: null, admin: null }),
    }),
    { name: 'admin-auth' }
  )
)
