// GET  /api/products/[sku]/tiktok-videos  — lista vídeos TikTok do produto
// PATCH /api/products/[sku]/tiktok-videos  — atualiza status de um vídeo (approve/reject)
//
// Query params (GET):
//   status — pending | approved | rejected | all  (default: all)
//   limit  — número máximo de resultados (default: 50)

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
  try {
    const supabase = getServiceClient();

    const { data: product, error: productErr } = await supabase
      .from('products')
      .select('id')
      .eq('sku', params.sku)
      .maybeSingle();

    if (productErr) return NextResponse.json({ error: productErr.message }, { status: 500 });
    if (!product)   return NextResponse.json({ videos: [] });

    const { searchParams } = new URL(req.url);
    const statusFilter = searchParams.get('status') ?? 'all';
    const limit = parseInt(searchParams.get('limit') ?? '50', 10);

    let query = supabase
      .from('tiktok_videos')
      .select(`
        id, tiktok_url, tiktok_video_id, video_url, author_handle, description,
        views_count, likes_count, relevance_score, status,
        local_path, thumbnail_url, duration_seconds, created_at, reviewed_at
      `)
      .eq('product_id', (product as { id: string }).id)
      .order('relevance_score', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(limit);

    if (statusFilter !== 'all') {
      query = query.eq('status', statusFilter);
    }

    const { data: videos, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ videos: videos ?? [] });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: { sku: string } }
) {
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

    const { data: product, error: productErr } = await supabase
      .from('products')
      .select('id')
      .eq('sku', params.sku)
      .maybeSingle();

    if (productErr) return NextResponse.json({ error: productErr.message }, { status: 500 });
    if (!product)   return NextResponse.json({ error: 'Produto não encontrado' }, { status: 404 });

    const productId = (product as { id: string }).id;

    const { data, error } = await supabase
      .from('tiktok_videos')
      .update({ status, reviewed_at: new Date().toISOString() })
      .eq('id', id)
      .eq('product_id', productId)
      .select('id, status, reviewed_at')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ video: data });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
