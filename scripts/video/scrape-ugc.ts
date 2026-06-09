/**
 * scripts/video/scrape-ugc.ts
 * Busca vídeos TikTok por hashtag via Apify e pontua relevância via Gemini.
 *
 * Uso:
 *   npx tsx scripts/video/scrape-ugc.ts \
 *     --product-id <uuid>         \
 *     --query     "emagrecimento" \   # hashtags separadas por espaço ou vírgula (sem #)
 *     --max        20             \   # máximo de vídeos (default: 20)
 *     [--dry-run]                     # não salva no banco
 *
 * Dependências:
 *   - APIFY_TOKEN no .env  (https://console.apify.com → Settings → API)
 *   - GEMINI_API_KEY no .env
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import { parseArgs } from 'node:util';
import { supabase } from '../../workers/lib/db';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// ── Types ─────────────────────────────────────────────────────────────────────

interface TikTokVideo {
  id:          string
  webpage_url: string
  video_url:   string | null
  uploader:    string
  description: string
  view_count:  number
  like_count:  number
  duration:    number
  thumbnail:   string
}

interface ScoredVideo extends TikTokVideo {
  relevance_score: number
}

// ── Apify fetch ───────────────────────────────────────────────────────────────

// IMPORTANTE: usa apenas 1 hashtag — cada hashtag vira uma job Apify separada,
// multiplicando o consumo de créditos.
function queryToSingleHashtag(query: string): string {
  return query
    .toLowerCase()
    .split(/[\s,]+/)
    .filter(Boolean)
    .map(t => t.replace(/^#/, ''))[0] ?? 'weightloss';
}

// Usa o campo textLanguage retornado pelo Apify (mais preciso que heurística)
function isEnglishItem(item: any): boolean {
  const lang = item.textLanguage ?? '';
  return lang === '' || lang.startsWith('en');
}

async function fetchTikTokVideos(
  query: string,
  max: number,
  apifyToken: string,
  languageFilter?: string,
): Promise<TikTokVideo[]> {
  const hashtag = queryToSingleHashtag(query);
  console.log(`[Apify] Hashtag: #${hashtag} — máx. ${max} vídeos${languageFilter ? ` (filtro: ${languageFilter})` : ''}`);

  const url = `https://api.apify.com/v2/acts/clockworks~tiktok-hashtag-scraper/run-sync-get-dataset-items?token=${apifyToken}&timeout=300`;

  // Solicita o dobro do max para ter margem após o filtro de idioma
  const fetchCount = languageFilter === 'en' ? Math.min(max * 2, 100) : Math.min(max, 100);

  const body = {
    hashtags: [hashtag],
    resultsPerPage: fetchCount,
    shouldDownloadVideos: false,
    shouldDownloadCovers: false,
  };

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(310_000),
    });
  } catch (err: any) {
    throw new Error(`[Apify] Falha na requisição: ${err.message}`);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`[Apify] HTTP ${res.status}: ${text.slice(0, 200)}`);
  }

  const items: any[] = await res.json();
  console.log(`[Apify] ${items.length} vídeos recebidos do Apify.`);

  const filtered = languageFilter === 'en'
    ? items.filter(item => isEnglishItem(item))
    : items;

  if (languageFilter === 'en') {
    console.log(`[Apify] ${filtered.length} vídeos em inglês (campo textLanguage).`);
  }

  return filtered.slice(0, max).map(item => ({
    id:          item.id ?? String(item.createTime),
    webpage_url: item.webVideoUrl ?? '',
    // URL CDN do vídeo: extraída do subtitleLinks (versão mp4 com legenda ASR)
    video_url:   item.videoMeta?.subtitleLinks?.[0]?.tiktokLink
                  ?? item.videoMeta?.subtitleLinks?.[0]?.downloadLink
                  ?? null,
    uploader:    item.authorMeta?.name ?? item.authorMeta?.nickName ?? 'unknown',
    description: item.text ?? '',
    view_count:  item.playCount ?? 0,
    like_count:  item.diggCount ?? 0,
    duration:    item.videoMeta?.duration ?? 0,
    thumbnail:   item.videoMeta?.coverUrl ?? item.videoMeta?.originalCoverUrl ?? '',
  }));
}

// ── Gemini scoring ────────────────────────────────────────────────────────────

// Score local baseado em keywords, engajamento e duração — sem API externa.
function scoreVideo(video: TikTokVideo, nicheKeywords: string[]): number {
  const desc = (video.description + ' ' + video.uploader).toLowerCase();

  // Relevância por keywords do nicho
  const hits     = nicheKeywords.filter(k => desc.includes(k)).length;
  const keyScore = Math.min(hits / Math.max(nicheKeywords.length * 0.4, 1), 1);

  // Engajamento (likes/views), capped em 10%
  const engagement = video.view_count > 0
    ? Math.min(video.like_count / video.view_count / 0.10, 1)
    : 0;

  // Duração ideal: 15–90s
  const dur = video.duration;
  const durScore = dur >= 15 && dur <= 90 ? 1
    : dur > 0 && dur < 15 ? 0.5
    : dur > 90 && dur <= 180 ? 0.7
    : 0.3;

  const raw = keyScore * 0.6 + engagement * 0.2 + durScore * 0.2;
  return Math.round(Math.min(raw, 1) * 100) / 100;
}

function nicheToKeywords(niche: string): string[] {
  return niche
    .toLowerCase()
    .split(/[\s,]+/)
    .filter(w => w.length > 3)
    .concat([
      'emagrec', 'emagrecimento', 'termogen', 'suplemento', 'queimar', 'gordura',
      'academia', 'fitness', 'dieta', 'metabolismo', 'perda de peso', 'emagrecer',
    ]);
}

function scoreVideos(videos: TikTokVideo[], productNiche: string): ScoredVideo[] {
  const keywords = nicheToKeywords(productNiche);
  console.log(`[score] Keywords: ${keywords.slice(0, 8).join(', ')}…`);
  return videos.map(v => ({ ...v, relevance_score: scoreVideo(v, keywords) }));
}

// ── DB ────────────────────────────────────────────────────────────────────────

async function resolveProductNiche(productId: string): Promise<string> {
  const { data, error } = await supabase
    .from('products')
    .select('name, niches(name)')
    .eq('id', productId)
    .maybeSingle();

  if (error) throw error;
  if (!data)  throw new Error(`Produto ${productId} não encontrado.`);

  const nicheName = (data.niches as any)?.name ?? '';
  return `${data.name} ${nicheName}`.trim();
}

async function saveToDatabase(productId: string, videos: ScoredVideo[]): Promise<string[]> {
  const rows = videos.map(v => ({
    product_id:       productId,
    tiktok_url:       v.webpage_url,
    tiktok_video_id:  v.id,
    video_url:        v.video_url,
    author_handle:    v.uploader.replace(/^@/, ''),
    description:      v.description.slice(0, 1000),
    views_count:      v.view_count,
    likes_count:      v.like_count,
    relevance_score:  v.relevance_score,
    thumbnail_url:    v.thumbnail,
    duration_seconds: Math.round(v.duration),
    status:           'pending',
  }));

  const { data, error } = await supabase
    .from('tiktok_videos')
    .upsert(rows, { onConflict: 'tiktok_video_id', ignoreDuplicates: false })
    .select('id');

  if (error) throw error;
  return (data ?? []).map((r: any) => r.id);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      'product-id': { type: 'string' },
      'query':      { type: 'string' },
      'max':        { type: 'string' },
      'language':   { type: 'string' },  // 'en' para filtrar só inglês
      'dry-run':    { type: 'boolean' },
    },
  });

  const productId = values['product-id'];
  const queryRaw  = values['query'];
  const max       = parseInt(values['max'] ?? '20', 10);
  const language  = values['language'];
  const dryRun    = values['dry-run'] ?? false;

  if (!productId) throw new Error('--product-id é obrigatório');
  if (!queryRaw)  throw new Error('--query é obrigatório');

  const apifyToken = process.env.APIFY_TOKEN ?? '';
  if (!apifyToken) throw new Error('APIFY_TOKEN não configurado no .env');

  const niche = await resolveProductNiche(productId);
  console.log(`[scrape-ugc] Produto: ${productId}`);
  console.log(`[scrape-ugc] Nicho: "${niche}"`);

  const raw    = await fetchTikTokVideos(queryRaw, Math.min(max, 100), apifyToken, language);
  const scored = scoreVideos(raw, niche);

  scored.sort((a, b) => b.relevance_score - a.relevance_score);

  if (dryRun) {
    console.log('\n[DRY-RUN] Resultado (não salvo):');
    console.log(JSON.stringify(scored, null, 2));
    return;
  }

  if (scored.length === 0) {
    console.log('[scrape-ugc] Nenhum vídeo para salvar.');
    return;
  }

  const ids = await saveToDatabase(productId, scored);
  console.log(`[scrape-ugc] ${ids.length} vídeos salvos/atualizados:`);
  ids.forEach(id => console.log(' ', id));
}

main().catch(err => {
  console.error('[scrape-ugc] ERRO FATAL:', err.message);
  process.exit(1);
});
