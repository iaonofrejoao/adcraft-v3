'use client'
import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Pencil } from 'lucide-react'
import {
  ProductDetailHeader,
  ProductDetailLoading,
} from '@/components/detalhes-produto'
import type { Product } from '@/components/detalhes-produto'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { AprovacaoBoard } from '@/components/aprovacao-componentes'

interface Pipeline {
  id:              string
  goal:            string
  status:          string
  cost_so_far_usd: string
  created_at:      string
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

  /* ── Loading ── */
  if (loading) return <ProductDetailLoading />

  /* ── Not found ── */
  if (!product) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 bg-surface">
        <p className="text-sm text-on-surface-variant">Produto não encontrado: {sku}</p>
        <Link href="/products" className="text-sm text-brand hover:underline">← Voltar</Link>
      </div>
    )
  }

  /* ── Main ── */
  return (
    <div className="flex flex-col h-full bg-surface overflow-y-auto">
      <ProductDetailHeader product={product} sku={sku!} />

      {/* Copies toolbar */}
      <div className="shrink-0 px-8 py-3 bg-surface flex items-center justify-between gap-3 border-b border-outline-variant/10">
        <div className="flex items-center gap-3">
          {pipelines.length > 1 && (
            <select
              value={activePipeline ?? ''}
              onChange={(e) => setActivePipeline(e.target.value)}
              className="h-9 px-3 text-xs rounded-lg bg-surface-container border border-white/5
                text-on-surface outline-none
                focus:border-brand focus:ring-2 focus:ring-brand/20
                transition-all duration-150"
            >
              {pipelines.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.goal} · {new Date(p.created_at).toLocaleDateString('pt-BR')}
                </option>
              ))}
            </select>
          )}
          {currentPipeline && (
            <StatusBadge
              status={currentPipeline.status as 'running' | 'done' | 'failed' | 'pending' | 'paused'}
            />
          )}
        </div>

        <Link
          href={`/?msg=@${sku}+/copy`}
          className="text-sm px-3 py-1.5 rounded font-medium text-primary-foreground
            bg-gradient-to-br from-brand to-brand-end
            hover:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)]
            transition-shadow duration-150"
        >
          Nova copy via Jarvis
        </Link>
      </div>

      {/* Content */}
      {!activePipeline || pipelines.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 gap-4 py-24">
          <div className="w-14 h-14 rounded-xl bg-surface-container border border-white/5 flex items-center justify-center">
            <Pencil size={22} strokeWidth={1.5} className="text-on-surface-muted" />
          </div>
          <div className="text-center space-y-1">
            <p className="text-sm font-semibold text-on-surface">Nenhum pipeline de copy encontrado</p>
            <p className="text-[0.6875rem] text-on-surface-variant">
              Inicie uma geração de copy via Jarvis para este produto
            </p>
          </div>
          <Link
            href={`/?msg=@${sku}+/copy`}
            className="text-sm px-4 py-2 rounded font-medium text-primary-foreground
              bg-gradient-to-br from-brand to-brand-end
              hover:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)]
              transition-shadow duration-150"
          >
            Gerar copy com Jarvis
          </Link>
        </div>
      ) : (
        <div className="flex-1 px-8 py-6 pb-10">
          <AprovacaoBoard
            sku={sku!}
            pipelineId={activePipeline}
            productId={product.id}
          />
        </div>
      )}
    </div>
  )
}
