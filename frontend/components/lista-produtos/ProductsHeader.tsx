'use client'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ProductsHeaderProps {
  count: number
  isLoading: boolean
  onAddProduct: () => void
}

export function ProductsHeader({ count, isLoading, onAddProduct }: ProductsHeaderProps) {
  return (
    <header className="flex items-center justify-between px-6 py-4 bg-surface-low shrink-0">
      <div>
        <h1 className="text-[1.5rem] font-semibold tracking-[-0.01em] text-on-surface">
          Produtos
        </h1>
        <p className="text-sm text-on-surface-variant">
          {isLoading
            ? 'Carregando produtos…'
            : count === 0
            ? 'Gerencie seus produtos e gere criativos'
            : `${count} produto${count !== 1 ? 's' : ''} cadastrado${count !== 1 ? 's' : ''}`}
        </p>
      </div>
      <Button
        onClick={onAddProduct}
        className="flex items-center gap-1.5 bg-brand-gradient text-on-primary font-medium hover:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)] transition-shadow duration-150"
      >
        <Plus size={14} strokeWidth={1.5} />
        Novo produto
      </Button>
    </header>
  )
}
