'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronRight, Tag } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Product } from './types'

interface ProductDetailHeaderProps {
  product: Product
  sku: string
}

const TABS = [
  { label: 'Visão geral', href: (sku: string) => `/products/${sku}` },
  { label: 'Copies',      href: (sku: string) => `/products/${sku}/copies` },
] as const

function formatRelativeDate(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const days  = Math.floor(diff / 86_400_000)
  const hours = Math.floor(diff / 3_600_000)
  if (days > 0)  return `há ${days} dia${days !== 1 ? 's' : ''}`
  if (hours > 0) return `há ${hours}h`
  return 'agora há pouco'
}

export function ProductDetailHeader({ product, sku }: ProductDetailHeaderProps) {
  const pathname = usePathname()

  return (
    <header className="bg-surface-low shrink-0">
      {/* Top bar: breadcrumb + actions */}
      <div className="flex items-start justify-between px-8 pt-6 pb-3">
        <div className="flex flex-col gap-1">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-1.5 text-[0.6875rem] font-medium tracking-wide">
            <Link
              href="/products"
              className="text-on-surface-variant/60 hover:text-on-surface-variant transition-colors duration-150"
            >
              Produtos
            </Link>
            <ChevronRight size={10} strokeWidth={1.5} className="text-on-surface-muted/40" />
            <span className="bg-brand-muted text-brand font-mono px-1.5 py-0.5 rounded">
              {sku}
            </span>
          </nav>

          {/* Title row */}
          <div className="flex items-center gap-3 mt-1">
            <span className="font-mono text-brand text-base font-medium">{sku}</span>
            <h1 className="text-[1.75rem] font-semibold tracking-[-0.02em] text-on-surface">
              {product.name}
            </h1>
          </div>

          {/* Metadata row */}
          <div className="flex items-center gap-3 mt-1 text-[0.8125rem] text-on-surface-variant/70">
            {product.niche_id && (
              <>
                <span className="flex items-center gap-1">
                  <Tag size={12} strokeWidth={1.5} />
                  Nicho: {product.niche_id}
                </span>
                <span className="w-1 h-1 bg-white/20 rounded-full" />
              </>
            )}
            <span className="font-mono">{product.platform}</span>
            <span className="w-1 h-1 bg-white/20 rounded-full" />
            <span>Cadastrado {formatRelativeDate(product.created_at)}</span>
            {product.ticket_price && (
              <>
                <span className="w-1 h-1 bg-white/20 rounded-full" />
                <span className="font-mono">
                  R$ {parseFloat(product.ticket_price).toLocaleString('pt-BR')}
                </span>
              </>
            )}
            {product.commission_percent && (
              <>
                <span className="w-1 h-1 bg-white/20 rounded-full" />
                <span className="font-mono">
                  {parseFloat(product.commission_percent).toFixed(0)}% comissão
                </span>
              </>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-3 shrink-0 pt-1">
          <Link
            href={`/products/${sku}/copies`}
            className="px-4 py-2 rounded-lg border border-outline-variant/20
              text-on-surface text-sm font-medium
              hover:bg-surface-high transition-colors duration-150"
          >
            Pedir nova copy
          </Link>
          <Link
            href={`/?msg=@${sku}+/copy`}
            className="px-4 py-2 rounded-lg text-sm font-bold text-[#131314]
              bg-gradient-to-br from-[#F28705] to-[#FFB690]
              shadow-[0_12px_40px_-10px_rgba(249,115,22,0.3)]
              hover:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1),0_12px_40px_-10px_rgba(249,115,22,0.3)]
              hover:scale-[1.02] active:scale-[0.98] transition-all duration-150"
          >
            Gerar copy
          </Link>
        </div>
      </div>

      {/* Tab navigation */}
      <nav className="flex gap-6 px-8">
        {TABS.map(({ label, href }) => {
          const target  = href(sku)
          const isActive = pathname === target
          return (
            <Link
              key={label}
              href={target}
              className={cn(
                'pb-3 pt-1 text-sm font-medium border-b-2 transition-colors duration-150',
                isActive
                  ? 'text-brand border-brand'
                  : 'text-on-surface-variant/60 border-transparent hover:text-on-surface-variant'
              )}
            >
              {label}
            </Link>
          )
        })}
      </nav>
    </header>
  )
}
