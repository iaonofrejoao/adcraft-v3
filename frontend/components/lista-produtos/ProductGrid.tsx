'use client'
import { Package } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { ProductCard } from './ProductCard'
import type { Product } from '@/hooks/useProducts'

interface ProductGridProps {
  products: Product[]
  isLoading: boolean
  onAddProduct: () => void
}

export function ProductGrid({ products, isLoading, onAddProduct }: ProductGridProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-surface-container border border-white/5 rounded-xl overflow-hidden flex flex-col">
            {/* Thumbnail skeleton */}
            <Skeleton className="h-20 w-full rounded-none bg-surface-high" />
            {/* Body skeleton */}
            <div className="p-3.5 flex flex-col gap-2.5">
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-40 bg-surface-high" />
                <Skeleton className="h-3 w-24 bg-surface-high" />
              </div>
              <Skeleton className="h-4 w-28 bg-surface-high" />
              <div className="space-y-1.5">
                <div className="flex justify-between">
                  <Skeleton className="h-2.5 w-16 bg-surface-high" />
                  <Skeleton className="h-2.5 w-8 bg-surface-high" />
                </div>
                <Skeleton className="h-[3px] w-full rounded-full bg-surface-high" />
              </div>
              <div className="flex gap-3">
                {Array.from({ length: 5 }).map((_, j) => (
                  <Skeleton key={j} className="h-3.5 w-3.5 rounded bg-surface-high" />
                ))}
              </div>
              <Skeleton className="h-2.5 w-full bg-surface-high mt-auto" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (products.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="w-14 h-14 rounded-xl bg-surface-container border border-white/5 flex items-center justify-center">
          <Package size={24} strokeWidth={1.5} className="text-on-surface-muted" />
        </div>
        <div className="text-center space-y-1">
          <p className="text-sm font-semibold text-on-surface">Nenhum produto cadastrado ainda</p>
          <p className="text-[0.6875rem] text-on-surface-variant">
            Cadastre seu primeiro produto para começar a gerar criativos
          </p>
        </div>
        <Button
          onClick={onAddProduct}
          className="bg-brand-gradient text-on-primary font-medium hover:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)] transition-shadow duration-150"
        >
          Cadastrar primeiro produto
        </Button>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {products.map((p) => (
        <ProductCard key={p.id} product={p} />
      ))}
    </div>
  )
}
