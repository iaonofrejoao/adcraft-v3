// GET  /api/biblioteca/tiktok-videos — lista todos os vídeos TikTok com filtros cruzados
// PATCH /api/biblioteca/tiktok-videos — atualiza status de um vídeo por id
//
// Query params (GET):
//   niche_id   — filtra por nicho
//   product_id — filtra por produto
//   status     — pending | approved | rejected | all  (default: all)
//   q          — busca full-text em description + author_handle
//   limit      — máx resultados (default: 100, máx: 200)
//   offset     — paginação (default: 0)

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase service role key not configured');
  return createClient(url, key);
}

export async function GET(req: Request) {
  try {
    const supabase = getServiceClient();
    const { searchParams } = new URL(req.url);

    const nicheId   = searchParams.get('niche_id')   ?? '';
    const productId = searchParams.get('product_id') ?? '';
    const status    = searchParams.get('status')     ?? 'all';
    const q         = searchParams.get('q')?.trim()  ?? '';
    const limit     = Math.min(parseInt(searchParams.get('limit')  ?? '100', 10), 200);
    const offset    = parseInt(searchParams.get('offset') ?? '0', 10);

    // Resolve product IDs permitidos pelo filtro de nicho
    let allowedProductIds: string[] | null = null;
    if (nicheId) {
      const { data: nicheProducts } = await supabase
        .from('products')
        .select('id')
        .eq('niche_id', nicheId);
      allowedProductIds = (nicheProducts ?? []).map((p: { id: string }) => p.id);
      if (allowedProductIds.length === 0) {
        return NextResponse.json({ videos: [], total: 0 });
      }
    }

    let query = supabase
      .from('tiktok_videos')
      .select(
        `id, tiktok_url, tiktok_video_id, video_url, author_handle, description,
         views_count, likes_count, relevance_score, status,
         thumbnail_url, duration_seconds, created_at, product_id,
         products!inner(id, name, sku, niche_id, niches(id, name))`,
        { count: 'exact' },
      )
      .order('relevance_score', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status !== 'all') query = query.eq('status', status);

    if (productId) {
      query = query.eq('product_id', productId);
    } else if (allowedProductIds) {
      query = query.in('product_id', allowedProductIds);
    }

    if (q) {
      // Escapa caracteres especiais do ilike para evitar queries malformadas
      const safeQ = q.replace(/[\\%_]/g, c => `\\${c}`)
      query = query.or(`description.ilike.%${safeQ}%,author_handle.ilike.%${safeQ}%`)
    }

    const { data, error, count } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const videos = (data ?? []).map((v: any) => {
      const { products: p, ...rest } = v;
      return {
        ...rest,
        product_name: p?.name ?? null,
        product_sku:  p?.sku  ?? null,
        niche_id:     p?.niche_id ?? null,
        niche_name:   p?.niches?.name ?? null,
      };
    });

    return NextResponse.json({ videos, total: count ?? 0 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { id, status } = body as { id: string; status: 'approved' | 'rejected' | 'pending' };

    if (!id || !status) {
      return NextResponse.json({ error: 'Campos obrigatórios: id, status' }, { status: 400 });
    }
    if (!['approved', 'rejected', 'pending'].includes(status)) {
      return NextResponse.json({ error: 'status inválido' }, { status: 400 });
    }

    const supabase = getServiceClient();
    const { data, error } = await supabase
      .from('tiktok_videos')
      .update({ status, reviewed_at: new Date().toISOString() })
      .eq('id', id)
      .select('id, status, reviewed_at')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ video: data });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
