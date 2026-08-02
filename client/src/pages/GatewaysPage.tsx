import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import { CreditCard, Plus, Trash2, Check, X, Eye, EyeOff, Pencil } from 'lucide-react'
import { useAuthStore } from '../store/auth'
import { useT } from '../i18n'

type Gateway = {
  id: string
  name: string
  value: string
  feePct: number
  isActive: boolean
  sortOrder: number
}

function pct(feePct: number) {
  return `${(feePct * 100).toFixed(feePct * 100 % 1 === 0 ? 0 : 2)}%`
}

function AddGatewayForm({ onClose }: { onClose: () => void }) {
  const { t } = useT()
  const qc = useQueryClient()
  const [name, setName] = useState('')
  const [value, setValue] = useState('')
  const [feePct, setFeePct] = useState('3')
  const [autoValue, setAutoValue] = useState(true)

  const createMut = useMutation({
    mutationFn: (data: any) => api.post('/payment-gateways', data).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['payment-gateways'] }); onClose() },
  })

  const handleName = (v: string) => {
    setName(v)
    if (autoValue) {
      setValue(v.trim().replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_а-яёА-ЯЁ]/g, ''))
    }
  }

  const save = () => {
    if (!name.trim() || !value.trim()) return
    createMut.mutate({ name: name.trim(), value: value.trim(), feePct: Number(feePct) / 100 })
  }

  return (
    <div className="card border-blue-200 bg-blue-50/30 space-y-3">
      <h3 className="text-sm font-semibold text-gray-800">{t('gateways.new')}</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="label">{t('gateways.name')}</label>
          <input className="input" placeholder="Например: Halyk Pay" value={name} onChange={e => handleName(e.target.value)} />
        </div>
        <div>
          <label className="label">{t('gateways.code')}</label>
          <input
            className="input font-mono text-sm"
            placeholder="Halyk_Pay"
            value={value}
            onChange={e => { setValue(e.target.value); setAutoValue(false) }}
          />
          <p className="text-xs text-gray-400 mt-0.5">{t('gateways.codeNote')}</p>
        </div>
        <div>
          <label className="label">{t('gateways.fee')}</label>
          <input
            type="number"
            className="input"
            placeholder="3"
            min={0}
            max={100}
            step={0.1}
            value={feePct}
            onChange={e => setFeePct(e.target.value)}
          />
        </div>
      </div>
      {createMut.isError && (
        <p className="text-xs text-red-600">{(createMut.error as any)?.response?.data?.error || t('common.error')}</p>
      )}
      <div className="flex gap-2 justify-end">
        <button onClick={onClose} className="btn-secondary flex items-center gap-1.5 text-sm">
          <X className="w-4 h-4" /> {t('common.cancel')}
        </button>
        <button
          onClick={save}
          disabled={!name.trim() || !value.trim() || createMut.isPending}
          className="btn-primary flex items-center gap-1.5 text-sm disabled:opacity-40"
        >
          <Check className="w-4 h-4" /> {t('common.add')}
        </button>
      </div>
    </div>
  )
}

function GatewayRow({ gw }: { gw: Gateway }) {
  const { t } = useT()
  const qc = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(gw.name)
  const [feePct, setFeePct] = useState(String((gw.feePct * 100).toFixed(gw.feePct * 100 % 1 === 0 ? 0 : 2)))

  const updateMut = useMutation({
    mutationFn: (data: any) => api.put(`/payment-gateways/${gw.id}`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['payment-gateways'] }),
  })
  const deleteMut = useMutation({
    mutationFn: () => api.delete(`/payment-gateways/${gw.id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['payment-gateways'] }),
  })

  const toggleActive = () => updateMut.mutate({ isActive: !gw.isActive })

  const saveEdit = () => {
    if (!name.trim()) return
    updateMut.mutate({ name: name.trim(), feePct: Number(feePct) / 100 })
    setEditing(false)
  }

  const cancelEdit = () => {
    setName(gw.name)
    setFeePct(String((gw.feePct * 100).toFixed(gw.feePct * 100 % 1 === 0 ? 0 : 2)))
    setEditing(false)
  }

  return (
    <div className={`rounded-xl border p-4 transition-all ${gw.isActive ? 'border-gray-200 bg-white' : 'border-gray-100 bg-gray-50 opacity-60'}`}>
      {editing ? (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label text-xs">{t('gateways.name')}</label>
              <input
                autoFocus
                className="input text-sm"
                value={name}
                onChange={e => setName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') cancelEdit() }}
              />
            </div>
            <div>
              <label className="label text-xs">{t('gateways.fee')}</label>
              <input
                type="number"
                className="input text-sm"
                min={0}
                max={100}
                step={0.1}
                value={feePct}
                onChange={e => setFeePct(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') cancelEdit() }}
              />
            </div>
          </div>
          <div className="text-xs text-gray-400">{t('gateways.codeLabel')} <span className="font-mono">{gw.value}</span></div>
          <div className="flex gap-2">
            <button onClick={cancelEdit} className="btn-secondary text-xs flex items-center gap-1">
              <X className="w-3 h-3" /> {t('common.cancel')}
            </button>
            <button onClick={saveEdit} disabled={!name.trim() || updateMut.isPending}
              className="btn-primary text-xs flex items-center gap-1 disabled:opacity-40">
              <Check className="w-3 h-3" /> {t('common.save')}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          {/* Active indicator */}
          <div className={`w-2 h-2 rounded-full shrink-0 ${gw.isActive ? 'bg-green-400' : 'bg-gray-300'}`} />

          {/* Info */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">{gw.name}</p>
            <p className="text-xs text-gray-400 font-mono">{gw.value}</p>
          </div>

          {/* Fee badge */}
          <span className="shrink-0 text-xs font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
            {pct(gw.feePct)}
          </span>

          {/* Actions */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={toggleActive}
              disabled={updateMut.isPending}
              title={gw.isActive ? t('gateways.archiveBtn') : t('gateways.restoreBtn')}
              className={`p-1.5 rounded-lg transition-colors ${gw.isActive ? 'text-green-600 hover:bg-green-50' : 'text-gray-400 hover:bg-gray-100'}`}
            >
              {gw.isActive ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            </button>
            <button
              onClick={() => setEditing(true)}
              title={t('common.edit')}
              className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
            >
              <Pencil className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                if (window.confirm(`Удалить шлюз "${gw.name}"?\n\nЭто не удалит исторические данные продаж.`))
                  deleteMut.mutate()
              }}
              disabled={deleteMut.isPending}
              title={t('common.delete')}
              className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-40"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function GatewaysPage() {
  const { t } = useT()
  const user = useAuthStore(s => s.user)
  const [showAdd, setShowAdd] = useState(false)

  const { data: gateways = [], isLoading } = useQuery<Gateway[]>({
    queryKey: ['payment-gateways'],
    queryFn: () => api.get('/payment-gateways').then(r => r.data),
  })

  const canAccess = user?.role === 'OWNER' || (user?.role === 'ROP' && (user as any).canManageGateways === true)
  if (!canAccess) {
    return <div className="card text-center py-14 text-gray-400">{t('gateways.noAccess')}</div>
  }

  const active = gateways.filter(g => g.isActive)
  const inactive = gateways.filter(g => !g.isActive)

  return (
    <div className="space-y-5 px-4 md:px-6 py-2 md:py-4 max-w-2xl">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('gateways.title')}</h1>
          <p className="text-sm text-gray-400 mt-0.5">{t('gateways.subtitle')}</p>
        </div>
        <button
          onClick={() => setShowAdd(s => !s)}
          className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors whitespace-nowrap"
        >
          <Plus className="w-4 h-4" /> {t('common.add')}
        </button>
      </div>

      {showAdd && <AddGatewayForm onClose={() => setShowAdd(false)} />}

      {isLoading && <div className="card text-center text-gray-400 py-10">{t('common.loading')}</div>}

      {!isLoading && gateways.length === 0 && (
        <div className="card text-center py-14">
          <CreditCard className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400 font-medium">{t('gateways.empty')}</p>
        </div>
      )}

      {/* Active gateways */}
      {active.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{t('gateways.active')} ({active.length})</p>
          {active.map(gw => <GatewayRow key={gw.id} gw={gw} />)}
        </div>
      )}

      {/* Archived gateways */}
      {inactive.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{t('gateways.archiveSection')} ({inactive.length})</p>
          {inactive.map(gw => <GatewayRow key={gw.id} gw={gw} />)}
        </div>
      )}

      <div className="card bg-amber-50 border-amber-200 text-xs text-amber-700">
        <p className="font-semibold">{t('gateways.important')}</p>
        <p className="mt-1">{t('gateways.importantNote')}</p>
      </div>
    </div>
  )
}
