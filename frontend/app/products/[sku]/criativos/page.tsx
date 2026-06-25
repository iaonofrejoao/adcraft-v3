'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  ProductDetailHeader,
  ProductDetailLoading,
} from '@/components/detalhes-produto'
import type { Product } from '@/components/detalhes-produto'
import { CriativosTab } from '@/components/produto-tabs/CriativosTab'

export default function CriativosPage() {
  const { sku }   = useParams<{ sku: string }>()
  const [product, setProduct]  = useState<Product | null>(null)
  const [loading, setLoading]  = useState(true)

  useEffect(() => {
    if (!sku) return
    fetch(`/api/products/${sku}`)
      .then(r => r.json())
      .then(d => setProduct(d.product ?? d))
      .finally(() => setLoading(false))
  }, [sku])

  if (loading) return <ProductDetailLoading />

  if (!product) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 bg-surface">
        <p className="text-sm text-on-surface-variant">Produto não encontrado: {sku}</p>
        <Link href="/products" className="text-sm text-brand hover:underline">← Voltar</Link>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-surface">
      <ProductDetailHeader product={product} sku={sku!} />
      <div className="flex-1 overflow-hidden min-h-0">
        <CriativosTab sku={sku!} productId={product.id} />
      </div>
    </div>
  )
}
