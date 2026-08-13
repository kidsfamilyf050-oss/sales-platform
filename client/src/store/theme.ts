import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface ThemeStore {
  dark: boolean
  toggle: () => void
  setDark: (v: boolean) => void
}

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set) => ({
      dark: false,
      toggle: () => set(s => {
        const next = !s.dark
        document.documentElement.classList.toggle('dark', next)
        return { dark: next }
      }),
      setDark: (v) => {
        document.documentElement.classList.toggle('dark', v)
        set({ dark: v })
      },
    }),
    { name: 'sp-theme' }
  )
)

// Apply saved theme on page load
export function initTheme() {
  const stored = localStorage.getItem('sp-theme')
  if (stored) {
    try {
      const { state } = JSON.parse(stored)
      if (state?.dark) document.documentElement.classList.add('dark')
    } catch {}
  }
}
