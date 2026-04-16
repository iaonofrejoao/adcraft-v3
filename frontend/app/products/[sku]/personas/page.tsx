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
  PersonasTab,
  PersonasTabSkeleton,
  PersonasTabEmpty,
} from '@/components/produto-tabs/PersonasTab'
import type { AvatarArtifactData } from '@/components/produto-tabs/PersonasTab'
import { useProductKnowledge } from '@/hooks/useProductKnowledge'

export default function PersonasPage() {
  const { sku } = useParams<{ sku: string }>()
  const [product, setProduct] = useState<Product | null>(null)
  const [loadingProduct, setLoadingProduct] = useState(true)

  const { data: knowledge, isLoading: loadingKnowledge } = useProductKnowledge(sku ?? '', 'avatar')

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

      <section className="flex-1 px-8 py-6 pb-10 max-w-4xl w-full">
        {loadingKnowledge ? (
          <PersonasTabSkeleton />
        ) : !knowledge ? (
          <PersonasTabEmpty sku={sku!} />
        ) : (
          <PersonasTab
            data={knowledge.artifact_data as unknown as AvatarArtifactData}
            createdAt={knowledge.created_at}
            sku={sku!}
          />
        )}
      </section>
    </div>
  )
}
