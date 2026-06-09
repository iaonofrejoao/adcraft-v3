/**
 * scripts/video/analyze-ugc.ts
 * Analisa vídeos TikTok aprovados com Gemini Vision e salva os insights
 * como artefatos ugc_reference em product_knowledge (enfileira embedding).
 *
 * Uso:
 *   npx tsx scripts/video/analyze-ugc.ts \
 *     --product-id <uuid>         # obrigatório
 *     [--video-id  <uuid>]        # UUID interno (tiktok_videos.id) — analisa só este
 *     [--force]                   # re-analisa mesmo se já existir ugc_reference
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import { parseArgs } from 'node:util';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { supabase } from '../../workers/lib/db';
import { saveUgcReference } from '../../workers/lib/knowledge';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// ── Types ──────────────────────────────────────────────────────────────────────

interface TikTokVideoRow {
  id:               string
  tiktok_video_id:  string | null
  tiktok_url:       string
  author_handle:    string | null
  description:      string | null
  views_count:      number | null
  likes_count:      number | null
  duration_seconds: number | null
  relevance_score:  number | null
  thumbnail_url:    string | null
}

// ── Helpers ────────────────────────────────────────────────────────────────────

async function fetchImageAsBase64(url: string): Promise<{ data: string; mimeType: string } | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return null;
    const contentType = res.headers.get('content-type') ?? 'image/jpeg';
    const mimeType = contentType.split(';')[0].trim();
    const buffer = await res.arrayBuffer();
    return { data: Buffer.from(buffer).toString('base64'), mimeType };
  } catch {
    return null;
  }
}

const ANALYSIS_PROMPT = `Você é um analista especializado em marketing direct response e UGC (User Generated Content) para anúncios digitais.
Analise o thumbnail e o contexto do vídeo TikTok abaixo e extraia insights estratégicos para criação de anúncios.

Retorne SOMENTE um objeto JSON válido, sem markdown, sem texto fora do JSON:

{
  "hook_type": "<problem|transformation|curiosity|social_proof|authority|lifestyle|entertainment>",
  "visual_style": "<ugc_raw|testimonial|lifestyle|talking_head|broll|text_overlay|mixed>",
  "narrative_angle": "<string: o problema ou desejo central abordado no vídeo>",
  "tone": "<energetic|calm|emotional|authoritative|humorous|urgent|inspirational>",
  "setting": "<kitchen|gym|bedroom|outdoors|office|studio|street|neutral>",
  "key_visual_elements": ["<elemento 1>", "<elemento 2>"],
  "hook_structure": "<como os primeiros segundos capturam atenção>",
  "cta_style": "<implicit|explicit|soft|strong|none>",
  "target_avatar_signals": ["<sinal de avatar 1>", "<sinal de avatar 2>"],
  "engagement_interpretation": "<o que o nível de engajamento sugere sobre efetividade>",
  "angle_inspiration": "<ângulo de copy que este vídeo sugere para nossos anúncios>",
  "what_to_replicate": ["<elemento replicável 1>", "<elemento replicável 2>"],
  "what_to_avoid": ["<elemento problemático ou fraco, se houver>"]
}`;

// ── Core ───────────────────────────────────────────────────────────────────────

async function analyzeVideo(
  video: TikTokVideoRow,
  niche: string,
  genAI: GoogleGenerativeAI,
): Promise<Record<string, unknown> | null> {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

  const context = [
    `Nicho: ${niche}`,
    `Autor: @${video.author_handle ?? 'desconhecido'}`,
    `Descrição/Caption: ${video.description ?? '(sem descrição)'}`,
    `Visualizações: ${video.views_count?.toLocaleString('pt-BR') ?? '—'}`,
    `Likes: ${video.likes_count?.toLocaleString('pt-BR') ?? '—'}`,
    `Duração: ${video.duration_seconds ?? '—'}s`,
    `Score de relevância calculado: ${video.relevance_score != null ? `${Math.round(video.relevance_score * 100)}%` : '—'}`,
  ].join('\n');

  const parts: any[] = [];

  if (video.thumbnail_url) {
    const img = await fetchImageAsBase64(video.thumbnail_url);
    if (img) parts.push({ inlineData: img });
  }

  parts.push({ text: `${context}\n\n${ANALYSIS_PROMPT}` });

  try {
    const result = await model.generateContent(parts);
    const text   = result.response.text().trim();
    const clean  = text
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i,    '')
      .replace(/\s*```$/,     '')
      .trim();
    return JSON.parse(clean);
  } catch (err: any) {
    console.error(`  [analyze] Erro ao parsear resposta do Gemini: ${err.message}`);
    return null;
  }
}

// ── DB helpers ─────────────────────────────────────────────────────────────────

async function getProductInfo(productId: string): Promise<{ niche: string; name: string }> {
  const { data, error } = await supabase
    .from('products')
    .select('name, niches(name)')
    .eq('id', productId)
    .maybeSingle();

  if (error) throw error;
  if (!data)  throw new Error(`Produto ${productId} não encontrado.`);

  const nicheName = (data.niches as any)?.name ?? '';
  return { niche: `${data.name} ${nicheName}`.trim(), name: data.name };
}

async function getApprovedVideos(productId: string, videoId?: string): Promise<TikTokVideoRow[]> {
  let query = supabase
    .from('tiktok_videos')
    .select('id, tiktok_video_id, tiktok_url, author_handle, description, views_count, likes_count, duration_seconds, relevance_score, thumbnail_url')
    .eq('product_id', productId)
    .eq('status', 'approved')
    .order('relevance_score', { ascending: false, nullsFirst: false });

  if (videoId) query = (query as any).eq('id', videoId);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as TikTokVideoRow[];
}

async function isAlreadyAnalyzed(productId: string, videoDbId: string): Promise<boolean> {
  const { data } = await supabase
    .from('product_knowledge')
    .select('id')
    .eq('product_id', productId)
    .eq('artifact_type', 'ugc_reference')
    .eq('status', 'fresh')
    .filter('artifact_data->>tiktok_video_db_id', 'eq', videoDbId)
    .maybeSingle();
  return data != null;
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      'product-id': { type: 'string' },
      'video-id':   { type: 'string' },
      'force':      { type: 'boolean' },
    },
  });

  const productId = values['product-id'];
  const videoId   = values['video-id'];
  const force     = values['force'] ?? false;

  if (!productId) throw new Error('--product-id é obrigatório');

  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) throw new Error('GEMINI_API_KEY não configurado no .env');

  const genAI = new GoogleGenerativeAI(geminiKey);
  const { niche, name } = await getProductInfo(productId);

  console.log(`[analyze-ugc] Produto: "${name}" | Nicho: "${niche}"`);

  const videos = await getApprovedVideos(productId, videoId);
  console.log(`[analyze-ugc] ${videos.length} vídeo(s) aprovado(s) para analisar.`);

  if (videos.length === 0) {
    console.log('[analyze-ugc] Nada a analisar.');
    return;
  }

  let saved   = 0;
  let skipped = 0;
  let failed  = 0;

  for (const video of videos) {
    if (!force && await isAlreadyAnalyzed(productId, video.id)) {
      console.log(`  [skip] ${video.id} — já possui ugc_reference.`);
      skipped++;
      continue;
    }

    console.log(`  [analyze] ${video.id} @${video.author_handle ?? '?'} (${video.duration_seconds ?? '?'}s, ${Math.round((video.relevance_score ?? 0) * 100)}% relevância)…`);

    const insights = await analyzeVideo(video, niche, genAI);

    if (!insights) {
      console.log(`  [error] Falha ao analisar vídeo — pulando.`);
      failed++;
      continue;
    }

    const artifactId = await saveUgcReference({
      product_id:         productId,
      tiktok_video_db_id: video.id,
      artifact_data: {
        tiktok_video_db_id: video.id,
        tiktok_video_id:    video.tiktok_video_id,
        tiktok_url:         video.tiktok_url,
        author_handle:      video.author_handle,
        description:        video.description,
        views_count:        video.views_count,
        likes_count:        video.likes_count,
        duration_seconds:   video.duration_seconds,
        relevance_score:    video.relevance_score,
        thumbnail_url:      video.thumbnail_url,
        insights,
      },
    });

    console.log(`  [saved] artifact_id: ${artifactId}`);
    saved++;
  }

  console.log(`\n[analyze-ugc] Concluído: ${saved} analisado(s), ${skipped} pulado(s), ${failed} falha(s).`);
}

main().catch(err => {
  console.error('[analyze-ugc] ERRO FATAL:', err.message);
  process.exit(1);
});
