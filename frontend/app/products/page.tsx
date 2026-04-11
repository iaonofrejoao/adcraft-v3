'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { StatusBadge } from '@/components/ui/StatusBadge'

interface Product {
  id:                 string
  name:               string
  sku:                string
  platform:           string
  target_language:    string
  ticket_price:       string | null
  commission_percent: string | null
  created_at:         string
  niche?:             { name: string } | null
}

interface CreateProductForm {
  name:               string
  platform:           string
  product_url:        string
  affiliate_link:     string
  commission_percent: number
  ticket_price:       number
}

const EMPTY_FORM: CreateProductForm = {
  name: '', platform: 'hotmart', product_url: '', affiliate_link: '',
  commission_percent: 30, ticket_price: 97,
}

export default function ProductsPage() {
  const [products, setProducts]   = useState<Product[]>([])
  const [loading, setLoading]     = useState(true)
  const [showForm, setShowForm]   = useState(false)
  const [form, setForm]           = useState<CreateProductForm>(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetch('/api/products')
      .then((r) => r.json())
      .then((d) => setProducts(d.products ?? d ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    try {
      const res = await fetch('/api/products', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ ...form, user_id: '00000000-0000-0000-0000-000000000001', target_country: 'BR', target_language: 'pt-BR' }),
      })
      if (res.ok) {
        const p = await res.json()
        setProducts((prev) => [p, ...prev])
        setShowForm(false)
        setForm(EMPTY_FORM)
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b shrink-0"
        style={{ borderColor: 'var(--border-default)', background: 'var(--surface-page)' }}>
        <h1 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Produtos</h1>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-white"
          style={{ background: 'var(--brand-primary)' }}
        >
          + Novo produto
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-4">
        {/* Modal de criação */}
        {showForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.4)' }}>
            <div className="w-full max-w-md rounded-2xl border p-6 shadow-xl"
              style={{ background: 'var(--surface-card)', borderColor: 'var(--border-default)' }}>
              <h2 className="text-base font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
                Cadastrar produto
              </h2>
              <form onSubmit={handleCreate} className="space-y-3">
                {[
                  { key: 'name',        label: 'Nome do produto', type: 'text', required: true },
                  { key: 'product_url', label: 'URL do produto',  type: 'url',  required: true },
                  { key: 'affiliate_link', label: 'Link de afiliado', type: 'url', required: true },
                ].map(({ key, label, type, required }) => (
                  <div key={key}>
                    <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                      {label}
                    </label>
                    <input
                      type={type}
                      required={required}
                      value={(form as unknown as Record<string, unknown>)[key] as string}
                      onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                      className="w-full px-3 py-2 text-sm rounded-lg border outline-none focus:ring-1"
                      style={{ background: 'var(--surface-input)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                    />
                  </div>
                ))}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                      Plataforma
                    </label>
                    <select
                      value={form.platform}
                      onChange={(e) => setForm((f) => ({ ...f, platform: e.target.value }))}
                      className="w-full px-3 py-2 text-sm rounded-lg border outline-none"
                      style={{ background: 'var(--surface-input)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                    >
                      {['hotmart', 'clickbank', 'monetizze', 'eduzz'].map((p) => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                      Preço (R$)
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={form.ticket_price}
                      onChange={(e) => setForm((f) => ({ ...f, ticket_price: Number(e.target.value) }))}
                      className="w-full px-3 py-2 text-sm rounded-lg border outline-none"
                      style={{ background: 'var(--surface-input)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                    />
                  </div>
                </div>
                <div className="flex gap-2 pt-2">
                  <button type="submit" disabled={submitting}
                    className="flex-1 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
                    style={{ background: 'var(--brand-primary)' }}>
                    {submitting ? 'Cadastrando…' : 'Cadastrar'}
                  </button>
                  <button type="button" onClick={() => setShowForm(false)}
                    className="px-4 py-2 rounded-lg text-sm border hover:opacity-70"
                    style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}>
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <span className="text-sm animate-pulse" style={{ color: 'var(--text-muted)' }}>Carregando produtos…</span>
          </div>
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <p className="text-4xl">📦</p>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Nenhum produto cadastrado ainda.</p>
            <button onClick={() => setShowForm(true)}
              className="text-sm px-4 py-2 rounded-lg font-medium text-white"
              style={{ background: 'var(--brand-primary)' }}>
              Cadastrar primeiro produto
            </button>
          </div>
        ) : (
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function ProductCard({ product: p }: { product: Product }) {
  return (
    <Link href={`/products/${p.sku}`}>
      <div className="rounded-xl border p-4 cursor-pointer transition-all hover:shadow-sm hover:border-opacity-80"
        style={{ background: 'var(--surface-card)', borderColor: 'var(--border-default)' }}
        onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--brand-primary)')}
        onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border-default)')}>
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{p.name}</h3>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {p.niche?.name ?? 'Nicho não definido'} · {p.platform} · {p.target_language}
            </p>
          </div>
          <span className="text-xs font-mono px-2 py-0.5 rounded-full shrink-0 ml-2"
            style={{ background: 'var(--brand-subtle)', color: 'var(--brand-primary)' }}>
            {p.sku}
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--text-secondary)' }}>
          {p.ticket_price && (
            <span className="font-mono">R$ {parseFloat(p.ticket_price).toLocaleString('pt-BR')}</span>
          )}
          {p.commission_percent && (
            <span>{parseFloat(p.commission_percent).toFixed(0)}% comissão</span>
          )}
        </div>
        <div className="flex gap-2 mt-3">
          <Link href={`/products/${p.sku}/copies`}
            className="text-xs px-2 py-1 rounded-lg border hover:opacity-70"
            style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
            onClick={(e) => e.stopPropagation()}>
            Copies
          </Link>
          <Link href={`/?msg=@${p.sku}+/copy`}
            className="text-xs px-2 py-1 rounded-lg font-medium text-white hover:opacity-80"
            style={{ background: 'var(--brand-primary)' }}
            onClick={(e) => e.stopPropagation()}>
            Gerar copy
          </Link>
        </div>
      </div>
    </Link>
  )
}
