// GET /api/products/:sku — retorna produto pelo SKU
// PATCH /api/products/:sku — atualiza nome e/ou status

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

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
    .select('id, name, sku, platform, target_country, target_language, ticket_price, commission_percent, product_url, affiliate_link, niche_id, status, created_at, updated_at')
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

// ── PATCH ─────────────────────────────────────────────────────────────────────

const PatchSchema = z.object({
  name:            z.string().min(1).max(200).optional(),
  status:          z.enum(['active', 'inactive', 'archived']).optional(),
  target_country:  z.string().max(10).optional(),
  target_language: z.string().max(20).optional(),
}).refine(
  (d) => d.name !== undefined || d.status !== undefined || d.target_country !== undefined || d.target_language !== undefined,
  { message: 'Pelo menos um campo deve ser fornecido' }
);

export async function PATCH(
  req: Request,
  { params }: { params: { sku: string } }
) {
  const { sku } = params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 422 }
    );
  }

  const supabase = getServiceClient();

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (parsed.data.name            !== undefined) patch.name            = parsed.data.name;
  if (parsed.data.status          !== undefined) patch.status          = parsed.data.status;
  if (parsed.data.target_country  !== undefined) patch.target_country  = parsed.data.target_country;
  if (parsed.data.target_language !== undefined) patch.target_language = parsed.data.target_language;

  const { data, error: updateErr } = await supabase
    .from('products')
    .update(patch)
    .eq('sku', sku)
    .select('id, name, sku, status, updated_at')
    .single();

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
