'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  ProductDetailHeader,
  ProductDetailLoading,
} from '@/components/detalhes-produto'
import type { Product } from '@/components/detalhes-produto'
import {
  MercadoTab,
  MercadoTabSkeleton,
  MercadoTabEmpty,
} from '@/components/produto-tabs/MercadoTab'
import type { MarketArtifactData } from '@/components/produto-tabs/MercadoTab'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useProductKnowledge } from '@/hooks/useProductKnowledge'

export default function MercadoPage() {
  const { sku } = useParams<{ sku: string }>()
  const [product, setProduct] = useState<Product | null>(null)
  const [loadingProduct, setLoadingProduct] = useState(true)

  const { data: knowledge, isLoading: loadingKnowledge } = useProductKnowledge(sku ?? '', 'market')

  useEffect(() => {
    if (!sku) return
    fetch(`/api/products/${sku}`)
      .then((r) => r.json())
      .then((res) => setProduct(res.product ?? res))
      .finally(() => setLoadingProduct(false))
  }, [sku])

  if (loadingProduct) return <ProductDetailLoading />

  if (!product) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 bg-surface">
        <p className="text-sm text-on-surface-variant">Produto não encontrado: {sku}</p>
        <Link href="/products" className="text-sm text-brand hover:underline">← Voltar</Link>
      </div>
    )
  }

  return (
    <ScrollArea className="h-full bg-surface">
      <div className="flex flex-col">
        <ProductDetailHeader product={product} sku={sku!} />

        <section className="w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-10 py-7 pb-12">
          {loadingKnowledge ? (
            <MercadoTabSkeleton />
          ) : !knowledge ? (
            <MercadoTabEmpty sku={sku!} />
          ) : (
            <MercadoTab
              data={knowledge.artifact_data as unknown as MarketArtifactData}
              createdAt={knowledge.created_at}
              sku={sku!}
            />
          )}
        </section>
      </div>
    </ScrollArea>
  )
}
