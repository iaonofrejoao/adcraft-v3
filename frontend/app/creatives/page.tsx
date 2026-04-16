'use client'
import { Suspense, useCallback } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { useCreatives } from '@/hooks/useCreatives'
import { GaleriaCreativos } from '@/components/galeria-criativos'
import type { FilterState } from '@/components/galeria-criativos/CreativeFilters'

// ── URL ↔ filter helpers ──────────────────────────────────────────────────────

const DEFAULTS: FilterState = { search: '', product: 'all', type: 'all', sort: 'recent' }

function filtersFromParams(p: URLSearchParams): FilterState {
  return {
    search:  p.get('search')  ?? DEFAULTS.search,
    product: p.get('product') ?? DEFAULTS.product,
    type:    p.get('type')    ?? DEFAULTS.type,
    sort:    p.get('sort')    ?? DEFAULTS.sort,
  }
}

function filtersToParams(f: FilterState, base: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(base.toString())
  if (f.search && f.search !== DEFAULTS.search) next.set('search', f.search)
  else next.delete('search')
  if (f.product && f.product !== DEFAULTS.product) next.set('product', f.product)
  else next.delete('product')
  if (f.type && f.type !== DEFAULTS.type) next.set('type', f.type)
  else next.delete('type')
  if (f.sort && f.sort !== DEFAULTS.sort) next.set('sort', f.sort)
  else next.delete('sort')
  return next
}

// ── Conteúdo com acesso a URL ─────────────────────────────────────────────────

function CreativesContent() {
  const params   = useSearchParams()
  const router   = useRouter()
  const pathname = usePathname()
  const { assets, isLoading } = useCreatives()

  const filters = filtersFromParams(params)

  const handleFiltersChange = useCallback((next: FilterState) => {
    const nextParams = filtersToParams(next, params)
    router.replace(`${pathname}?${nextParams.toString()}`, { scroll: false })
  }, [params, router, pathname])

  return (
    <GaleriaCreativos
      assets={assets}
      isLoading={isLoading}
      externalFilters={filters}
      onFiltersChange={handleFiltersChange}
    />
  )
}

// ── Export ────────────────────────────────────────────────────────────────────

export default function CreativesPage() {
  return (
    <Suspense>
      <CreativesContent />
    </Suspense>
  )
}
