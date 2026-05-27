/**
 * scripts/video/scrape-ugc.ts
 * Busca vídeos TikTok por hashtag/palavra-chave de um produto e pontua relevância via Gemini Vision.
 *
 * Uso:
 *   npx tsx scripts/video/scrape-ugc.ts \
 *     --product-id <uuid>         \   # produto cujo nicho define os termos de busca
 *     --query     "nicho produto" \   # termo de busca (hashtag ou keyword)
 *     --max        20             \   # máximo de vídeos a coletar (default: 20)
 *     [--dry-run]                     # não salva no banco, apenas exibe o resultado
 *
 * Dependências externas:
 *   - yt-dlp instalado no PATH  (pip install yt-dlp)
 *   - GEMINI_API_KEY no .env
 *   - DATABASE_URL / SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY no .env
 *
 * Saída: lista de IDs dos vídeos inseridos (ou DRY-RUN: JSON dos vídeos encontrados)
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { parseArgs } from 'node:util';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { supabase } from '../../workers/lib/db';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const execFileAsync = promisify(execFile);

// ── Types ─────────────────────────────────────────────────────────────────────

interface YtDlpVideo {
  id:          string
  webpage_url: string
  uploader:    string    // handle do autor (@xxx)
  description: string
  view_count:  number
  like_count:  number
  duration:    number    // segundos
  thumbnail:   string    // URL da thumbnail
}

interface ScoredVideo extends YtDlpVideo {
  relevance_score: number
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function fetchTikTokVideos(query: string, max: number): Promise<YtDlpVideo[]> {
  console.log(`[yt-dlp] Buscando "${query}" (máx. ${max} vídeos)…`);

  // yt-dlp suporta busca no TikTok via "tiktoksearch:" ou "ytsearch:" como fallback
  const searchUrl = `tiktoksearch${max}:${query}`;

  const args = [
    searchUrl,
    '--dump-json',
    '--no-playlist',
    '--no-warnings',
    '--quiet',
    '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    '--sleep-requests', '2',  // 2s entre requests para não ser bloqueado
    '--max-sleep-interval', '5',
  ];

  let stdout = '';
  try {
    const result = await execFileAsync('yt-dlp', args, {
      maxBuffer: 50 * 1024 * 1024, // 50MB
      timeout: 120_000,            // 2 minutos
    });
    stdout = result.stdout;
  } catch (err: any) {
    // yt-dlp retorna exit code != 0 em alguns vídeos privados; continuar com o que tiver
    stdout = err.stdout ?? '';
    if (!stdout.trim()) {
      console.warn('[yt-dlp] Nenhum resultado ou erro fatal:', err.message);
      return [];
    }
  }

  const videos: YtDlpVideo[] = [];
  for (const line of stdout.split('\n')) {
    if (!line.trim()) continue;
    try {
      const raw = JSON.parse(line);
      videos.push({
        id:          raw.id ?? raw.display_id,
        webpage_url: raw.webpage_url,
        uploader:    raw.uploader ?? raw.channel ?? raw.uploader_id ?? 'unknown',
        description: raw.description ?? '',
        view_count:  raw.view_count  ?? 0,
        like_count:  raw.like_count  ?? 0,
        duration:    raw.duration    ?? 0,
        thumbnail:   raw.thumbnail   ?? '',
      });
    } catch {
      // linha malformada — ignorar
    }
  }

  console.log(`[yt-dlp] ${videos.length} vídeos encontrados.`);
  return videos;
}

async function scoreVideos(
  videos: YtDlpVideo[],
  productNiche: string,
  apiKey: string,
): Promise<ScoredVideo[]> {
  if (!apiKey) {
    console.warn('[Gemini] GEMINI_API_KEY não configurada — relevance_score será null.');
    return videos.map(v => ({ ...v, relevance_score: 0.5 }));
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

  const scored: ScoredVideo[] = [];

  for (const video of videos) {
    // Delay entre chamadas para respeitar rate limits
    await new Promise(r => setTimeout(r, 500));

    const prompt = `
Você é um especialista em marketing de performance para tráfego pago.

Avalie a relevância deste vídeo TikTok para o nicho "${productNiche}".
Retorne APENAS um número decimal entre 0.00 e 1.00.

Critérios:
- 0.90–1.00: Vídeo perfeito — pessoa usando/mostrando produto do nicho, linguagem natural, alta energia
- 0.60–0.89: Vídeo bom — relacionado ao nicho mas não demonstra o produto diretamente
- 0.30–0.59: Parcialmente relevante — tema adjacente ao nicho
- 0.00–0.29: Irrelevante para o nicho

Dados do vídeo:
- Descrição: "${video.description.slice(0, 300)}"
- Autor: ${video.uploader}
- Views: ${video.view_count}
- Likes: ${video.like_count}
- Duração: ${video.duration}s

Responda APENAS com o número (ex: 0.75).
`.trim();

    try {
      const result = await model.generateContent(prompt);
      const text   = result.response.text().trim();
      const score  = parseFloat(text);
      const safeScore = isNaN(score) ? 0.5 : Math.max(0, Math.min(1, score));
      scored.push({ ...video, relevance_score: Math.round(safeScore * 100) / 100 });
    } catch (err) {
      console.warn(`[Gemini] Erro ao pontuar vídeo ${video.id}:`, (err as Error).message);
      scored.push({ ...video, relevance_score: 0.5 });
    }
  }

  return scored;
}

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

async function saveToDatabase(
  productId: string,
  videos: ScoredVideo[],
): Promise<string[]> {
  const rows = videos.map(v => ({
    product_id:      productId,
    tiktok_url:      v.webpage_url,
    tiktok_video_id: v.id,
    author_handle:   v.uploader.replace(/^@/, ''),
    description:     v.description.slice(0, 1000),
    views_count:     v.view_count,
    likes_count:     v.like_count,
    relevance_score: v.relevance_score,
    thumbnail_url:   v.thumbnail,
    duration_seconds: Math.round(v.duration),
    status:          'pending',
  }));

  // Usa upsert por tiktok_video_id para evitar duplicatas em re-execuções
  const { data, error } = await supabase
    .from('tiktok_videos')
    .upsert(rows, {
      onConflict: 'tiktok_video_id',
      ignoreDuplicates: false,
    })
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
      'dry-run':    { type: 'boolean' },
    },
  });

  const productId = values['product-id'];
  const queryRaw  = values['query'];
  const max       = parseInt(values['max'] ?? '20', 10);
  const dryRun    = values['dry-run'] ?? false;

  if (!productId) throw new Error('--product-id é obrigatório');
  if (!queryRaw)  throw new Error('--query é obrigatório');

  const geminiKey  = process.env.GEMINI_API_KEY ?? '';
  const niche      = await resolveProductNiche(productId);
  const searchTerm = queryRaw || niche;

  console.log(`[scrape-ugc] Produto: ${productId}`);
  console.log(`[scrape-ugc] Nicho resolvido: "${niche}"`);
  console.log(`[scrape-ugc] Termo de busca: "${searchTerm}"`);

  const raw     = await fetchTikTokVideos(searchTerm, Math.min(max, 50));
  const scored  = await scoreVideos(raw, niche, geminiKey);

  // Ordena por score decrescente
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
  console.log(`[scrape-ugc] ${ids.length} vídeos salvos/atualizados no banco:`);
  ids.forEach(id => console.log(' ', id));
}

main().catch(err => {
  console.error('[scrape-ugc] ERRO FATAL:', err.message);
  process.exit(1);
});
