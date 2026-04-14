'use client'
import { useProducts } from '@/hooks/useProducts'
import { CadastrarProdutoModal } from '@/components/cadastrar-produto'
import { ProductsHeader, ProductGrid } from '@/components/lista-produtos'

export default function ProductsPage() {
  const { products, isLoading, isModalOpen, openModal, closeModal, refetch } = useProducts()

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

      <div className="flex-1 overflow-y-auto px-6 py-5">
        <ProductGrid
          products={products}
          isLoading={isLoading}
          onAddProduct={openModal}
        />
      </div>

    </div>
  )
}
