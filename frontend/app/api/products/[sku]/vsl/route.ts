// POST /api/products/:sku/vsl
// Salva URL externa ou faz upload de vídeo via Supabase Storage.
//
// Body (JSON para URL externa):
//   { type: 'url', url: 'https://...' }
//
// Body (multipart/form-data para upload):
//   file: <mp4|mov|webm>, type: 'upload'
//
// Limites: 500MB, formatos aceitos: mp4, mov, webm

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const ALLOWED_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'];
const MAX_SIZE_BYTES = 500 * 1024 * 1024; // 500MB

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase service role key not configured');
  return createClient(url, key);
}

// ── POST ──────────────────────────────────────────────────────────────────────

export async function POST(
  req: Request,
  { params }: { params: { sku: string } }
) {
  const { sku } = params;
  const supabase = getServiceClient();

  // Valida que o produto existe
  const { data: product, error: productErr } = await supabase
    .from('products')
    .select('id')
    .eq('sku', sku)
    .maybeSingle();

  if (productErr) return NextResponse.json({ error: productErr.message }, { status: 500 });
  if (!product)   return NextResponse.json({ error: 'Product not found' }, { status: 404 });

  const contentType = req.headers.get('content-type') ?? '';

  // ── URL externa ────────────────────────────────────────────────────────────
  if (contentType.includes('application/json')) {
    let body: { type: string; url?: string };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    if (body.type !== 'url' || !body.url) {
      return NextResponse.json({ error: 'Campo url é obrigatório' }, { status: 422 });
    }

    // Validação básica de URL
    try { new URL(body.url) } catch {
      return NextResponse.json({ error: 'URL inválida' }, { status: 422 });
    }

    const { error: updateErr } = await supabase
      .from('products')
      .update({
        vsl_url:         body.url,
        vsl_source:      'external',
        vsl_uploaded_at: new Date().toISOString(),
        updated_at:      new Date().toISOString(),
      })
      .eq('id', product.id);

    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

    return NextResponse.json({ vsl_url: body.url, vsl_source: 'external' });
  }

  // ── Upload de arquivo ──────────────────────────────────────────────────────
  if (contentType.includes('multipart/form-data')) {
    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
    }

    const file = formData.get('file') as File | null;
    if (!file) return NextResponse.json({ error: 'Campo file é obrigatório' }, { status: 422 });

    // Valida tipo MIME
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: `Tipo não suportado: ${file.type}. Use mp4, mov ou webm.` },
        { status: 422 }
      );
    }

    // Valida tamanho
    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json(
        { error: `Arquivo muito grande (max 500MB). Tamanho: ${(file.size / 1024 / 1024).toFixed(0)}MB` },
        { status: 422 }
      );
    }

    // Determina extensão
    const extMap: Record<string, string> = {
      'video/mp4':       'mp4',
      'video/quicktime': 'mov',
      'video/webm':      'webm',
    };
    const ext      = extMap[file.type] ?? 'mp4';
    const fileName = `products/${sku}/vsl/${Date.now()}.${ext}`;

    // Upload para Supabase Storage
    const fileBuffer = await file.arrayBuffer();
    const { data: uploadData, error: uploadErr } = await supabase.storage
      .from('vsl-uploads')
      .upload(fileName, fileBuffer, {
        contentType:   file.type,
        cacheControl:  '3600',
        upsert:        false,
      });

    if (uploadErr) {
      // Tenta criar o bucket se não existir (first upload)
      if (uploadErr.message?.includes('Bucket not found')) {
        const { error: bucketErr } = await supabase.storage.createBucket('vsl-uploads', {
          public: true,
          fileSizeLimit: MAX_SIZE_BYTES,
          allowedMimeTypes: ALLOWED_TYPES,
        });
        if (bucketErr) return NextResponse.json({ error: bucketErr.message }, { status: 500 });

        // Retry upload
        const { error: retryErr } = await supabase.storage
          .from('vsl-uploads')
          .upload(fileName, fileBuffer, { contentType: file.type, upsert: false });
        if (retryErr) return NextResponse.json({ error: retryErr.message }, { status: 500 });
      } else {
        return NextResponse.json({ error: uploadErr.message }, { status: 500 });
      }
    }

    // Gera URL pública
    const { data: urlData } = supabase.storage
      .from('vsl-uploads')
      .getPublicUrl(uploadData?.path ?? fileName);

    const publicUrl = urlData?.publicUrl ?? '';

    // Atualiza o produto
    const { error: updateErr } = await supabase
      .from('products')
      .update({
        vsl_url:              publicUrl,
        vsl_source:           'upload',
        vsl_uploaded_at:      new Date().toISOString(),
        vsl_file_size_bytes:  file.size,
        updated_at:           new Date().toISOString(),
      })
      .eq('id', product.id);

    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

    return NextResponse.json({
      vsl_url:             publicUrl,
      vsl_source:          'upload',
      vsl_file_size_bytes: file.size,
    });
  }

  return NextResponse.json({ error: 'Content-Type deve ser application/json ou multipart/form-data' }, { status: 415 });
}
