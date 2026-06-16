/**
 * scripts/video/scrape-fb-ads.ts
 * Busca anúncios do Facebook Ads Library via Apify, pontua relevância e salva tudo.
 *
 * Uso:
 *   npx tsx scripts/video/scrape-fb-ads.ts \
 *     --product-id <uuid>               \
 *     --query     "fat burner weight loss" \
 *     --country   US                    \
 *     --max        20                   \   # máximo de anúncios a coletar (default: 20)
 *     [--dry-run]                           # não salva no banco
 *
 * Comportamento:
 *   1. Usa Claude Haiku para expandir a query em 4 variações semânticas.
 *   2. Passa todos os termos de uma vez ao Apify (uma chamada, sem multiplicar custo).
 *   3. Salva TODOS os resultados retornados — nenhum descartado.
 *   4. Score < 0.20 → status 'rejected' automático (visível na aba Rejeitados).
 *   5. Score ≥ 0.20 → status 'pending' (aguarda revisão humana).
 *
 * Dependências:
 *   - APIFY_TOKEN no .env
 *   - ANTHROPIC_API_KEY no .env (opcional — sem ele, usa query literal)
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import { parseArgs } from 'node:util';
import Anthropic from '@anthropic-ai/sdk';
import { supabase } from '../../workers/lib/db';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// ── Types ─────────────────────────────────────────────────────────────────────

interface FbAd {
  fb_ad_id:        string
  page_name:       string
  page_id:         string
  ad_copy:         string
  headline:        string
  cta_text:        string
  destination_url: string
  media_type:      'video' | 'image' | 'carousel' | 'unknown'
  video_url:       string | null
  image_url:       string | null
  platforms:       string[]
  started_at:      Date | null
  stopped_at:      Date | null
  days_running:    number
}

interface ScoredAd extends FbAd {
  relevance_score: number
}

// ── Query expansion (Claude Haiku) ────────────────────────────────────────────

async function expandQuery(query: string, niche: string, apiKey: string): Promise<string[]> {
  if (!apiKey) {
    console.log('[expand] ANTHROPIC_API_KEY ausente — usando query literal.');
    return [query];
  }

  try {
    const client = new Anthropic({ apiKey });
    const res = await client.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 256,
      messages: [{
        role:    'user',
        content: `You are helping search for Facebook ads in the "${niche}" niche.\n` +
                 `Original query: "${query}"\n\n` +
                 `Generate exactly 4 alternative search terms that cover different ways ` +
                 `competitors describe similar products (synonyms, adjacent angles, ` +
                 `benefit-focused terms). Keep each term short (2-5 words).\n\n` +
                 `Return ONLY a JSON array of 4 strings. No explanation.`,
      }],
    });

    const text    = (res.content.find((b) => b.type === 'text') as Anthropic.TextBlock | undefined)?.text ?? '[]';
    const cleaned = text.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();
    const arr     = JSON.parse(cleaned) as unknown;

    if (!Array.isArray(arr)) throw new Error('Resposta não é array');

    const terms = [query, ...(arr as string[]).slice(0, 4)];
    console.log(`[expand] Termos gerados: ${terms.join(' | ')}`);
    return terms;
  } catch (err: any) {
    console.warn(`[expand] Falha na expansão (${err.message}) — usando query literal.`);
    return [query];
  }
}

// ── Apify fetch ───────────────────────────────────────────────────────────────

function extractAdCopy(snapshot: any): string {
  if (!snapshot) return ''
  const html = snapshot?.body?.markup?.__html ?? ''
  if (html) return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 2000)
  const text = snapshot?.body_text ?? snapshot?.caption ?? snapshot?.cards?.[0]?.body ?? ''
  return String(text).slice(0, 2000)
}

function extractMediaType(snapshot: any): FbAd['media_type'] {
  if (!snapshot) return 'unknown'
  if (snapshot.video_hd_url || snapshot.video_sd_url || snapshot.cards?.some((c: any) => c.video_hd_url)) return 'video'
  if (snapshot.cards?.length > 1) return 'carousel'
  if (snapshot.images?.length || snapshot.resized_image_url) return 'image'
  return 'unknown'
}

function extractImageUrl(snapshot: any): string | null {
  if (!snapshot) return null
  return snapshot.resized_image_url
    ?? snapshot.video_preview_image_url
    ?? snapshot.thumbnail_url
    ?? snapshot.images?.[0]?.resized_url
    ?? snapshot.images?.[0]?.url
    ?? snapshot.cards?.[0]?.resized_image_url
    ?? snapshot.cards?.[0]?.image_url
    ?? snapshot.cards?.[0]?.thumbnail_url
    ?? null
}

function extractVideoUrl(snapshot: any): string | null {
  if (!snapshot) return null
  return snapshot.video_hd_url
    ?? snapshot.video_sd_url
    ?? snapshot.cards?.[0]?.video_hd_url
    ?? snapshot.cards?.[0]?.video_sd_url
    ?? null
}

function parseStartDate(raw: any): Date | null {
  if (!raw) return null
  if (typeof raw === 'number' && raw > 0) return new Date(raw * 1000)
  if (typeof raw === 'string' && raw.length > 0) return new Date(raw)
  return null
}

function calcDaysRunning(started: Date | null, stopped: Date | null): number {
  if (!started) return 0
  const end = stopped ?? new Date()
  return Math.max(0, Math.floor((end.getTime() - started.getTime()) / 86_400_000))
}

async function fetchFbAds(
  searchTerms: string[],
  country: string,
  max: number,
  apifyToken: string,
): Promise<FbAd[]> {
  console.log(`[Apify] Termos: ${searchTerms.join(' | ')} | país: ${country} | máx: ${max}`);

  const url = `https://api.apify.com/v2/acts/apify~facebook-ads-scraper/run-sync-get-dataset-items?token=${apifyToken}&timeout=300`;

  const body = {
    searchTerms,
    country,
    adType:             'ALL',
    publisherPlatforms: ['facebook', 'instagram'],
    adActiveStatus:     'ACTIVE',
    limit:              Math.min(max, 50),
  };

  let res: Response;
  try {
    res = await fetch(url, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
      signal:  AbortSignal.timeout(310_000),
    });
  } catch (err: any) {
    throw new Error(`[Apify] Falha na requisição: ${err.message}`);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`[Apify] HTTP ${res.status}: ${text.slice(0, 300)}`);
  }

  const items: any[] = await res.json();
  console.log(`[Apify] ${items.length} anúncios recebidos.`);

  return items.map(item => {
    const snap      = item.snapshot ?? item;
    const started   = parseStartDate(item.startDate ?? item.ad_delivery_start_time);
    const stoppedRaw = item.endDate ?? item.ad_delivery_stop_time;
    const stopped   = (stoppedRaw && stoppedRaw !== 0) ? parseStartDate(stoppedRaw) : null;

    return {
      fb_ad_id:        String(item.adArchiveID ?? item.id ?? ''),
      page_name:       String(item.pageName ?? item.page_name ?? ''),
      page_id:         String(item.pageID   ?? item.page_id   ?? ''),
      ad_copy:         extractAdCopy(snap),
      headline:        String(snap?.title ?? snap?.link_title ?? snap?.cards?.[0]?.title ?? ''),
      cta_text:        String(snap?.cta_text ?? snap?.link_cta_type ?? ''),
      destination_url: String(snap?.link_url ?? snap?.cards?.[0]?.link_url ?? ''),
      media_type:      extractMediaType(snap),
      video_url:       extractVideoUrl(snap),
      image_url:       extractImageUrl(snap),
      platforms:       Array.isArray(item.publisherPlatforms) ? item.publisherPlatforms : [],
      started_at:      started,
      stopped_at:      stopped,
      days_running:    calcDaysRunning(started, stopped),
    };
  });
}

// ── Scoring ───────────────────────────────────────────────────────────────────

function scoreAd(ad: FbAd, nicheKeywords: string[]): number {
  const longevityScore = Math.min(ad.days_running / 90, 1);

  const text    = `${ad.ad_copy} ${ad.headline} ${ad.page_name}`.toLowerCase();
  const hits    = nicheKeywords.filter(k => text.includes(k)).length;
  const kwScore = Math.min(hits / Math.max(nicheKeywords.length * 0.3, 1), 1);

  const mediaScore = ad.media_type === 'video' ? 1 : ad.media_type === 'carousel' ? 0.7 : 0.5;

  const raw = longevityScore * 0.6 + kwScore * 0.3 + mediaScore * 0.1;
  return Math.round(Math.min(raw, 1) * 100) / 100;
}

function buildKeywords(niche: string): string[] {
  return niche
    .toLowerCase()
    .split(/[\s,]+/)
    .filter(w => w.length > 2);
}

// ── DB ────────────────────────────────────────────────────────────────────────

async function resolveProduct(productId: string): Promise<{ name: string; niche: string; country: string }> {
  const { data, error } = await supabase
    .from('products')
    .select('name, target_country, niches(name)')
    .eq('id', productId)
    .maybeSingle();

  if (error) throw error;
  if (!data)  throw new Error(`Produto ${productId} não encontrado.`);

  return {
    name:    data.name ?? '',
    niche:   (data.niches as any)?.name ?? '',
    country: (data.target_country as string | null) ?? 'US',
  };
}

// Score < 0.20 → rejeitado automaticamente (baixa relevância/longevidade)
// Score ≥ 0.20 → pendente para revisão humana
const AUTO_REJECT_THRESHOLD = 0.20;

async function saveToDatabase(productId: string, ads: ScoredAd[]): Promise<{ saved: number; pending: number; autoRejected: number }> {
  const rows = ads.map(ad => ({
    product_id:      productId,
    fb_ad_id:        ad.fb_ad_id,
    page_name:       ad.page_name,
    page_id:         ad.page_id,
    ad_copy:         ad.ad_copy.slice(0, 2000),
    headline:        ad.headline.slice(0, 500),
    cta_text:        ad.cta_text.slice(0, 100),
    destination_url: ad.destination_url.slice(0, 500),
    media_type:      ad.media_type,
    video_url:       ad.video_url,
    image_url:       ad.image_url,
    platforms:       ad.platforms,
    started_at:      ad.started_at?.toISOString() ?? null,
    stopped_at:      ad.stopped_at?.toISOString() ?? null,
    days_running:    ad.days_running,
    relevance_score: ad.relevance_score,
    status:          ad.relevance_score >= AUTO_REJECT_THRESHOLD ? 'pending' : 'rejected',
  }));

  const { data, error } = await supabase
    .from('facebook_ads')
    .upsert(rows, { onConflict: 'product_id,fb_ad_id', ignoreDuplicates: false })
    .select('id, status');

  if (error) throw error;

  const results    = data ?? [];
  const pending    = results.filter((r: any) => r.status === 'pending').length;
  const autoRejected = results.filter((r: any) => r.status === 'rejected').length;

  return { saved: results.length, pending, autoRejected };
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      'product-id': { type: 'string' },
      'query':      { type: 'string' },
      'country':    { type: 'string' },
      'max':        { type: 'string' },
      'dry-run':    { type: 'boolean' },
    },
  });

  const productId = values['product-id'];
  const queryRaw  = values['query'];
  const max       = parseInt(values['max'] ?? '20', 10);
  const dryRun    = values['dry-run'] ?? false;

  if (!productId) throw new Error('--product-id é obrigatório');
  if (!queryRaw)  throw new Error('--query é obrigatório');

  const apifyToken    = process.env.APIFY_TOKEN ?? '';
  const anthropicKey  = process.env.ANTHROPIC_API_KEY ?? '';

  if (!apifyToken) throw new Error('APIFY_TOKEN não configurado no .env');

  const product = await resolveProduct(productId);
  const country  = values['country'] ?? product.country;
  const niche    = `${product.name} ${product.niche}`;

  console.log(`[scrape-fb-ads] Produto: ${product.name} (${productId})`);
  console.log(`[scrape-fb-ads] Nicho: "${niche}" | País: ${country} | Máx: ${max}`);

  // 1. Expandir query semanticamente
  const searchTerms = await expandQuery(queryRaw, niche, anthropicKey);

  // 2. Coletar do Apify (uma chamada, todos os termos)
  const raw      = await fetchFbAds(searchTerms, country, max, apifyToken);
  const keywords = buildKeywords(niche);
  const scored   = raw.map(ad => ({ ...ad, relevance_score: scoreAd(ad, keywords) }));

  scored.sort((a, b) => b.relevance_score - a.relevance_score);

  const willAutoReject = scored.filter(a => a.relevance_score < AUTO_REJECT_THRESHOLD).length;
  console.log(`[scrape-fb-ads] ${scored.length} anúncios pontuados | ${willAutoReject} abaixo do threshold (→ rejected)`);

  if (dryRun) {
    console.log('\n[DRY-RUN] Resultado (não salvo):');
    console.log(JSON.stringify(scored, null, 2));
    return;
  }

  if (scored.length === 0) {
    console.log('[scrape-fb-ads] Nenhum anúncio para salvar.');
    return;
  }

  const { saved, pending, autoRejected } = await saveToDatabase(productId, scored);
  console.log(`[scrape-fb-ads] ${saved} anúncios salvos/atualizados: ${pending} pendentes, ${autoRejected} auto-rejeitados.`);
}

main().catch(err => {
  console.error('[scrape-fb-ads] ERRO FATAL:', err.message);
  process.exit(1);
});
