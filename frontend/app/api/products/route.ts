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

// ── GET /api/products ─────────────────────────────────────────────────────────

export async function GET() {
  try {
    const supabase = getServiceClient();
    const { data, error } = await supabase
      .from('products')
      .select('id, name, sku, platform, target_language, ticket_price, commission_percent, created_at, niches(name)')
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Reshape niches relation → niche to match the Product interface on the client
    const products = (data ?? []).map((p) => {
      const { niches, ...rest } = p as typeof p & { niches: { name: string } | null };
      return { ...rest, niche: niches ?? null };
    });

    return NextResponse.json({ products });
  } catch (err) {
    console.error('[products GET] error:', err);
    return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 });
  }
}

// ── Supabase service role (bypassa RLS para escrita server-side) ──────────────

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase service role key not configured');
  return createClient(url, key);
}

// ── Validação de input ────────────────────────────────────────────────────────

const PLATFORM_DOMAINS: Record<string, 'hotmart' | 'clickbank' | 'monetizze' | 'eduzz'> = {
  'hotmart.com':    'hotmart',
  'clickbank.com':  'clickbank',
  'monetizze.com.br': 'monetizze',
  'eduzz.com':      'eduzz',
};

function detectPlatform(url: string): 'hotmart' | 'clickbank' | 'monetizze' | 'eduzz' | null {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    return PLATFORM_DOMAINS[host] ?? null;
  } catch {
    return null;
  }
}

const CreateProductSchema = z.object({
  user_id:            z.string().uuid(),
  name:               z.string().min(2).max(255),
  platform:           z.enum(['hotmart', 'clickbank', 'monetizze', 'eduzz']).optional(),
  product_url:        z.string().url(),
  affiliate_link:     z.string().url().optional(),
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

  // Resolve campos opcionais extraíveis da URL
  const platform      = input.platform ?? detectPlatform(input.product_url) ?? 'hotmart';
  const affiliateLink = input.affiliate_link ?? input.product_url;

  // 2. INSERT em products
  // O trigger trigger_generate_sku preenche products.sku automaticamente.
  const { data: product, error: insertError } = await supabase
    .from('products')
    .insert({
      user_id:            input.user_id,
      name:               input.name,
      platform,
      product_url:        input.product_url,
      affiliate_link:     affiliateLink,
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
  // Import dinâmico evita que workers/lib/db.ts inicialize conexão pg no top-level
  // (o que causaria 500 durante o carregamento do módulo pelo Next.js)
  const { generateSingleEmbedding, embeddingToSql } = await import('../../../../workers/lib/embeddings/gemini-embeddings');

  // 3. Gera embedding do produto (nome + URL como âncora semântica)
  const embeddingText = `${name} ${productUrl}`;
  const embeddingValues = await generateSingleEmbedding(embeddingText, 'products', productId);

  // 4. Chama RPC find_nearest_niche (cosine similarity via pgvector)
  const { data: nicheMatch } = await supabase.rpc('find_nearest_niche', {
    query_embedding: embeddingToSql(embeddingValues),
    match_threshold: 0.65,
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
