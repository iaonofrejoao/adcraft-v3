import { redirect } from 'next/navigation'

export default function StoryboardPage({ params }: { params: { sku: string } }) {
  redirect(`/products/${params.sku}/video`)
}
