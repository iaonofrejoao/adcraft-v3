// GET /api/products/[sku]/knowledge
// Query params:
//   type   — artifact_type filter: market, avatar, angles, etc. (optional)
//   status — fresh | superseded | all  (default: fresh)
// Response: { knowledge: KnowledgeRow[] }

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase service role key not configured');
  return createClient(url, key);
}

export async function GET(
  req: Request,
  { params }: { params: { sku: string } }
) {
  const { sku } = params;
  const { searchParams } = new URL(req.url);
  const artifactType  = searchParams.get('type');
  const statusFilter  = searchParams.get('status') ?? 'fresh';

  const supabase = getServiceClient();

  // Resolve product by SKU
  const { data: product, error: productErr } = await supabase
    .from('products')
    .select('id')
    .eq('sku', sku)
    .maybeSingle();

  if (productErr) return NextResponse.json({ error: productErr.message }, { status: 500 });
  if (!product)   return NextResponse.json({ knowledge: [] });

  let query = supabase
    .from('product_knowledge')
    .select('id, artifact_type, artifact_data, status, source_pipeline_id, created_at')
    .eq('product_id', product.id)
    .order('created_at', { ascending: false });

  if (artifactType)             query = query.eq('artifact_type', artifactType);
  if (statusFilter !== 'all')   query = query.eq('status', statusFilter);

  const { data: knowledge, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ knowledge: knowledge ?? [] });
}
