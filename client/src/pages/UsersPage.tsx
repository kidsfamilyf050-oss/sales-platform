import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import { UserPlus, Archive, Mail, Pencil, X, Check } from 'lucide-react'

const roleLabels: Record<string, string> = { OWNER: 'Собственник', ROP: 'РОП', MANAGER: 'Менеджер', MARKETER: 'Маркетолог' }
const managerTypeLabels: Record<string, string> = { LIDER: 'Лидоруб', CLOSER: 'Клоузер' }

const emptyForm = { name: '', email: '', phone: '', role: 'MANAGER', managerType: 'CLOSER', departmentId: '' }

export default function UsersPage() {
  const qc = useQueryClient()
  const [showForm, setShowForm]     = useState(false)
  const [form, setForm]             = useState(emptyForm)
  const [inviteLink, setInviteLink] = useState('')
  const [editingId, setEditingId]   = useState<string | null>(null)
  const [editForm, setEditForm]     = useState<any>({})
  const [editSaved, setEditSaved]   = useState(false)

  const { data: users = [], isLoading } = useQuery({ queryKey: ['users'], queryFn: () => api.get('/users').then(r => r.data) })
  const { data: departments = [] }      = useQuery({ queryKey: ['departments'], queryFn: () => api.get('/company/departments').then(r => r.data) })

  const invite = useMutation({
    mutationFn: (data: typeof form) => api.post('/users/invite', data).then(r => r.data),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['users'] })
      const link = `${window.location.origin}/accept-invite?token=${data.inviteToken}`
      setInviteLink(link)
      setShowForm(false)
      setForm(emptyForm)
    },
  })

  const updateUser = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.put(`/users/${id}`, data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
      setEditSaved(true)
      setTimeout(() => { setEditSaved(false); setEditingId(null) }, 1200)
    },
  })

  const archive = useMutation({
    mutationFn: (id: string) => api.delete(`/users/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  })

  function startEdit(u: any) {
    setEditingId(u.id)
    setEditSaved(false)
    setEditForm({
      name: u.name || '',
      phone: u.phone || '',
      role: u.role,
      managerType: u.managerType || 'CLOSER',
      departmentId: u.departmentId || '',
    })
  }

  if (isLoading) return <div className="flex items-center justify-center h-64 text-gray-400">Загрузка...</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Сотрудники</h1>
          <p className="text-gray-500 text-sm mt-0.5">{users.filter((u: any) => u.status === 'ACTIVE').length} активных</p>
        </div>
        <button onClick={() => { setShowForm(true); setEditingId(null) }} className="btn-primary flex items-center gap-2">
          <UserPlus className="w-4 h-4" />
          Добавить сотрудника
        </button>
      </div>

      {/* Invite link */}
      {inviteLink && (
        <div className="card border border-green-200 bg-green-50">
          <p className="text-sm font-medium text-green-800 mb-2">✅ Приглашение создано! Ссылка для входа:</p>
          <div className="flex gap-2">
            <input readOnly value={inviteLink} className="input text-xs flex-1 bg-white" onClick={e => (e.target as HTMLInputElement).select()} />
            <button onClick={() => navigator.clipboard.writeText(inviteLink)} className="btn-secondary text-sm whitespace-nowrap">Копировать</button>
          </div>
        </div>
      )}

      {/* Add form */}
      {showForm && (
        <div className="card border-2 border-blue-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2"><UserPlus className="w-4 h-4" /> Новый сотрудник</h3>
            <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
          </div>
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

      {/* Users table */}
      <div className="card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b border-gray-100 bg-gray-50">
              <th className="px-5 py-3 font-medium">Сотрудник</th>
              <th className="px-4 py-3 font-medium">Роль</th>
              <th className="px-4 py-3 font-medium">Отдел</th>
              <th className="px-4 py-3 font-medium">Статус</th>
              <th className="px-4 py-3 font-medium w-20"></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u: any) => (
              <>
                <tr key={u.id} className={`border-b border-gray-50 hover:bg-gray-50/50 transition-colors ${u.status === 'ARCHIVED' ? 'opacity-40' : ''} ${editingId === u.id ? 'bg-blue-50/30' : ''}`}>
                  <td className="px-5 py-3">
                    <p className="font-medium text-gray-900">{u.name}</p>
                    <p className="text-gray-400 text-xs">{u.email}</p>
                    {u.phone && <p className="text-gray-400 text-xs">{u.phone}</p>}
                  </td>
                  <td className="px-4 py-3">
                    {roleLabels[u.role]}
                    {u.managerType && <span className="ml-1 text-xs text-gray-400">({managerTypeLabels[u.managerType]})</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{u.department?.name || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${u.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {u.status === 'ACTIVE' ? 'Активен' : 'Архив'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {u.role !== 'OWNER' && u.status === 'ACTIVE' && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => editingId === u.id ? setEditingId(null) : startEdit(u)}
                          className={`p-1.5 rounded transition-colors ${editingId === u.id ? 'text-blue-600 bg-blue-100' : 'text-gray-400 hover:text-blue-600 hover:bg-blue-50'}`}
                          title="Редактировать"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => { if (confirm(`Архивировать ${u.name}?`)) archive.mutate(u.id) }}
                          className="p-1.5 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                          title="Архивировать"
                        >
                          <Archive className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>

                {/* Inline edit row */}
                {editingId === u.id && (
                  <tr key={`edit-${u.id}`} className="bg-blue-50/40 border-b border-blue-100">
                    <td colSpan={5} className="px-5 py-4">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                        <div>
                          <label className="text-xs text-gray-500 block mb-1">ФИО</label>
                          <input className="input text-sm py-1.5" value={editForm.name}
                            onChange={e => setEditForm((f: any) => ({ ...f, name: e.target.value }))} />
                        </div>
                        <div>
                          <label className="text-xs text-gray-500 block mb-1">Телефон</label>
                          <input className="input text-sm py-1.5" value={editForm.phone}
                            onChange={e => setEditForm((f: any) => ({ ...f, phone: e.target.value }))} />
                        </div>
                        <div>
                          <label className="text-xs text-gray-500 block mb-1">Роль</label>
                          <select className="input text-sm py-1.5" value={editForm.role}
                            onChange={e => setEditForm((f: any) => ({ ...f, role: e.target.value }))}>
                            <option value="ROP">РОП</option>
                            <option value="MANAGER">Менеджер</option>
                            <option value="MARKETER">Маркетолог</option>
                          </select>
                        </div>
                        {editForm.role === 'MANAGER' && (
                          <div>
                            <label className="text-xs text-gray-500 block mb-1">Тип</label>
                            <select className="input text-sm py-1.5" value={editForm.managerType}
                              onChange={e => setEditForm((f: any) => ({ ...f, managerType: e.target.value }))}>
                              <option value="CLOSER">Клоузер</option>
                              <option value="LIDER">Лидоруб</option>
                            </select>
                          </div>
                        )}
                        {departments.length > 0 && (
                          <div>
                            <label className="text-xs text-gray-500 block mb-1">Отдел</label>
                            <select className="input text-sm py-1.5" value={editForm.departmentId}
                              onChange={e => setEditForm((f: any) => ({ ...f, departmentId: e.target.value }))}>
                              <option value="">— не выбран —</option>
                              {departments.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
                            </select>
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => updateUser.mutate({ id: u.id, data: editForm })}
                          disabled={updateUser.isPending || !editForm.name}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-40 transition-colors"
                        >
                          {editSaved ? <><Check className="w-3.5 h-3.5" /> Сохранено</> : <><Check className="w-3.5 h-3.5" /> Сохранить</>}
                        </button>
                        <button onClick={() => setEditingId(null)}
                          className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                          <X className="w-3.5 h-3.5" /> Отмена
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
