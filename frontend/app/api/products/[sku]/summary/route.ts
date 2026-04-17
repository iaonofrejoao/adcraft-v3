// GET /api/products/:sku/summary — resumo de status do produto para o card

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

  // Busca o produto pelo SKU
  const { data: product, error } = await supabase
    .from('products')
    .select('id, viability_score, updated_at')
    .eq('sku', sku)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 });

  const productId = product.id;

  // Faz todas as contagens em paralelo
  const [marketResult, personasResult, copiesResult] = await Promise.all([
    // Estudo de mercado: qualquer artifact de market
    supabase
      .from('product_knowledge')
      .select('id', { count: 'exact', head: true })
      .eq('product_id', productId)
      .ilike('artifact_type', 'market%'),

    // Personas/avatars
    supabase
      .from('product_knowledge')
      .select('id', { count: 'exact', head: true })
      .eq('product_id', productId)
      .or('artifact_type.ilike.avatar%,artifact_type.ilike.persona%'),

    // Copies geradas
    supabase
      .from('copy_components')
      .select('id', { count: 'exact', head: true })
      .eq('product_id', productId),
  ]);

  return NextResponse.json({
    viability_score:        product.viability_score ?? null,
    has_market_study:       (marketResult.count ?? 0) > 0,
    personas_count:         personasResult.count ?? 0,
    copies_count:           copiesResult.count ?? 0,
    creatives_count:        0,  // TODO: adicionar quando houver tabela de criativos
    active_campaigns_count: 0,  // TODO: adicionar quando houver tabela de campanhas
    updated_at:             product.updated_at,
  });
}
