// GET  /api/products/[sku]/persona  — retorna o persona_asset ativo do produto
// POST /api/products/[sku]/persona  — dispara setup-persona.ts via child_process
//
// GET Response: { persona: PersonaAsset | null }
// POST Response: { ok: true, persona_id: string } | { error: string }

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { spawn } from 'child_process';
import * as path from 'path';

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
  try {
    const supabase = getServiceClient();

    const { data: product, error: productErr } = await supabase
      .from('products')
      .select('id')
      .eq('sku', params.sku)
      .maybeSingle();

    if (productErr) return NextResponse.json({ error: productErr.message }, { status: 500 });
    if (!product)   return NextResponse.json({ persona: null });

    const productId = (product as { id: string }).id;

    const { data: persona, error } = await supabase
      .from('persona_assets')
      .select('id, status, photos, heygen_avatar_id, elevenlabs_voice_id, error_message, created_at, completed_at')
      .eq('product_id', productId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ persona: persona ?? null });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(
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
    if (!product)   return NextResponse.json({ error: 'Produto não encontrado' }, { status: 404 });

    const productId = (product as { id: string }).id;

    // Verifica se já está em criação ou pronto
    const { data: existing } = await supabase
      .from('persona_assets')
      .select('id, status')
      .eq('product_id', productId)
      .in('status', ['creating', 'ready'])
      .maybeSingle();

    if (existing && (existing as { status: string }).status === 'ready') {
      return NextResponse.json(
        { error: 'Persona já está configurada para este produto.' },
        { status: 409 }
      );
    }
    if (existing && (existing as { status: string }).status === 'creating') {
      return NextResponse.json(
        { error: 'Setup de persona já está em execução.' },
        { status: 409 }
      );
    }

    const body = await req.json().catch(() => ({})) as { pipeline_id?: string };
    const scriptPath = path.resolve(process.cwd(), '../scripts/video/setup-persona.ts');

    const args = ['tsx', scriptPath, '--product-id', productId];
    if (body.pipeline_id) args.push('--pipeline-id', body.pipeline_id);

    // Roda em background — o frontend monitora via polling/Realtime
    const child = spawn('npx', args, {
      detached: true,
      stdio:    'ignore',
      env:      { ...process.env },
    });
    child.unref();

    return NextResponse.json({ ok: true, product_id: productId });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
