'use client'
import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { CopyComponentBoard } from '@/components/products/CopyComponentBoard'
import { StatusBadge } from '@/components/ui/StatusBadge'

interface Pipeline {
  id:              string
  goal:            string
  status:          string
  cost_so_far_usd: string
  created_at:      string
}

interface Product {
  id:   string
  name: string
  sku:  string
}

export default function CopiesPage() {
  const { sku }       = useParams<{ sku: string }>()
  const searchParams  = useSearchParams()
  const pipelineParam = searchParams.get('pipeline')

  const [product,        setProduct]        = useState<Product | null>(null)
  const [pipelines,      setPipelines]      = useState<Pipeline[]>([])
  const [activePipeline, setActivePipeline] = useState<string | null>(pipelineParam)
  const [loading,        setLoading]        = useState(true)

  useEffect(() => {
    if (!sku) return
    Promise.all([
      fetch(`/api/products/${sku}`).then((r) => r.json()),
      fetch(`/api/pipelines?sku=${sku}&goal=copy_only,creative_full&status=running,completed,plan_preview,pending&limit=20`)
        .then((r) => r.json()).catch(() => ({ pipelines: [] })),
    ]).then(([prod, pipes]) => {
      const p = prod.product ?? prod
      setProduct(p)
      const pipelineList: Pipeline[] = pipes.pipelines ?? pipes ?? []
      setPipelines(pipelineList)
      if (!activePipeline && pipelineList.length > 0) {
        setActivePipeline(pipelineList[0].id)
      }
    }).finally(() => setLoading(false))
  }, [sku])

  const currentPipeline = pipelines.find((p) => p.id === activePipeline)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <span className="animate-pulse text-sm" style={{ color: 'var(--text-muted)' }}>Carregando…</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="flex items-center gap-3 px-6 py-3.5 border-b shrink-0 flex-wrap"
        style={{ borderColor: 'var(--border-default)', background: 'var(--surface-page)' }}>
        <Link href={`/products/${sku}`} className="text-sm hover:opacity-70" style={{ color: 'var(--text-muted)' }}>
          ← {product?.name ?? sku}
        </Link>
        <span style={{ color: 'var(--text-muted)' }}>/</span>
        <h1 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Copies</h1>

        {/* Seletor de pipeline */}
        {pipelines.length > 1 && (
          <select
            value={activePipeline ?? ''}
            onChange={(e) => setActivePipeline(e.target.value)}
            className="ml-2 px-2 py-1 text-xs rounded-lg border outline-none"
            style={{ background: 'var(--surface-input)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}>
            {pipelines.map((p) => (
              <option key={p.id} value={p.id}>
                {p.goal} · {new Date(p.created_at).toLocaleDateString('pt-BR')} · {p.status}
              </option>
            ))}
          </select>
        )}

        {currentPipeline && (
          <StatusBadge
            status={currentPipeline.status as 'running' | 'completed' | 'failed' | 'pending' | 'paused'}
          />
        )}

        <div className="ml-auto">
          <Link href={`/?msg=@${sku}+/copy`}
            className="text-xs px-3 py-1.5 rounded-lg font-medium text-white"
            style={{ background: 'var(--brand-primary)' }}>
            Nova copy via Jarvis
          </Link>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-4">
        {!activePipeline || pipelines.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <p className="text-4xl">✏️</p>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Nenhum pipeline de copy encontrado para este produto.
            </p>
            <Link href={`/?msg=@${sku}+/copy`}
              className="text-sm px-4 py-2 rounded-lg font-medium text-white"
              style={{ background: 'var(--brand-primary)' }}>
              Gerar copy com Jarvis
            </Link>
          </div>
        ) : (
          <CopyComponentBoard
            sku={sku}
            pipelineId={activePipeline}
            productId={product?.id ?? ''}
          />
        )}
      </div>
    </div>
  )
}
