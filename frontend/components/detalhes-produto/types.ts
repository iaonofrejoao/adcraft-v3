export interface Product {
  id: string
  name: string
  sku: string
  platform: string
  target_country: string
  target_language: string
  ticket_price: string | null
  commission_percent: string | null
  product_url: string
  affiliate_link: string
  niche_id: string | null
  status?: string
  created_at: string
  updated_at?: string
}

export interface Pipeline {
  id: string
  goal: string
  status: string
  cost_so_far_usd: string
  budget_usd: string
  created_at: string
  updated_at: string
  progress_pct?: number
}
