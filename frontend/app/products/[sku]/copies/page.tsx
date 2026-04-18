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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

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
      fetch(`/api/pipelines?sku=${sku}&goal=copy_only,creative_full,criativo,full&status=running,completed,plan_preview,pending,failed&limit=20`)
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
      <div className="shrink-0 px-8 py-3 bg-surface-low flex items-center gap-3">
        {pipelines.length > 1 && (
          <Select value={activePipeline ?? ''} onValueChange={setActivePipeline}>
            <SelectTrigger className="h-9 w-64 text-xs bg-surface-container border-white/5 text-on-surface">
              <SelectValue placeholder="Selecionar pipeline" />
            </SelectTrigger>
            <SelectContent className="bg-surface-highest border-white/10 text-on-surface">
              {pipelines.map((p) => (
                <SelectItem key={p.id} value={p.id} className="text-xs">
                  {p.goal} · {new Date(p.created_at).toLocaleDateString('pt-BR')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {currentPipeline && (
          <StatusBadge
            status={currentPipeline.status as 'running' | 'done' | 'failed' | 'pending' | 'paused'}
          />
        )}
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
              Rode um pipeline criativo via Claude Code para este produto
            </p>
          </div>
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
