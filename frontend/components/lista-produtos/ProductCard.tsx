'use client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Package } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Product } from '@/hooks/useProducts'

interface ProductCardProps {
  product: Product
}

export function ProductCard({ product: p }: ProductCardProps) {
  const router = useRouter()

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => router.push(`/products/${p.sku}`)}
      onKeyDown={(e) => e.key === 'Enter' && router.push(`/products/${p.sku}`)}
      className={cn(
        'bg-surface-container border border-white/5 rounded-xl p-4',
        'hover:bg-surface-high transition-colors duration-150 cursor-pointer',
        'flex flex-col gap-3'
      )}
    >
      {/* Top row: SKU + niche badge */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-mono text-[0.6875rem] tracking-[0.02em] text-on-surface-muted uppercase">
            {p.sku}
          </p>
          <h3 className="text-sm font-semibold text-on-surface truncate mt-0.5">
            {p.name}
          </h3>
        </div>
        {p.niche?.name && (
          <span className="shrink-0 bg-brand-muted text-brand font-mono text-[0.6875rem] tracking-[0.02em] px-2 py-0.5 rounded">
            {p.niche.name}
          </span>
        )}
      </div>

      {/* Metrics row: price / commission / platform */}
      <div className="flex items-center gap-3 font-mono text-[0.6875rem] text-on-surface-variant">
        {p.ticket_price && (
          <span>R$ {parseFloat(p.ticket_price).toLocaleString('pt-BR')}</span>
        )}
        {p.commission_percent && (
          <span>{parseFloat(p.commission_percent).toFixed(0)}% comissão</span>
        )}
        {p.platform && (
          <span className="ml-auto text-on-surface-muted">{p.platform}</span>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <Link
          href={`/products/${p.sku}/copies`}
          className="text-xs px-3 py-1.5 rounded border border-outline-variant/20
            text-on-surface-variant hover:bg-surface-high hover:text-on-surface
            transition-colors duration-150"
          onClick={(e) => e.stopPropagation()}
        >
          Copies
        </Link>
        <Link
          href={`/?msg=@${p.sku}+/copy`}
          className="text-xs px-3 py-1.5 rounded font-medium text-[#131314]
            bg-gradient-to-br from-[#F28705] to-[#FFB690]
            hover:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)]
            transition-shadow duration-150"
          onClick={(e) => e.stopPropagation()}
        >
          Gerar copy
        </Link>
      </div>
    </div>
  )
}
