/**
 * scripts/video/analyze-ugc.ts
 * Analisa vídeos TikTok aprovados com Gemini e salva os insights
 * como artefatos ugc_reference em product_knowledge (enfileira embedding).
 *
 * Modo preferencial: baixa o vídeo via yt-dlp → sobe para Gemini Files API →
 * análise completa (Gemini "assiste" o vídeo com áudio e frames sequenciais).
 * Fallback: se o download/upload falhar, analisa apenas a thumbnail.
 *
 * Uso:
 *   npx tsx scripts/video/analyze-ugc.ts \
 *     --product-id <uuid>         # obrigatório
 *     [--video-id  <uuid>]        # UUID interno (tiktok_videos.id) — analisa só este
 *     [--force]                   # re-analisa mesmo se já existir ugc_reference
 *     [--thumbnail-only]          # força modo thumbnail (sem download)
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import { spawn } from 'node:child_process';
import { parseArgs } from 'node:util';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { GoogleAIFileManager, FileState } from '@google/generative-ai/server';
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

type AnalysisMode = 'video' | 'thumbnail'

// ── Prompts ────────────────────────────────────────────────────────────────────

const VIDEO_PROMPT = `Você é um analista especializado em marketing direct response e UGC (User Generated Content) para anúncios digitais.
Assista ao vídeo TikTok completo abaixo e extraia insights estratégicos detalhados para criação de anúncios.
Preste atenção especial aos primeiros 3 segundos (hook), à copy falada, ao CTA e ao ritmo de edição.

Retorne SOMENTE um objeto JSON válido, sem markdown, sem texto fora do JSON:

{
  "hook_type": "<problem|transformation|curiosity|social_proof|authority|lifestyle|entertainment>",
  "hook_text": "<transcrição exata ou aproximada do que é dito/mostrado nos primeiros 3 segundos>",
  "visual_style": "<ugc_raw|testimonial|lifestyle|talking_head|broll|text_overlay|mixed>",
  "narrative_angle": "<o problema ou desejo central abordado no vídeo>",
  "tone": "<energetic|calm|emotional|authoritative|humorous|urgent|inspirational>",
  "setting": "<kitchen|gym|bedroom|outdoors|office|studio|street|neutral>",
  "key_visual_elements": ["<elemento visual marcante 1>", "<elemento visual marcante 2>"],
  "hook_structure": "<descrição de como os primeiros 3 segundos capturam atenção — o que é dito, mostrado, texto na tela>",
  "copy_spoken": "<resumo da copy falada ao longo do vídeo — principais frases e argumentos>",
  "cta_text": "<texto exato ou aproximado do CTA — o que o criador pede ao final>",
  "cta_style": "<implicit|explicit|soft|strong|none>",
  "editing_pace": "<slow|medium|fast|very_fast — estimativa de cortes por minuto>",
  "audio_energy": "<low|medium|high — energia da música de fundo e voz>",
  "target_avatar_signals": ["<sinal de quem é o público alvo 1>", "<sinal de quem é o público alvo 2>"],
  "engagement_interpretation": "<o que o nível de engajamento sugere sobre efetividade>",
  "angle_inspiration": "<ângulo de copy que este vídeo sugere para nossos anúncios>",
  "what_to_replicate": ["<elemento replicável 1>", "<elemento replicável 2>", "<elemento replicável 3>"],
  "what_to_avoid": ["<elemento problemático ou fraco, se houver>"]
}`;

const THUMBNAIL_PROMPT = `Você é um analista especializado em marketing direct response e UGC (User Generated Content) para anúncios digitais.
Analise o thumbnail e o contexto textual do vídeo TikTok abaixo e extraia insights estratégicos para criação de anúncios.
Nota: você está analisando apenas a thumbnail, não o vídeo completo — os campos de áudio e copy falada devem ser inferidos do contexto.

Retorne SOMENTE um objeto JSON válido, sem markdown, sem texto fora do JSON:

{
  "hook_type": "<problem|transformation|curiosity|social_proof|authority|lifestyle|entertainment>",
  "hook_text": null,
  "visual_style": "<ugc_raw|testimonial|lifestyle|talking_head|broll|text_overlay|mixed>",
  "narrative_angle": "<o problema ou desejo central abordado no vídeo>",
  "tone": "<energetic|calm|emotional|authoritative|humorous|urgent|inspirational>",
  "setting": "<kitchen|gym|bedroom|outdoors|office|studio|street|neutral>",
  "key_visual_elements": ["<elemento visual marcante 1>", "<elemento visual marcante 2>"],
  "hook_structure": "<como a thumbnail sugere que o vídeo captura atenção>",
  "copy_spoken": null,
  "cta_text": null,
  "cta_style": "<implicit|explicit|soft|strong|none>",
  "editing_pace": null,
  "audio_energy": null,
  "target_avatar_signals": ["<sinal de quem é o público alvo 1>", "<sinal de quem é o público alvo 2>"],
  "engagement_interpretation": "<o que o nível de engajamento sugere sobre efetividade>",
  "angle_inspiration": "<ângulo de copy que este vídeo sugere para nossos anúncios>",
  "what_to_replicate": ["<elemento replicável 1>", "<elemento replicável 2>"],
  "what_to_avoid": ["<elemento problemático ou fraco, se houver>"]
}`;

// ── Download via yt-dlp ────────────────────────────────────────────────────────

function downloadVideo(tiktokUrl: string, outPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn('python', [
      '-m', 'yt_dlp',
      '--no-playlist', '-q',
      '-f', 'b',          // melhor formato com vídeo+áudio
      '-o', outPath,
      tiktokUrl,
    ], { timeout: 120_000 });

    child.on('close', code => {
      if (code === 0) resolve();
      else reject(new Error(`yt-dlp saiu com código ${code}`));
    });
    child.on('error', reject);
  });
}

// ── Gemini Files API ───────────────────────────────────────────────────────────

async function uploadVideoToGemini(
  filePath: string,
  fileManager: GoogleAIFileManager,
): Promise<string> {
  console.log('    [Files API] Fazendo upload…');
  const uploadResult = await fileManager.uploadFile(filePath, {
    mimeType:    'video/mp4',
    displayName: path.basename(filePath),
  });

  let file = await fileManager.getFile(uploadResult.file.name);
  while (file.state === FileState.PROCESSING) {
    await sleep(3_000);
    file = await fileManager.getFile(uploadResult.file.name);
  }

  if (file.state === FileState.FAILED) {
    await fileManager.deleteFile(uploadResult.file.name).catch(() => {});
    throw new Error('Gemini Files API: processamento do vídeo falhou');
  }

  console.log(`    [Files API] Pronto: ${file.uri}`);
  return file.uri;
}

// ── Análise ────────────────────────────────────────────────────────────────────

function buildContext(video: TikTokVideoRow, niche: string): string {
  return [
    `Nicho: ${niche}`,
    `Autor: @${video.author_handle ?? 'desconhecido'}`,
    `Descrição/Caption: ${video.description ?? '(sem descrição)'}`,
    `Visualizações: ${video.views_count?.toLocaleString('pt-BR') ?? '—'}`,
    `Likes: ${video.likes_count?.toLocaleString('pt-BR') ?? '—'}`,
    `Duração: ${video.duration_seconds ?? '—'}s`,
    `Score de relevância: ${video.relevance_score != null ? `${Math.round(video.relevance_score * 100)}%` : '—'}`,
  ].join('\n');
}

function parseGeminiJson(text: string): Record<string, unknown> {
  const clean = text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();
  return JSON.parse(clean);
}

async function analyzeWithVideo(
  video: TikTokVideoRow,
  niche: string,
  genAI: GoogleGenerativeAI,
  fileManager: GoogleAIFileManager,
): Promise<{ insights: Record<string, unknown>; mode: AnalysisMode } | null> {
  const tmpPath = path.join(os.tmpdir(), `ugc_${video.id}_${Date.now()}.mp4`);

  try {
    // 1. Download
    console.log('    [yt-dlp] Baixando vídeo…');
    await downloadVideo(video.tiktok_url, tmpPath);
    console.log('    [yt-dlp] Download concluído.');

    // 2. Upload para Gemini Files API
    const fileUri = await uploadVideoToGemini(tmpPath, fileManager);

    // 3. Análise com vídeo completo
    const model   = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    const context = buildContext(video, niche);

    const result = await model.generateContent([
      { fileData: { fileUri, mimeType: 'video/mp4' } },
      { text: `${context}\n\n${VIDEO_PROMPT}` },
    ]);

    const insights = parseGeminiJson(result.response.text().trim());
    return { insights, mode: 'video' };

  } catch (err: any) {
    console.warn(`    [video] Falha (${err.message}) — tentando fallback thumbnail…`);
    return null;
  } finally {
    // Limpa arquivo temp independente de sucesso/falha
    await fs.unlink(tmpPath).catch(() => {});
  }
}

async function analyzeWithThumbnail(
  video: TikTokVideoRow,
  niche: string,
  genAI: GoogleGenerativeAI,
): Promise<{ insights: Record<string, unknown>; mode: AnalysisMode } | null> {
  if (!video.thumbnail_url) {
    console.warn('    [thumbnail] Sem thumbnail_url — impossível analisar.');
    return null;
  }

  try {
    const res = await fetch(video.thumbnail_url, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const contentType = res.headers.get('content-type') ?? 'image/jpeg';
    const mimeType    = contentType.split(';')[0].trim();
    const data        = Buffer.from(await res.arrayBuffer()).toString('base64');

    const model   = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    const context = buildContext(video, niche);

    const result = await model.generateContent([
      { inlineData: { data, mimeType } },
      { text: `${context}\n\n${THUMBNAIL_PROMPT}` },
    ]);

    const insights = parseGeminiJson(result.response.text().trim());
    return { insights, mode: 'thumbnail' };

  } catch (err: any) {
    console.error(`    [thumbnail] Erro: ${err.message}`);
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

// ── Utils ──────────────────────────────────────────────────────────────────────

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      'product-id':     { type: 'string'  },
      'video-id':       { type: 'string'  },
      'force':          { type: 'boolean' },
      'thumbnail-only': { type: 'boolean' },
    },
  });

  const productId     = values['product-id'];
  const videoId       = values['video-id'];
  const force         = values['force']          ?? false;
  const thumbnailOnly = values['thumbnail-only'] ?? false;

  if (!productId) throw new Error('--product-id é obrigatório');

  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) throw new Error('GEMINI_API_KEY não configurado no .env');

  const genAI       = new GoogleGenerativeAI(geminiKey);
  const fileManager = new GoogleAIFileManager(geminiKey);

  const { niche, name } = await getProductInfo(productId);
  console.log(`[analyze-ugc] Produto: "${name}" | Nicho: "${niche}"`);
  console.log(`[analyze-ugc] Modo: ${thumbnailOnly ? 'thumbnail-only' : 'vídeo completo (fallback: thumbnail)'}`);

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

    console.log(`  [analyze] ${video.id} @${video.author_handle ?? '?'} (${video.duration_seconds ?? '?'}s)…`);

    let result: { insights: Record<string, unknown>; mode: AnalysisMode } | null = null;

    if (!thumbnailOnly) {
      result = await analyzeWithVideo(video, niche, genAI, fileManager);
    }

    if (!result) {
      result = await analyzeWithThumbnail(video, niche, genAI);
    }

    if (!result) {
      console.log(`  [error] Falha total na análise — pulando vídeo.`);
      failed++;
      continue;
    }

    console.log(`  [mode] Análise via: ${result.mode}`);

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
        analysis_mode:      result.mode,
        insights:           result.insights,
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
