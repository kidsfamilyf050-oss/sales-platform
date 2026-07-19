import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import { UserPlus, Archive, Mail } from 'lucide-react'

const roleLabels: Record<string, string> = { OWNER: 'Собственник', ROP: 'РОП', MANAGER: 'Менеджер', MARKETER: 'Маркетолог' }
const managerTypeLabels: Record<string, string> = { LIDER: 'Лидоруб', CLOSER: 'Клоузер' }

export default function UsersPage() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', phone: '', role: 'MANAGER', managerType: 'CLOSER', departmentId: '' })
  const [inviteLink, setInviteLink] = useState('')

  const { data: users = [], isLoading } = useQuery({ queryKey: ['users'], queryFn: () => api.get('/users').then(r => r.data) })
  const { data: departments = [] } = useQuery({ queryKey: ['departments'], queryFn: () => api.get('/company/departments').then(r => r.data) })

  const invite = useMutation({
    mutationFn: (data: typeof form) => api.post('/users/invite', data).then(r => r.data),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['users'] })
      const link = `${window.location.origin}/accept-invite?token=${data.inviteToken}`
      setInviteLink(link)
      setShowForm(false)
    },
  })

  const archive = useMutation({
    mutationFn: (id: string) => api.delete(`/users/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  })

  if (isLoading) return <div className="flex items-center justify-center h-64 text-gray-400">Загрузка...</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Сотрудники</h1>
          <p className="text-gray-500 text-sm mt-0.5">{users.filter((u: any) => u.status === 'ACTIVE').length} активных</p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2">
          <UserPlus className="w-4 h-4" />
          Добавить сотрудника
        </button>
      </div>

      {inviteLink && (
        <div className="card border border-green-200 bg-green-50">
          <p className="text-sm font-medium text-green-800 mb-2">✅ Приглашение создано! Ссылка для входа:</p>
          <div className="flex gap-2">
            <input readOnly value={inviteLink} className="input text-xs flex-1 bg-white" onClick={e => (e.target as HTMLInputElement).select()} />
            <button onClick={() => { navigator.clipboard.writeText(inviteLink); }} className="btn-secondary text-sm whitespace-nowrap">Копировать</button>
          </div>
        </div>
      )}

      {showForm && (
        <div className="card border-2 border-blue-100">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2"><UserPlus className="w-4 h-4" /> Новый сотрудник</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2"><label className="label">ФИО *</label><input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div><label className="label">Email *</label><input type="email" className="input" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
            <div><label className="label">Телефон</label><input className="input" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
            <div>
              <label className="label">Роль *</label>
              <select className="input" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                <option value="ROP">РОП</option>
                <option value="MANAGER">Менеджер по продажам</option>
                <option value="MARKETER">Маркетолог</option>
              </select>
            </div>
            {form.role === 'MANAGER' && (
              <div>
                <label className="label">Тип менеджера</label>
                <select className="input" value={form.managerType} onChange={e => setForm(f => ({ ...f, managerType: e.target.value }))}>
                  <option value="CLOSER">Клоузер</option>
                  <option value="LIDER">Лидоруб</option>
                </select>
              </div>
            )}
            {departments.length > 0 && (
              <div className="col-span-2">
                <label className="label">Отдел</label>
                <select className="input" value={form.departmentId} onChange={e => setForm(f => ({ ...f, departmentId: e.target.value }))}>
                  <option value="">— не выбран —</option>
                  {departments.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
            )}
          </div>
          <div className="flex gap-3 mt-4">
            <button onClick={() => setShowForm(false)} className="btn-secondary flex-1">Отмена</button>
            <button onClick={() => invite.mutate(form)} disabled={!form.name || !form.email || invite.isPending} className="btn-primary flex-1 flex items-center justify-center gap-2">
              <Mail className="w-4 h-4" />
              {invite.isPending ? 'Отправляем...' : 'Отправить приглашение'}
            </button>
          </div>
        </div>
      )}

      <div className="card">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b border-gray-100">
              <th className="pb-3 font-medium">Сотрудник</th>
              <th className="pb-3 font-medium">Роль</th>
              <th className="pb-3 font-medium">Отдел</th>
              <th className="pb-3 font-medium">Статус</th>
              <th className="pb-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u: any) => (
              <tr key={u.id} className={`border-b border-gray-50 ${u.status === 'ARCHIVED' ? 'opacity-50' : ''}`}>
                <td className="py-3">
                  <p className="font-medium text-gray-900">{u.name}</p>
                  <p className="text-gray-400 text-xs">{u.email}</p>
                </td>
                <td className="py-3">
                  {roleLabels[u.role]}
                  {u.managerType && <span className="ml-1 text-xs text-gray-400">({managerTypeLabels[u.managerType]})</span>}
                </td>
                <td className="py-3 text-gray-500">{u.department?.name || '—'}</td>
                <td className="py-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${u.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {u.status === 'ACTIVE' ? 'Активен' : 'Архив'}
                  </span>
                </td>
                <td className="py-3">
                  {u.status === 'ACTIVE' && u.role !== 'OWNER' && (
                    <button onClick={() => { if (confirm(`Архивировать ${u.name}?`)) archive.mutate(u.id) }} className="text-gray-400 hover:text-red-500 transition-colors p-1" title="Архивировать">
                      <Archive className="w-4 h-4" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
