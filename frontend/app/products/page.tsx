'use client'
import { useMemo, useState } from 'react'
import { Search, X } from 'lucide-react'
import { useProducts } from '@/hooks/useProducts'
import { CadastrarProdutoModal } from '@/components/cadastrar-produto'
import { ProductsHeader, ProductGrid } from '@/components/lista-produtos'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'

const PLATFORMS = ['hotmart', 'clickbank', 'monetizze', 'eduzz'] as const

export default function ProductsPage() {
  const {
    products, isLoading, isModalOpen,
    showInactive, setShowInactive,
    openModal, closeModal, refetch,
  } = useProducts()

  const [search,   setSearch]   = useState('')
  const [platform, setPlatform] = useState<string>('all')

  const filtered = useMemo(() => {
    let list = products
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(
        (p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)
      )
    }
    if (platform !== 'all') {
      list = list.filter((p) => p.platform?.toLowerCase() === platform)
    }
    return list
  }, [products, search, platform])

  return (
    <div className="flex flex-col h-full bg-surface">

      <ProductsHeader
        count={filtered.length}
        isLoading={isLoading}
        onAddProduct={openModal}
      />

      <CadastrarProdutoModal
        open={isModalOpen}
        onOpenChange={(open) => (open ? openModal() : closeModal())}
        onSubmit={() => refetch()}
      />

      {/* Filter bar */}
      <div className="flex items-center gap-3 px-6 pt-3 pb-2 flex-wrap">
        {/* Busca */}
        <div className="relative">
          <Search size={13} strokeWidth={1.5} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-on-surface-muted pointer-events-none" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar produto…"
            className={cn(
              'pl-8 pr-7 py-1.5 text-[0.8125rem] rounded-lg bg-surface-container border border-white/8',
              'text-on-surface placeholder:text-on-surface-muted outline-none',
              'focus:border-brand/40 transition-colors w-52'
            )}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-on-surface-muted hover:text-on-surface transition-colors"
            >
              <X size={12} strokeWidth={1.5} />
            </button>
          )}
        </div>

        {/* Platform pills */}
        <div className="flex items-center gap-1.5">
          {(['all', ...PLATFORMS] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPlatform(p)}
              className={cn(
                'px-3 py-1 rounded-full text-[0.75rem] font-medium capitalize transition-colors',
                platform === p
                  ? 'bg-brand/20 text-brand ring-1 ring-brand/30'
                  : 'bg-surface-container text-on-surface-muted hover:text-on-surface hover:bg-surface-container-high'
              )}
            >
              {p === 'all' ? 'Todos' : p}
            </button>
          ))}
        </div>

        {/* Mostrar inativos */}
        <div className="flex items-center gap-2 ml-auto">
          <Switch
            checked={showInactive}
            onCheckedChange={setShowInactive}
            id="show-inactive"
          />
          <label
            htmlFor="show-inactive"
            className="text-[0.75rem] text-on-surface-muted cursor-pointer select-none"
          >
            Mostrar inativos
          </label>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4">
        <ProductGrid
          products={filtered}
          isLoading={isLoading}
          onAddProduct={openModal}
        />
      </div>

    </div>
  )
}
