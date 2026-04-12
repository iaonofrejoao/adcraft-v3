// GET /api/products/:sku — retorna produto pelo SKU

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase service role key not configured');
  return createClient(url, key);
}

export async function GET(
  _req: Request,
  { params }: { params: { sku: string } }
) {
  const { sku } = params;
  const supabase = getServiceClient();

  const { data: product, error } = await supabase
    .from('products')
    .select('id, name, sku, platform, target_language, ticket_price, commission_percent, product_url, affiliate_link, niche_id, created_at')
    .eq('sku', sku)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!product) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 });
  }

  return NextResponse.json({ product });
}
