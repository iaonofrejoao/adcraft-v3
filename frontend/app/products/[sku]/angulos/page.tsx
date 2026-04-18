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
  AngulosTab,
  AngulosTabSkeleton,
  AngulosTabEmpty,
} from '@/components/produto-tabs/AngulosTab'
import type { AngulosArtifactData } from '@/components/produto-tabs/AngulosTab'
import { useProductKnowledge } from '@/hooks/useProductKnowledge'

export default function AngulosPage() {
  const { sku } = useParams<{ sku: string }>()
  const [product, setProduct] = useState<Product | null>(null)
  const [loadingProduct, setLoadingProduct] = useState(true)

  const { data: knowledge, isLoading: loadingKnowledge } = useProductKnowledge(sku ?? '', 'angles')

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
    <div className="flex flex-col h-full bg-surface overflow-y-auto">
      <ProductDetailHeader product={product} sku={sku!} />

      <section className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-10 py-7 pb-12">
        {loadingKnowledge ? (
          <AngulosTabSkeleton />
        ) : !knowledge ? (
          <AngulosTabEmpty sku={sku!} />
        ) : (
          <AngulosTab
            data={knowledge.artifact_data as unknown as AngulosArtifactData}
            createdAt={knowledge.created_at}
            sku={sku!}
          />
        )}
      </section>
    </div>
  )
}
