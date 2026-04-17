'use client'
import { useProducts } from '@/hooks/useProducts'
import { CadastrarProdutoModal } from '@/components/cadastrar-produto'
import { ProductsHeader, ProductGrid } from '@/components/lista-produtos'
import { Switch } from '@/components/ui/switch'

export default function ProductsPage() {
  const {
    products, isLoading, isModalOpen,
    showInactive, setShowInactive,
    openModal, closeModal, refetch,
  } = useProducts()

  return (
    <div className="flex flex-col h-full bg-surface">

      <ProductsHeader
        count={products.length}
        isLoading={isLoading}
        onAddProduct={openModal}
      />

      <CadastrarProdutoModal
        open={isModalOpen}
        onOpenChange={(open) => (open ? openModal() : closeModal())}
        onSubmit={() => refetch()}
      />

      {/* Filtro de inativos */}
      <div className="flex items-center gap-2 px-6 pt-3 pb-1">
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

      <div className="flex-1 overflow-y-auto px-6 py-4">
        <ProductGrid
          products={products}
          isLoading={isLoading}
          onAddProduct={openModal}
        />
      </div>

    </div>
  )
}
