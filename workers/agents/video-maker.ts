import { eq, and } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { db } from '../lib/db';
import {
    pipelines,
    products,
    copyCombinations,
    copyComponents,
    approvals,
} from '../../frontend/lib/schema/index';
import { callAgent, parseAgentOutput } from '../lib/llm/gemini-client';
import { saveArtifact } from '../lib/knowledge';
import { generateVideoClip, type AspectRatioVeo } from '../lib/veo3-client';
import {
    renderFinalCreative,
    generateSrt,
    validateVideoQuality,
} from '../lib/ffmpeg/index';
import { uploadToR2 } from '../lib/r2';
import { type TaskRow } from '../task-runner';

// ── Cap econômico ────────────────────────────────────────────────────────────
// Cada vídeo VEO 3 custa ~$5,50. Acima de 5 vídeos por execução exige confirmação explícita.
const MAX_VIDEOS_PER_RUN = 5;
const COST_PER_VIDEO_USD = 5.5;

// ── Tipos do storyboard ───────────────────────────────────────────────────────

interface StoryboardScene {
    scene_number:    number;
    duration_seconds: number;
    section:         'hook' | 'body' | 'cta';
    veo3_prompt:     string;
    subtitle_text:   string;
    visual_notes?:   string;
}

interface Storyboard {
    storyboard_tag:          string;
    total_duration_seconds:  number;
    aspect_ratio:            string;
    style:                   string;
    narration_script:        string;
    scenes:                  StoryboardScene[];
    audio_config: {
        needs_narration:          boolean;
        narration_tone:           string;
        background_music_style:   string;
        background_music_volume:  number;
    };
    quality_checklist?: Record<string, boolean>;
}

// ── Agente principal ──────────────────────────────────────────────────────────

/**
 * Agente 4.3 — Video Maker
 *
 * Fluxo:
 *  1. Busca pipeline + produto
 *  2. Carrega copy_combinations com selected_for_video = true
 *  3. Para cada combinação selecionada:
 *     a. Chama LLM para gerar storyboard (script + prompts VEO 3)
 *     b. Chama VEO 3 para cada cena → Buffer de clipes MP4
 *     c. FFmpeg: concatena + SRT + exporta no aspect_ratio
 *     d. Faz upload para R2
 *     e. Registra em product_knowledge como 'video_assets'
 */
export async function runVideoMaker(task: TaskRow): Promise<Record<string, unknown>> {
    const pipelineId = task.pipeline_id;
    if (!pipelineId) throw new Error('pipeline_id é obrigatório para video_maker');

    // ── 1. Meta-dados ─────────────────────────────────────────────────────────
    const pipeline = await (db.query as any).pipelines.findFirst({
        where: eq(pipelines.id, pipelineId),
    });
    if (!pipeline) throw new Error(`Pipeline ${pipelineId} não encontrado`);

    const product = await (db.query as any).products.findFirst({
        where: eq(products.id, pipeline.product_id as string),
    });
    if (!product) throw new Error(`Produto ${pipeline.product_id} não encontrado`);

    // ── 2. Combinações selecionadas para vídeo ────────────────────────────────
    const combinations = await (db.query as any).copyCombinations.findMany({
        where: and(
            eq(copyCombinations.product_id, product.id as string),
            eq(copyCombinations.selected_for_video, true),
        ),
    });

    if (combinations.length === 0) {
        return {
            status: 'skipped',
            reason: 'Nenhuma copy_combination com selected_for_video=true encontrada.',
        };
    }

    // ── Cap econômico: máximo de 5 vídeos por execução sem confirmação ────────
    if (combinations.length > MAX_VIDEOS_PER_RUN && !task.confirmed_oversized) {
        const estimatedCost = Number((combinations.length * COST_PER_VIDEO_USD).toFixed(2));

        await db.insert(approvals).values({
            id:            randomUUID(),
            pipeline_id:   pipelineId,
            task_id:       task.id,
            approval_type: 'video_cap_exceeded',
            payload: {
                requested:          combinations.length,
                cap:                MAX_VIDEOS_PER_RUN,
                estimated_cost_usd: estimatedCost,
            },
            status: 'pending',
        });

        await db
            .update(pipelines)
            .set({ status: 'paused' })
            .where(eq(pipelines.id, pipelineId));

        console.warn(
            `[video-maker] cap excedido: ${combinations.length} combinações > ${MAX_VIDEOS_PER_RUN}. Pipeline pausado para aprovação.`,
        );

        return { status: 'awaiting_approval', reason: 'video_cap_exceeded' };
    }

    const videoAssets: Record<string, unknown>[] = [];

    for (const combo of combinations) {
        const asset = await processCombination({
            combination: combo,
            product,
            pipeline,
            pipelineId,
        });
        videoAssets.push(asset);
    }

    // ── 5. Registra todos os assets em product_knowledge ──────────────────────
    const output = {
        combination_count: combinations.length,
        video_assets:      videoAssets,
    };

    await saveArtifact({
        product_id:         product.id as string,
        product_version:    pipeline.product_version,
        artifact_type:      'video_assets',
        artifact_data:      output,
        source_pipeline_id: pipelineId,
        source_task_id:     task.id,
    });

    return output;
}

// ── Processamento por combinação ──────────────────────────────────────────────

async function processCombination(params: {
    combination: Record<string, unknown>;
    product:     Record<string, unknown>;
    pipeline:    Record<string, unknown>;
    pipelineId:  string;
}): Promise<Record<string, unknown>> {
    const { combination, product, pipeline, pipelineId } = params;

    // Busca textos dos componentes (hook, body, cta)
    const hookId  = combination.hook_id  as string | null;
    const bodyId  = combination.body_id  as string | null;
    const ctaId   = combination.cta_id   as string | null;

    const [hookComp, bodyComp, ctaComp] = await Promise.all([
        hookId  ? (db.query as any).copyComponents.findFirst({ where: eq(copyComponents.id, hookId)  }) : null,
        bodyId  ? (db.query as any).copyComponents.findFirst({ where: eq(copyComponents.id, bodyId)  }) : null,
        ctaId   ? (db.query as any).copyComponents.findFirst({ where: eq(copyComponents.id, ctaId)   }) : null,
    ]);

    const aspectRatio = (pipeline.state as any)?.video_aspect_ratio ?? '9:16';
    const totalDuration = (pipeline.state as any)?.video_duration_seconds ?? 30;

    // ── a. Gera storyboard via LLM ────────────────────────────────────────────
    const dynamicInput = JSON.stringify({
        combination: {
            tag:       combination.tag,
            hook_text: hookComp?.content ?? '',
            body_text: bodyComp?.content ?? '',
            cta_text:  ctaComp?.content  ?? '',
        },
        product: {
            name:          product.name,
            main_promise:  (product as any).main_promise ?? '',
            target_avatar: (product as any).target_avatar ?? '',
            niche:         (product as any).niche_id ?? '',
        },
        video_config: {
            aspect_ratio:            aspectRatio,
            total_duration_seconds:  totalDuration,
            style_references:        [],
        },
    });

    const llmResult = await callAgent({
        agent_name:    'video_maker',
        pipeline_id:   pipelineId,
        product_id:    product.id as string,
        niche_id:      product.niche_id as string | undefined,
        dynamic_input: dynamicInput,
    });

    const storyboard = parseAgentOutput(llmResult, 'video_maker') as unknown as Storyboard;

    // ── b. Gera clipes VEO 3 para cada cena ──────────────────────────────────
    const clipBuffers: Buffer[] = [];

    for (const scene of storyboard.scenes) {
        const clip = await generateVideoClip(scene.veo3_prompt, {
            durationSeconds: scene.duration_seconds,
            aspectRatio:     storyboard.aspect_ratio as AspectRatioVeo,
            generateAudio:   false,
        });

        clipBuffers.push(clip.videoBuffer);
    }

    // ── c. FFmpeg: monta o vídeo final ────────────────────────────────────────
    // Converte Buffers em URLs de data (base64) para o renderFinalCreative,
    // que espera URLs. Alternativa: salvar temporariamente — usamos URLs de blobs
    // internamente passando via array de buffers diretamente.

    const srtContent = storyboard.narration_script
        ? generateSrt(storyboard.narration_script, storyboard.total_duration_seconds)
        : undefined;

    const finalMp4Buffer = await renderFinalCreativeFromBuffers({
        clipBuffers,
        aspectRatio:  storyboard.aspect_ratio,
        subtitlesSrt: srtContent,
    });

    // ── d. Valida qualidade e faz upload no R2 ────────────────────────────────
    const tag    = `${combination.tag as string}_VID`;
    const r2Key  = `videos/${product.id}/${tag}.mp4`;
    const r2Url  = await uploadToR2(finalMp4Buffer, 'video/mp4', r2Key);

    const validationResult = await validateVideoQualityFromBuffer(finalMp4Buffer);

    console.info(`[video-maker] upload concluído: ${r2Url} — valid=${validationResult.valid}`);

    if (!validationResult.valid) {
        console.warn(
            `[video-maker] vídeo com issues: ${validationResult.issues.join('; ')}`,
        );
    }

    return {
        tag,
        combination_tag:  combination.tag,
        r2_url:           r2Url,
        storyboard_tag:   storyboard.storyboard_tag,
        aspect_ratio:     storyboard.aspect_ratio,
        duration_seconds: storyboard.total_duration_seconds,
        scene_count:      storyboard.scenes.length,
        validation:       validationResult,
        llm_cost_usd:     llmResult.cost_usd,
    };
}

// ── Helpers de renderização com Buffer ───────────────────────────────────────

import * as fs   from 'fs';
import * as os   from 'os';
import * as path from 'path';

/**
 * Versão de renderFinalCreative que aceita Buffers de clipes em vez de URLs.
 * Salva os clipes em disco temporário e chama renderFinalCreative.
 */
async function renderFinalCreativeFromBuffers(opts: {
    clipBuffers:   Buffer[];
    aspectRatio:   string;
    subtitlesSrt?: string;
}): Promise<Buffer> {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'adcraft_veo_'));

    try {
        // Salva cada clipe em disco temporário
        const clipUrls: string[] = [];
        for (let i = 0; i < opts.clipBuffers.length; i++) {
            const clipPath = path.join(dir, `clip_${String(i).padStart(3, '0')}.mp4`);
            fs.writeFileSync(clipPath, opts.clipBuffers[i]);
            // renderFinalCreative aceita URLs — usando file:// para paths locais
            clipUrls.push(`file://${clipPath.replace(/\\/g, '/')}`);
        }

        return await renderFinalCreative({
            videoClips:   clipUrls,
            aspectRatio:  opts.aspectRatio,
            subtitlesSrt: opts.subtitlesSrt,
        });
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
}

/**
 * Valida qualidade de um vídeo a partir de Buffer (salva temporariamente).
 */
async function validateVideoQualityFromBuffer(buffer: Buffer) {
    const tmpFile = path.join(os.tmpdir(), `adcraft_validate_${randomUUID()}.mp4`);
    fs.writeFileSync(tmpFile, buffer);
    try {
        return await validateVideoQuality(tmpFile);
    } finally {
        fs.rmSync(tmpFile, { force: true });
    }
}
