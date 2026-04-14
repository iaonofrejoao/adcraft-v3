'use client'
import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ChevronRight, Pencil } from 'lucide-react'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Skeleton }    from '@/components/ui/skeleton'
import { AprovacaoBoard } from '@/components/aprovacao-componentes'

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

  /* ── Loading ── */
  if (loading) {
    return (
      <div className="flex flex-col h-full bg-surface">
        <div className="bg-surface-low px-8 pt-6 pb-4 shrink-0 space-y-2">
          <Skeleton className="h-3 w-48 bg-surface-highest" />
          <Skeleton className="h-7 w-64 bg-surface-highest" />
          <Skeleton className="h-3 w-80 bg-surface-highest" />
        </div>
        <div className="flex-1 px-8 py-6">
          <Skeleton className="h-16 w-full rounded-xl bg-surface-highest mb-6" />
          <div className="grid grid-cols-3 gap-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-48 rounded-xl bg-surface-highest" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  /* ── Empty ── */
  if (!activePipeline || pipelines.length === 0) {
    return (
      <div className="flex flex-col h-full bg-surface">
        <CopiesHeader product={product} sku={sku} pipelines={[]} activePipeline={null} currentPipeline={undefined} onPipelineChange={() => {}} />
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
            className="text-sm px-4 py-2 rounded font-medium text-[#131314]
              bg-gradient-to-br from-[#F28705] to-[#FFB690]
              hover:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)]
              transition-shadow duration-150"
          >
            Gerar copy com Jarvis
          </Link>
        </div>
      </div>
    )
  }

  /* ── Main ── */
  return (
    <div className="flex flex-col h-full bg-surface overflow-y-auto">
      <CopiesHeader
        product={product}
        sku={sku}
        pipelines={pipelines}
        activePipeline={activePipeline}
        currentPipeline={currentPipeline}
        onPipelineChange={setActivePipeline}
      />

      <div className="flex-1 px-8 py-6 pb-10">
        <AprovacaoBoard
          sku={sku}
          pipelineId={activePipeline}
          productId={product?.id ?? ''}
        />
      </div>
    </div>
  )
}

/* ── Page header ─────────────────────────────────────────────────── */
interface CopiesHeaderProps {
  product:          Product | null
  sku:              string
  pipelines:        Pipeline[]
  activePipeline:   string | null
  currentPipeline:  Pipeline | undefined
  onPipelineChange: (id: string) => void
}

function CopiesHeader({
  product, sku, pipelines, activePipeline, currentPipeline, onPipelineChange,
}: CopiesHeaderProps) {
  return (
    <header className="bg-surface-low shrink-0 px-8 pt-6 pb-5">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-[0.6875rem] font-medium mb-3">
        <Link
          href="/products"
          className="text-on-surface-variant/60 hover:text-on-surface-variant transition-colors duration-150"
        >
          Produtos
        </Link>
        <ChevronRight size={10} strokeWidth={1.5} className="text-on-surface-muted/40" />
        <Link
          href={`/products/${sku}`}
          className="bg-brand-muted text-brand font-mono px-1.5 py-0.5 rounded hover:bg-brand/20 transition-colors duration-150"
        >
          {sku}
        </Link>
        <ChevronRight size={10} strokeWidth={1.5} className="text-on-surface-muted/40" />
        <span className="text-on-surface-variant">Copies</span>
      </nav>

      {/* Title row */}
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-[1.75rem] font-bold tracking-tight text-on-surface">
            Aprovação de componentes
          </h1>
          <p className="text-sm text-on-surface-variant mt-1 max-w-xl">
            Aprove os componentes que vão para combinação. Você precisa de pelo menos
            1 hook, 1 body e 1 CTA aprovados.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {/* Pipeline selector */}
          {pipelines.length > 1 && (
            <select
              value={activePipeline ?? ''}
              onChange={(e) => onPipelineChange(e.target.value)}
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

          <Link
            href={`/?msg=@${sku}+/copy`}
            className="text-sm px-3 py-1.5 rounded font-medium text-[#131314]
              bg-gradient-to-br from-[#F28705] to-[#FFB690]
              hover:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)]
              transition-shadow duration-150"
          >
            Nova copy via Jarvis
          </Link>
        </div>
      </div>
    </header>
  )
}
