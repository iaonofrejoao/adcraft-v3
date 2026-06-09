// GET /api/biblioteca/filters — retorna nichos e produtos para os dropdowns da biblioteca

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase service role key not configured');
  return createClient(url, key);
}

export async function GET() {
  try {
    const supabase = getServiceClient();

    const [{ data: products }, { data: niches }] = await Promise.all([
      supabase
        .from('products')
        .select('id, name, sku, niche_id')
        .eq('status', 'active')
        .order('name'),
      supabase
        .from('niches')
        .select('id, name')
        .eq('status', 'active')
        .order('name'),
    ]);

    return NextResponse.json({
      niches:   niches   ?? [],
      products: products ?? [],
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
