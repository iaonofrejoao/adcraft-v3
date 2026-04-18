'use client'
import { useState, useMemo, useCallback } from 'react'
import { Plus, Sparkles, Clapperboard, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { CreativeCard } from './CreativeCard'
import { CreativeFilters, type FilterState } from './CreativeFilters'
import type { Asset, UseCreativesReturn } from '@/hooks/useCreatives'

// ── Helpers ───────────────────────────────────────────────────────────────────

function applyFilters(assets: Asset[], f: FilterState): Asset[] {
  let result = [...assets]

  if (f.search.trim()) {
    const q = f.search.toLowerCase()
    result = result.filter(
      (a) =>
        a.tag.toLowerCase().includes(q) ||
        a.product?.name.toLowerCase().includes(q) ||
        a.product?.sku.toLowerCase().includes(q),
    )
  }

  if (f.product !== 'all') {
    result = result.filter((a) => a.product?.sku === f.product)
  }

  if (f.type !== 'all') {
    result = result.filter((a) => a.asset_type === f.type)
  }

  if (f.sort === 'oldest') {
    result.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
  } else {
    result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  }

  return result
}

// ── Componente principal ──────────────────────────────────────────────────────

export interface GaleriaCreativosProps extends UseCreativesReturn {
  /** Filtros controlados externamente (para URL persistence). Se omitido, usa estado interno. */
  externalFilters?:   FilterState
  onFiltersChange?:   (next: FilterState) => void
}

const DEFAULT_FILTERS: FilterState = { search: '', product: 'all', type: 'all', sort: 'recent' }

export function GaleriaCreativos({
  assets,
  isLoading,
  externalFilters,
  onFiltersChange,
}: GaleriaCreativosProps) {
  const [_filters, _setFilters] = useState<FilterState>(DEFAULT_FILTERS)

  const filters    = externalFilters ?? _filters
  const setFilters = useCallback(
    (next: FilterState) => {
      _setFilters(next)
      onFiltersChange?.(next)
    },
    [onFiltersChange],
  )

  const products = useMemo(() => {
    const seen = new Set<string>()
    const list: Array<{ sku: string; name: string }> = []
    for (const a of assets) {
      if (a.product && !seen.has(a.product.sku)) {
        seen.add(a.product.sku)
        list.push(a.product)
      }
    }
    return list
  }, [assets])

  const filtered = useMemo(() => applyFilters(assets, filters), [assets, filters])

  return (
    <div className="flex flex-col h-full overflow-hidden bg-surface">
      {/* ── Page header ──────────────────────────────────────────── */}
      <div className="flex items-end justify-between px-6 pt-6 pb-4 shrink-0">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-on-surface leading-none">
            Criativos
          </h2>
          <p className="text-[14px] text-on-surface-muted mt-1.5">
            {isLoading
              ? 'Carregando criativos…'
              : `${assets.length} criativos gerados${products.length > 0 ? ` em ${products.length} produtos` : ''}`}
          </p>
        </div>
        <Button className="bg-gradient-to-br from-brand to-brand-end text-surface font-bold text-[13px] gap-2 hover:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)] transition-shadow duration-150 border-0">
          <Plus size={16} strokeWidth={1.5} />
          Gerar Novo Vídeo
        </Button>
      </div>

      {/* ── Filters ──────────────────────────────────────────────── */}
      <div className="px-6 pb-4 shrink-0">
        <CreativeFilters
          state={filters}
          products={products}
          onChange={setFilters}
        />
      </div>

      {/* ── Grid ─────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="flex-1 px-6 overflow-hidden">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex flex-col gap-3">
                <Skeleton className="w-full aspect-[9/16] rounded-xl bg-surface-highest" />
                <Skeleton className="h-4 w-3/4 bg-surface-highest" />
                <Skeleton className="h-3 w-1/2 bg-surface-highest" />
              </div>
            ))}
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-6">
          <div className="w-16 h-16 rounded-2xl bg-surface-high flex items-center justify-center">
            <Clapperboard size={28} strokeWidth={1.5} className="text-on-surface-muted" />
          </div>
          <div>
            <p className="text-[15px] font-semibold text-on-surface-variant">
              {filters.search || filters.product !== 'all' || filters.type !== 'all'
                ? 'Nenhum criativo para este filtro'
                : 'Nenhum criativo gerado ainda'}
            </p>
            <p className="text-[13px] text-on-surface-muted mt-1">
              Gere vídeos aprovando combinações de copy e rodando o pipeline de vídeo.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex-1 min-h-0 px-6">
          <ScrollArea className="h-full">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 pb-24">
              {filtered.map((asset) => (
                <CreativeCard key={asset.id} asset={asset} />
              ))}
            </div>
          </ScrollArea>
        </div>
      )}

      {/* ── AI Command Bar ───────────────────────────────────────── */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[520px] bg-surface-highest backdrop-blur-[12px] border border-primary/20 rounded-full shadow-[0_12px_40px_-10px_rgba(0,0,0,0.5)] px-2 py-2 flex items-center gap-3 z-50">
        <div className="w-10 h-10 rounded-full bg-brand flex items-center justify-center shrink-0">
          <Sparkles size={18} strokeWidth={1.5} className="text-surface" />
        </div>
        <Input
          placeholder="Pergunte à IA ou peça para criar um novo roteiro..."
          className="bg-transparent border-none shadow-none ring-0 focus-visible:ring-0 text-[14px] text-on-surface placeholder:text-on-surface-muted flex-1 h-auto p-0 focus-visible:ring-offset-0"
        />
        <div className="flex items-center gap-1 pr-2 shrink-0">
          <kbd className="px-2 py-1 bg-surface-high rounded text-[10px] text-on-surface-muted font-mono">⌘</kbd>
          <kbd className="px-2 py-1 bg-surface-high rounded text-[10px] text-on-surface-muted font-mono">K</kbd>
        </div>
      </div>
    </div>
  )
}
