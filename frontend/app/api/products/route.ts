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

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const showInactive = searchParams.get('show_inactive') === 'true';

    const supabase = getServiceClient();

    // Tenta query com coluna status (disponível após migration 017).
    // Se a coluna ainda não existir, faz fallback sem ela.
    let data: Record<string, unknown>[] | null = null;

    const withStatus = await supabase
      .from('products')
      .select('id, name, sku, platform, logo_url, target_country, target_language, ticket_price, commission_percent, status, created_at, niches(name)')
      .order('created_at', { ascending: false });

    if (withStatus.error) {
      // Coluna 'status' provavelmente não existe — fallback sem ela
      const fallback = await supabase
        .from('products')
        .select('id, name, sku, platform, logo_url, target_country, target_language, ticket_price, commission_percent, created_at, niches(name)')
        .order('created_at', { ascending: false });
      if (fallback.error) throw fallback.error;
      data = (fallback.data ?? []) as Record<string, unknown>[];
    } else {
      let rows = withStatus.data ?? [];
      if (!showInactive) {
        rows = rows.filter((p) => p.status !== 'inactive' && p.status !== 'archived');
      }
      data = rows as Record<string, unknown>[];
    }

    // Reshape niches relation → niche to match the Product interface on the client
    const products = data.map((p) => {
      const { niches, ...rest } = p as typeof p & { niches: { name: string } | null };
      return { ...rest, niche: niches ?? null };
    });

    return NextResponse.json({ products });
  } catch (err) {
    console.error('[products GET] error:', err);
    return NextResponse.json({ products: [] }, { status: 200 });
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
  logo_url:           z.string().url().nullable().optional(),
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
  const platform      = input.platform ?? detectPlatform(input.product_url) ?? null;
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
      logo_url:           input.logo_url ?? null,
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

  // 6. Extração de logo (best-effort, não bloqueia resposta)
  //    Só busca se o usuário não forneceu logo_url no cadastro
  if (!input.logo_url) {
    fetchLogoAsync(product.id, input.product_url, supabase).catch((err) =>
      console.error('[products POST] logo fetch failed:', err)
    );
  }

  return NextResponse.json(product, { status: 201 });
}

// ── Embedding via Gemini REST API (sem importar workers) ─────────────────────

const GEMINI_EMBED_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:batchEmbedContents';

async function generateEmbedding(text: string): Promise<number[]> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY não definida');

  const res = await fetch(`${GEMINI_EMBED_URL}?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requests: [{ model: 'models/gemini-embedding-001', content: { parts: [{ text }] }, outputDimensionality: 768 }],
    }),
  });

  if (!res.ok) throw new Error(`Gemini embedding error ${res.status}: ${await res.text()}`);
  const data = await res.json() as { embeddings?: Array<{ values?: number[] }> };
  return data.embeddings?.[0]?.values ?? [];
}

function embeddingToSql(values: number[]): string {
  return `[${values.join(',')}]`;
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
  const embeddingValues = await generateEmbedding(embeddingText);

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
  } else {
    // Fallback por palavras-chave: nome genérico pode não ter sinal semântico
    // suficiente para atingir o threshold de embedding (0.65).
    // Tenta correspondência literal com slug/nome dos nichos ativos.
    await fallbackNicheByKeyword(productId, name, productUrl, supabase);
  }

  // 5. Persiste o embedding do produto para buscas futuras e reclassificações
  await supabase.from('embeddings').insert({
    source_table: 'products',
    source_id:    productId,
    embedding:    embeddingToSql(embeddingValues),
    model:        'gemini-embedding-001',
  });
}

// ── Fallback: classificação por palavras-chave ────────────────────────────────
// Usado quando o embedding score não atinge o threshold mínimo (ex: nomes genéricos
// como "QA_Stress_3_xxx" que não carregam sinal semântico suficiente).
// Estratégia: tokeniza nome + domínio da URL e verifica interseção com slug/name
// de cada nicho ativo. Caso múltiplos nichos batam, prioriza o maior overlap.

async function fallbackNicheByKeyword(
  productId: string,
  name: string,
  productUrl: string,
  supabase: ReturnType<typeof getServiceClient>
): Promise<void> {
  const { data: niches } = await supabase
    .from('niches')
    .select('id, slug, name')
    .eq('status', 'active');

  if (!niches || niches.length === 0) return;

  // Normaliza o texto de busca: nome + domínio da URL, lowercase, sem acentos
  const normalize = (s: string) =>
    s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

  let urlDomain = '';
  try {
    urlDomain = new URL(productUrl).hostname;
  } catch {
    // URL inválida — ignora domínio
  }

  const searchText = normalize(`${name} ${urlDomain}`);

  let bestNicheId: string | null = null;
  let bestScore = 0;

  for (const niche of niches) {
    // Tokens do nicho: slug separado por hífen + palavras do nome
    const nicheTokens = normalize(`${niche.slug} ${niche.name}`)
      .split(/[\s\-_]+/)
      .filter((t) => t.length >= 3);

    const score = nicheTokens.filter((token) => searchText.includes(token)).length;

    if (score > bestScore) {
      bestScore = score;
      bestNicheId = niche.id;
    }
  }

  if (bestNicheId && bestScore > 0) {
    await supabase
      .from('products')
      .update({ niche_id: bestNicheId })
      .eq('id', productId);
  }
}

// ── Extração automática de logo ────────────────────────────────────────────────
// Ordem de prioridade: og:image → twitter:image → apple-touch-icon → favicon .png

const LOGO_FETCH_TIMEOUT = 12_000;
const LOGO_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

function resolveImageUrl(raw: string, base: string): string | null {
  if (!raw) return null;
  try { return new URL(raw.trim(), base).href; } catch { return null; }
}

function extractBestImage(html: string, pageUrl: string): string | null {
  const og =
    html.match(/property=["']og:image["'][^>]*content=["']([^"']+)["']/i)?.[1] ??
    html.match(/content=["']([^"']+)["'][^>]*property=["']og:image["']/i)?.[1];
  if (og) return resolveImageUrl(og, pageUrl);

  const tw =
    html.match(/name=["']twitter:image(?::src)?["'][^>]*content=["']([^"']+)["']/i)?.[1] ??
    html.match(/content=["']([^"']+)["'][^>]*name=["']twitter:image(?::src)?["']/i)?.[1];
  if (tw) return resolveImageUrl(tw, pageUrl);

  const apple = html.match(/<link[^>]+rel=["']apple-touch-icon["'][^>]+href=["']([^"']+)["']/i)?.[1];
  if (apple) return resolveImageUrl(apple, pageUrl);

  const png =
    html.match(/<link[^>]+href=["']([^"']+\.png[^"']*)["'][^>]*rel=["'][^"']*icon[^"']*["']/i)?.[1] ??
    html.match(/<link[^>]*rel=["'][^"']*icon[^"']*["'][^>]*href=["']([^"']+\.png[^"']*)["']/i)?.[1];
  if (png) return resolveImageUrl(png, pageUrl);

  return null;
}

async function fetchHtml(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LOGO_FETCH_TIMEOUT);
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': LOGO_UA, 'Accept': 'text/html,application/xhtml+xml' },
      signal: controller.signal,
      redirect: 'follow',
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    return await res.text();
  } catch {
    clearTimeout(timer);
    return null;
  }
}

async function fetchLogoAsync(
  productId: string,
  productUrl: string,
  supabase: ReturnType<typeof getServiceClient>
): Promise<void> {
  // Tentativa 1: URL original
  let html = await fetchHtml(productUrl);
  let logoUrl = html ? extractBestImage(html, productUrl) : null;

  // Tentativa 2: raiz do domínio (útil quando product_url é /text.html, /vsl, etc.)
  if (!logoUrl) {
    try {
      const rootUrl = new URL(productUrl).origin + '/';
      if (rootUrl !== productUrl && rootUrl !== productUrl + '/') {
        html = await fetchHtml(rootUrl);
        logoUrl = html ? extractBestImage(html, rootUrl) : null;
      }
    } catch { /* URL inválida */ }
  }

  if (!logoUrl) return;
  await supabase.from('products').update({ logo_url: logoUrl }).eq('id', productId);
  console.log(`[products POST] logo found: ${logoUrl}`);
}
