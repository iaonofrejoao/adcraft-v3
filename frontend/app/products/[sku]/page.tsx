import { redirect } from 'next/navigation'

export default function ProductDetailPage({
  params,
}: {
  params: { sku: string }
}) {
  redirect(`/products/${params.sku}/mercado`)
}
