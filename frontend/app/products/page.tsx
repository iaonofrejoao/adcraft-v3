'use client'
import { useMemo, useState } from 'react'
import { useProducts } from '@/hooks/useProducts'
import { CadastrarProdutoModal } from '@/components/cadastrar-produto'
import { ProductsHeader, ProductGrid } from '@/components/lista-produtos'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Switch } from '@/components/ui/switch'
import { FilterBar, type FilterOption } from '@/components/ui/FilterBar'

const PLATFORM_PILLS: FilterOption[] = [
  { value: 'all',        label: 'Todos'      },
  { value: 'hotmart',    label: 'Hotmart'    },
  { value: 'clickbank',  label: 'ClickBank'  },
  { value: 'monetizze',  label: 'Monetizze'  },
  { value: 'eduzz',      label: 'Eduzz'      },
]

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
      <FilterBar
        className="px-6 pt-3 pb-2"
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Buscar produto…"
        pills={PLATFORM_PILLS}
        activePill={platform}
        onPillChange={setPlatform}
      >
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
      </FilterBar>

      <ScrollArea className="flex-1">
        <div className="px-6 py-4">
          <ProductGrid
            products={filtered}
            isLoading={isLoading}
            onAddProduct={openModal}
          />
        </div>
      </ScrollArea>

    </div>
  )
}
