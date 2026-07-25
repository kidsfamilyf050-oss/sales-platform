import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import { Plus, Pencil, Trash2, Check, X, Package, Tag } from 'lucide-react'

type Product = { id: string; name: string; price: number; active: boolean; createdAt: string }
type LossReason = { id: string; name: string; createdAt: string }

function fmt(n: number) {
  return '₸ ' + n.toLocaleString('ru-RU')
}

// ── Product Row ───────────────────────────────────────────────────────────────
function ProductRow({ product, onEdit, onDelete }: { product: Product; onEdit: (p: Product) => void; onDelete: (id: string) => void }) {
  return (
    <div className="flex items-center gap-3 py-3 px-4 bg-white rounded-xl border border-gray-100 shadow-sm">
      <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center shrink-0">
        <Package className="w-4 h-4 text-blue-600" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900">{product.name}</p>
        <p className="text-xs text-gray-400">Цена по умолчанию: {fmt(product.price)}</p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <button onClick={() => onEdit(product)}
          className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors">
          <Pencil className="w-4 h-4" />
        </button>
        <button onClick={() => onDelete(product.id)}
          className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

// ── Loss Reason Row ───────────────────────────────────────────────────────────
function ReasonRow({ reason, onEdit, onDelete }: { reason: LossReason; onEdit: (r: LossReason) => void; onDelete: (id: string) => void }) {
  return (
    <div className="flex items-center gap-3 py-3 px-4 bg-white rounded-xl border border-gray-100 shadow-sm">
      <div className="w-9 h-9 bg-red-50 rounded-lg flex items-center justify-center shrink-0">
        <Tag className="w-4 h-4 text-red-500" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900">{reason.name}</p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <button onClick={() => onEdit(reason)}
          className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors">
          <Pencil className="w-4 h-4" />
        </button>
        <button onClick={() => onDelete(reason.id)}
          className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

// ── Product Modal ─────────────────────────────────────────────────────────────
function ProductModal({ product, onClose }: { product?: Product; onClose: () => void }) {
  const qc = useQueryClient()
  const [name, setName] = useState(product?.name || '')
  const [price, setPrice] = useState(product?.price ? String(product.price) : '')
  const [error, setError] = useState('')

  const saveMut = useMutation({
    mutationFn: () => product
      ? api.put(`/products/${product.id}`, { name, price: Number(price) }).then(r => r.data)
      : api.post('/products', { name, price: Number(price) }).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['products'] }); onClose() },
    onError: (e: any) => setError(e.response?.data?.error || 'Ошибка'),
  })

  const handleSave = () => {
    if (!name.trim()) return setError('Введите название продукта')
    if (!price || isNaN(Number(price)) || Number(price) < 0) return setError('Введите корректную цену')
    setError('')
    saveMut.mutate()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <h3 className="font-bold text-gray-900 mb-4">{product ? 'Редактировать продукт' : 'Новый продукт'}</h3>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1.5">Название продукта *</label>
            <input
              value={name} onChange={e => setName(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Например: Базовый курс" autoFocus
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1.5">Цена по умолчанию (₸) *</label>
            <input
              type="number" value={price} onChange={e => setPrice(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="0"
            />
            <p className="text-xs text-gray-400 mt-1">Клоузер сможет изменить при оформлении продажи</p>
          </div>
          {error && <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="flex-1 btn-outline">Отмена</button>
          <button onClick={handleSave} disabled={saveMut.isPending} className="flex-1 btn-primary">
            {saveMut.isPending ? 'Сохранение...' : 'Сохранить'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Loss Reason Modal ─────────────────────────────────────────────────────────
function ReasonModal({ reason, onClose }: { reason?: LossReason; onClose: () => void }) {
  const qc = useQueryClient()
  const [name, setName] = useState(reason?.name || '')
  const [error, setError] = useState('')

  const saveMut = useMutation({
    mutationFn: () => reason
      ? api.put(`/loss-reasons/${reason.id}`, { name }).then(r => r.data)
      : api.post('/loss-reasons', { name }).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['loss-reasons'] }); onClose() },
    onError: (e: any) => setError(e.response?.data?.error || 'Ошибка'),
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <h3 className="font-bold text-gray-900 mb-4">{reason ? 'Редактировать причину' : 'Новая причина отказа'}</h3>
        <div>
          <label className="text-xs font-semibold text-gray-600 block mb-1.5">Причина *</label>
          <input
            value={name} onChange={e => setName(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Например: Дорого" autoFocus
            onKeyDown={e => e.key === 'Enter' && name.trim() && saveMut.mutate()}
          />
          <p className="text-xs text-gray-400 mt-1">Клоузер выберет причину при отказе лида</p>
          {error && <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg mt-2">{error}</p>}
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="flex-1 btn-outline">Отмена</button>
          <button onClick={() => { if (!name.trim()) return; saveMut.mutate() }}
            disabled={saveMut.isPending} className="flex-1 btn-primary">
            {saveMut.isPending ? 'Сохранение...' : 'Сохранить'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function ProductsPage() {
  const qc = useQueryClient()
  const [productModal, setProductModal] = useState<{ open: boolean; product?: Product }>({ open: false })
  const [reasonModal, setReasonModal] = useState<{ open: boolean; reason?: LossReason }>({ open: false })

  const { data: products = [], isLoading: loadingProducts } = useQuery<Product[]>({
    queryKey: ['products'],
    queryFn: () => api.get('/products').then(r => r.data),
  })

  const { data: reasons = [], isLoading: loadingReasons } = useQuery<LossReason[]>({
    queryKey: ['loss-reasons'],
    queryFn: () => api.get('/loss-reasons').then(r => r.data),
  })

  const deleteProductMut = useMutation({
    mutationFn: (id: string) => api.delete(`/products/${id}`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }),
  })

  const deleteReasonMut = useMutation({
    mutationFn: (id: string) => api.delete(`/loss-reasons/${id}`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['loss-reasons'] }),
  })

  return (
    <div className="space-y-8 max-w-2xl mx-auto px-4 md:px-8 py-4 md:py-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Продуктовая линейка</h1>
        <p className="text-sm text-gray-400 mt-0.5">Управление продуктами и причинами отказов</p>
      </div>

      {/* ── Products ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <Package className="w-4 h-4 text-blue-600" /> Продукты
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">Клоузер выбирает продукт при оформлении продажи</p>
          </div>
          <button
            onClick={() => setProductModal({ open: true })}
            className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" /> Добавить
          </button>
        </div>

        {loadingProducts ? (
          <div className="text-center py-8 text-gray-400 text-sm">Загрузка...</div>
        ) : products.length === 0 ? (
          <div className="text-center py-10 bg-white rounded-2xl border border-dashed border-gray-200">
            <div className="w-12 h-12 bg-blue-50 rounded-xl mx-auto flex items-center justify-center mb-3">
              <Package className="w-6 h-6 text-blue-400" />
            </div>
            <p className="text-sm font-medium text-gray-500">Нет продуктов</p>
            <p className="text-xs text-gray-400 mt-1">Добавьте продукты, чтобы клоузеры выбирали их при продаже</p>
            <button
              onClick={() => setProductModal({ open: true })}
              className="mt-4 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors"
            >
              + Добавить первый продукт
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {products.map(p => (
              <ProductRow
                key={p.id} product={p}
                onEdit={prod => setProductModal({ open: true, product: prod })}
                onDelete={id => { if (confirm('Удалить продукт?')) deleteProductMut.mutate(id) }}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Loss Reasons ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <Tag className="w-4 h-4 text-red-500" /> Причины отказов
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">Клоузер выбирает причину при пометке лида как «Отказ»</p>
          </div>
          <button
            onClick={() => setReasonModal({ open: true })}
            className="flex items-center gap-1.5 px-3 py-2 bg-red-500 text-white text-sm font-medium rounded-xl hover:bg-red-600 transition-colors"
          >
            <Plus className="w-4 h-4" /> Добавить
          </button>
        </div>

        {loadingReasons ? (
          <div className="text-center py-8 text-gray-400 text-sm">Загрузка...</div>
        ) : reasons.length === 0 ? (
          <div className="text-center py-10 bg-white rounded-2xl border border-dashed border-gray-200">
            <div className="w-12 h-12 bg-red-50 rounded-xl mx-auto flex items-center justify-center mb-3">
              <Tag className="w-6 h-6 text-red-400" />
            </div>
            <p className="text-sm font-medium text-gray-500">Нет причин отказов</p>
            <p className="text-xs text-gray-400 mt-1">Добавьте причины — например: «Дорого», «Не интересно», «Уже купил»</p>
            <button
              onClick={() => setReasonModal({ open: true })}
              className="mt-4 px-4 py-2 bg-red-500 text-white text-sm font-medium rounded-xl hover:bg-red-600 transition-colors"
            >
              + Добавить причину
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {reasons.map(r => (
              <ReasonRow
                key={r.id} reason={r}
                onEdit={reason => setReasonModal({ open: true, reason })}
                onDelete={id => { if (confirm('Удалить причину?')) deleteReasonMut.mutate(id) }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      {productModal.open && (
        <ProductModal
          product={productModal.product}
          onClose={() => setProductModal({ open: false })}
        />
      )}
      {reasonModal.open && (
        <ReasonModal
          reason={reasonModal.reason}
          onClose={() => setReasonModal({ open: false })}
        />
      )}
    </div>
  )
}
