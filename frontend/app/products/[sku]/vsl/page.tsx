'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Video } from 'lucide-react'
import {
  ProductDetailHeader,
  ProductDetailLoading,
} from '@/components/detalhes-produto'
import type { Product } from '@/components/detalhes-produto'
import { VSLUpload } from '@/components/products/VSLUpload'

interface ProductWithVSL extends Product {
  vsl_url?: string | null
  vsl_source?: string | null
  vsl_duration_seconds?: number | null
  vsl_file_size_bytes?: number | null
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export default function VSLPage() {
  const { sku } = useParams<{ sku: string }>()
  const [product, setProduct] = useState<ProductWithVSL | null>(null)
  const [loading, setLoading]  = useState(true)

  const fetchProduct = () => {
    if (!sku) return
    fetch(`/api/products/${sku}`)
      .then((r) => r.json())
      .then((res) => setProduct(res.product ?? res))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchProduct() }, [sku]) // eslint-disable-line react-hooks/exhaustive-deps

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
    <div className="flex flex-col h-full bg-surface overflow-y-auto">
      <ProductDetailHeader product={product} sku={sku!} />

      <section className="flex-1 px-8 py-8 pb-12 max-w-2xl w-full">

        {/* Header da seção */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-9 h-9 rounded-xl bg-brand/10 flex items-center justify-center shrink-0">
            <Video size={18} strokeWidth={1.5} className="text-brand" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-on-surface">VSL — Vídeo de Vendas</h2>
            <p className="text-[0.75rem] text-on-surface-muted">
              Vincule o VSL do produto para que os agentes de IA possam analisá-lo durante a criação de copy e criativos.
            </p>
          </div>
        </div>

        {/* Metadados do VSL atual (se existir) */}
        {product.vsl_url && (
          <div className="flex items-center gap-4 mb-5 px-4 py-3 bg-surface-container rounded-xl border border-white/5 text-[0.75rem] text-on-surface-muted">
            <span>
              Fonte:{' '}
              <strong className="text-on-surface-variant">
                {product.vsl_source === 'upload' ? 'Upload' : 'URL externa'}
              </strong>
            </span>
            {product.vsl_file_size_bytes && (
              <>
                <span className="w-1 h-1 bg-white/20 rounded-full" />
                <span>{formatBytes(product.vsl_file_size_bytes)}</span>
              </>
            )}
            {product.vsl_duration_seconds && (
              <>
                <span className="w-1 h-1 bg-white/20 rounded-full" />
                <span>{Math.floor(product.vsl_duration_seconds / 60)}:{String(product.vsl_duration_seconds % 60).padStart(2, '0')} min</span>
              </>
            )}
          </div>
        )}

        {/* Componente de upload */}
        <div className="bg-surface-container rounded-xl p-5 border border-white/5">
          <VSLUpload
            sku={sku!}
            currentUrl={product.vsl_url ?? null}
            onSaved={() => fetchProduct()}
          />
        </div>

      </section>
    </div>
  )
}
