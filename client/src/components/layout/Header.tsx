import { Bell } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../api/client'
import PeriodSelector from '../ui/PeriodSelector'
import LanguageSwitcher from '../ui/LanguageSwitcher'

export default function Header() {
  const { data } = useQuery({
    queryKey: ['notifications-count'],
    queryFn: () => api.get('/notifications/unread-count').then(r => r.data),
    refetchInterval: 60_000,
  })

  return (
    <header className="h-14 bg-white border-b border-gray-100 flex items-center justify-between px-6">
      <PeriodSelector />
      <div className="flex items-center gap-3">
        <LanguageSwitcher />
        <button className="relative p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg">
          <Bell className="w-5 h-5" />
          {data?.count > 0 && (
            <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center">
              {data.count > 9 ? '9+' : data.count}
            </span>
          )}
        </button>
      </div>
    </header>
  )
}
