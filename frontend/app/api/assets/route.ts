// GET /api/assets
// Lista ativos gerados (tabela v1 `assets`), com join em `products` para SKU e nome.
// Query params:
//   limit — número de registros (default 50, max 200)
//
// Resposta: { assets: [...] }
// Campos: id, tag (null em v1), asset_type, url, file_size, duration_s, created_at, product?
//
// A tabela v1 `assets` tem FK real para `products` → join via PostgREST funciona.

import { NextResponse } from 'next/server';
import { getSupabase } from '../../../../workers/lib/db';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const limit = Math.min(
    Math.max(1, parseInt(searchParams.get('limit') ?? '50', 10) || 50),
    200,
  );

  try {
    const supabase = getSupabase();

    const { data, error } = await supabase
      .from('assets')
      .select(`
        id,
        asset_type,
        file_url,
        file_size_bytes,
        marketing_metadata,
        created_at,
        products ( name, sku )
      `)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[api/assets] supabase error:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Mapeia colunas v1 → shape esperado pela UI em creatives/page.tsx
    const assets = (data ?? []).map((a: any) => ({
      id:         a.id,
      tag:        null,                                         // v1 não tem coluna tag
      asset_type: a.asset_type,
      url:        a.file_url ?? null,
      file_size:  a.file_size_bytes ?? null,
      duration_s: (a.marketing_metadata as any)?.duration_seconds ?? null,
      created_at: a.created_at,
      product:    a.products
        ? { name: (a.products as any).name, sku: (a.products as any).sku }
        : undefined,
    }));

    return NextResponse.json({ assets }, { status: 200 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[api/assets] unexpected error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
