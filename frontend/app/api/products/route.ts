// POST /api/products
// Cadastra um novo produto e classifica automaticamente o nicho via embedding.
// PLANO_EXECUCAO 2.6.4 | PRD seção 6 (tabela products)
//
// Fluxo:
//   1. Valida body (zod)
//   2. INSERT em products (trigger SQL gera SKU automaticamente)
//   3. Gera embedding do produto (nome + URL)
//   4. Chama RPC find_nearest_niche — atualiza products.niche_id se match ≥ threshold
//   5. Grava embedding em `embeddings` para uso futuro
//   6. Retorna produto criado com sku, slug, niche_id

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { generateEmbedding, embeddingToSql } from '../../../lib/embeddings/gemini-embeddings';

// ── Supabase service role (bypassa RLS para escrita server-side) ──────────────

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase service role key not configured');
  return createClient(url, key);
}

// ── Validação de input ────────────────────────────────────────────────────────

const CreateProductSchema = z.object({
  user_id:            z.string().uuid(),
  name:               z.string().min(2).max(255),
  platform:           z.enum(['hotmart', 'clickbank', 'monetizze', 'eduzz']),
  product_url:        z.string().url(),
  affiliate_link:     z.string().url(),
  commission_percent: z.number().min(0).max(100),
  ticket_price:       z.number().positive(),
  target_country:     z.string().max(10).default('BR'),
  target_language:    z.string().max(20).default('pt-BR'),
  vsl_url:            z.string().url().nullable().optional(),
});

type CreateProductInput = z.infer<typeof CreateProductSchema>;

// ── Handler ───────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  // 1. Parse e valida body
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = CreateProductSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 422 }
    );
  }

  const input: CreateProductInput = parsed.data;
  const supabase = getServiceClient();

  // 2. INSERT em products
  // O trigger trigger_generate_sku preenche products.sku automaticamente.
  const { data: product, error: insertError } = await supabase
    .from('products')
    .insert({
      user_id:            input.user_id,
      name:               input.name,
      platform:           input.platform,
      product_url:        input.product_url,
      affiliate_link:     input.affiliate_link,
      commission_percent: input.commission_percent,
      ticket_price:       input.ticket_price,
      target_country:     input.target_country,
      target_language:    input.target_language,
      vsl_url:            input.vsl_url ?? null,
    })
    .select('id, name, sku, slug, niche_id, created_at')
    .single();

  if (insertError || !product) {
    console.error('[products POST] insert error:', insertError);
    return NextResponse.json(
      { error: 'Failed to create product', details: insertError?.message },
      { status: 500 }
    );
  }

  // 3–5. Classificação automática de nicho via embedding (best-effort, não bloqueia resposta)
  classifyNicheAsync(product.id, input.name, input.product_url, supabase).catch((err) =>
    console.error('[products POST] niche classification failed:', err)
  );

  return NextResponse.json(product, { status: 201 });
}

// ── Classificação de nicho (async, não-bloqueante) ────────────────────────────

async function classifyNicheAsync(
  productId: string,
  name: string,
  productUrl: string,
  supabase: ReturnType<typeof getServiceClient>
): Promise<void> {
  // 3. Gera embedding do produto (nome + URL como âncora semântica)
  const embeddingText = `${name} ${productUrl}`;
  const { values: embeddingValues } = await generateEmbedding(embeddingText);

  // 4. Chama RPC find_nearest_niche (cosine similarity via pgvector)
  const { data: nicheMatch } = await supabase.rpc('find_nearest_niche', {
    query_embedding: embeddingToSql(embeddingValues),
    match_threshold: 0.75,
    match_count: 1,
  });

  // Se encontrou nicho com similaridade suficiente, atualiza o produto
  if (nicheMatch && nicheMatch.length > 0) {
    const { niche_id } = nicheMatch[0] as { niche_id: string };
    await supabase
      .from('products')
      .update({ niche_id })
      .eq('id', productId);
  }

  // 5. Persiste o embedding do produto para buscas futuras e reclassificações
  await supabase.from('embeddings').insert({
    source_table: 'products',
    source_id:    productId,
    embedding:    embeddingToSql(embeddingValues),
    model:        'gemini-embedding-001',
  });
}
