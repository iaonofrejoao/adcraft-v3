'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { MetricCard } from '@/components/ui/MetricCard'

interface Pipeline {
  id:              string
  goal:            string
  status:          string
  cost_so_far_usd: string
  budget_usd:      string
  created_at:      string
  updated_at:      string
  progress_pct?:   number
}

interface Product {
  id:                 string
  name:               string
  sku:                string
  platform:           string
  target_language:    string
  ticket_price:       string | null
  commission_percent: string | null
  product_url:        string
  affiliate_link:     string
  niche_id:           string | null
  created_at:         string
}

export default function ProductDetailPage() {
  const { sku } = useParams<{ sku: string }>()
  const [product,   setProduct]   = useState<Product | null>(null)
  const [pipelines, setPipelines] = useState<Pipeline[]>([])
  const [loading,   setLoading]   = useState(true)

  useEffect(() => {
    if (!sku) return
    Promise.all([
      fetch(`/api/products/${sku}`).then((r) => r.json()),
      fetch(`/api/pipelines?sku=${sku}&limit=10`).then((r) => r.json()).catch(() => ({ pipelines: [] })),
    ]).then(([prod, pipes]) => {
      setProduct(prod.product ?? prod)
      setPipelines(pipes.pipelines ?? pipes ?? [])
    }).finally(() => setLoading(false))
  }, [sku])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <span className="animate-pulse text-sm" style={{ color: 'var(--text-muted)' }}>Carregando…</span>
      </div>
    )
  }

  if (!product) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Produto não encontrado: {sku}</p>
        <Link href="/products" className="text-sm" style={{ color: 'var(--brand-primary)' }}>← Voltar</Link>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="flex items-center gap-3 px-6 py-4 border-b shrink-0"
        style={{ borderColor: 'var(--border-default)', background: 'var(--surface-page)' }}>
        <Link href="/products" className="text-sm hover:opacity-70" style={{ color: 'var(--text-muted)' }}>
          ← Produtos
        </Link>
        <span style={{ color: 'var(--text-muted)' }}>/</span>
        <h1 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
          {product.name}
        </h1>
        <span className="text-xs font-mono px-2 py-0.5 rounded-full"
          style={{ background: 'var(--brand-subtle)', color: 'var(--brand-primary)' }}>
          {product.sku}
        </span>
        <div className="ml-auto flex gap-2">
          <Link href={`/products/${sku}/copies`}
            className="text-sm px-3 py-1.5 rounded-lg border hover:opacity-70"
            style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}>
            Ver copies
          </Link>
          <Link href={`/?msg=@${sku}+/copy`}
            className="text-sm px-3 py-1.5 rounded-lg font-medium text-white"
            style={{ background: 'var(--brand-primary)' }}>
            Gerar copy
          </Link>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
        {/* Métricas */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <MetricCard label="Preço"      value={product.ticket_price ? parseFloat(product.ticket_price) : '—'} format="currency" />
          <MetricCard label="Comissão"   value={product.commission_percent ? parseFloat(product.commission_percent) : '—'} format="percent" />
          <MetricCard label="Plataforma" value={product.platform} />
          <MetricCard label="Idioma"     value={product.target_language} />
        </div>

        {/* Links */}
        <div className="rounded-xl border p-4 space-y-2"
          style={{ background: 'var(--surface-card)', borderColor: 'var(--border-default)' }}>
          <h2 className="text-sm font-medium mb-3" style={{ color: 'var(--text-primary)' }}>Links</h2>
          {[
            { label: 'URL do produto',  href: product.product_url },
            { label: 'Link de afiliado', href: product.affiliate_link },
          ].map(({ label, href }) => (
            <div key={label} className="flex items-center justify-between text-sm">
              <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
              <a href={href} target="_blank" rel="noopener noreferrer"
                className="text-xs truncate max-w-xs hover:underline"
                style={{ color: 'var(--brand-primary)' }}>
                {href}
              </a>
            </div>
          ))}
        </div>

        {/* Pipelines */}
        <div>
          <h2 className="text-sm font-medium mb-3" style={{ color: 'var(--text-primary)' }}>Pipelines</h2>
          {pipelines.length === 0 ? (
            <div className="rounded-xl border p-6 text-center"
              style={{ background: 'var(--surface-card)', borderColor: 'var(--border-default)' }}>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                Nenhum pipeline rodado ainda.{' '}
                <Link href={`/?msg=@${sku}+/copy`} style={{ color: 'var(--brand-primary)' }}>
                  Iniciar via chat
                </Link>
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {pipelines.map((p) => (
                <PipelineRow key={p.id} pipeline={p} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function PipelineRow({ pipeline: p }: { pipeline: Pipeline }) {
  const cost   = parseFloat(p.cost_so_far_usd ?? '0')
  const budget = parseFloat(p.budget_usd ?? '0')
  const pct    = p.progress_pct ?? 0

  return (
    <div className="rounded-xl border px-4 py-3 flex items-center gap-4"
      style={{ background: 'var(--surface-card)', borderColor: 'var(--border-default)' }}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{p.goal}</span>
          <StatusBadge status={p.status as 'running' | 'completed' | 'failed' | 'pending' | 'paused'} />
        </div>
        <div className="w-full h-1 rounded-full overflow-hidden"
          style={{ background: 'var(--border-default)' }}>
          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: 'var(--brand-primary)' }} />
        </div>
      </div>
      <div className="text-right shrink-0">
        <p className="text-xs font-mono" style={{ color: 'var(--text-secondary)' }}>
          ${cost.toFixed(4)} / ${budget.toFixed(2)}
        </p>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {new Date(p.created_at).toLocaleDateString('pt-BR')}
        </p>
      </div>
    </div>
  )
}
