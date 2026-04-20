import { redirect } from 'next/navigation'

export default function ScriptsPage({ params }: { params: { sku: string } }) {
  redirect(`/products/${params.sku}/storyboard`)
}
