/**
 * scripts/video/generate-scenes.ts
 * Gera clips individuais por cena do storyboard de um final_video.
 *
 * Tipos de clip:
 *   persona → ElevenLabs TTS → upload Supabase → HeyGen lip sync → clip URL
 *   3d      → Kling text-to-video → clip URL  +  ElevenLabs VO → audio URL
 *   ugc     → tiktok_video aprovado → trim FFmpeg → upload Supabase → clip URL
 *
 * Uso:
 *   npx tsx scripts/video/generate-scenes.ts \
 *     --final-video-id <uuid> \
 *     [--dry-run]        # gera áudio ElevenLabs apenas, sem HeyGen/Kling
 *     [--skip-heygen]    # pula lip sync (testa ElevenLabs + Kling)
 *     [--skip-kling]     # pula cenas 3D
 *     [--scene <n>]      # regenera apenas a cena N
 *
 * Variáveis de ambiente:
 *   ELEVENLABS_API_KEY, HEYGEN_API_KEY, KLING_API_KEY (formato "ACCESS:SECRET")
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import * as dotenv  from 'dotenv'
import * as path    from 'path'
import * as fs      from 'node:fs/promises'
import * as os      from 'node:os'
import { createHmac }          from 'node:crypto'
import { spawn }               from 'node:child_process'
import { parseArgs }           from 'node:util'
import { supabase }            from '../../workers/lib/db'

dotenv.config({ path: path.resolve(__dirname, '../../.env') })

// ── Types ─────────────────────────────────────────────────────────────────────

type ClipType = 'persona' | '3d' | 'ugc'

interface VideoScene {
  scene_number:     number
  section:          string
  duration_seconds: number
  narration:        string
  veo3_prompt_en:   string
  subtitle_text:    string
  overlay_text:     string | null
  audio_cue:        string | null
}

interface VideoAssets {
  storyboard_tag:      string
  combination_used:    string
  total_duration_seconds: number
  aspect_ratio:        string
  audio_config: {
    narration_tone:            string
    background_music_style:    string
    background_music_volume:   number
  }
  scenes: VideoScene[]
}

interface GeneratedClip {
  scene_number:     number
  section:          string
  clip_type:        ClipType | '3d_fallback'
  clip_url:         string | null
  audio_url:        string | null
  vo_url:           string | null
  duration_seconds: number
  subtitle_text:    string
  overlay_text:     string | null
  audio_cue:        string | null
  tiktok_video_id?: string
}

interface CompositionConfig {
  clips:                GeneratedClip[]
  pacing_config: {
    cut_style:         string
    music_volume:      number
    narration_volume:  number
  }
  production_warnings: string[]
}

interface PersonaAssets {
  id:                  string
  heygen_avatar_id:    string
  elevenlabs_voice_id: string
  status:              string
}

interface TikTokVideo {
  id:               string
  local_path:       string | null
  tiktok_url:       string
  duration_seconds: number | null
  relevance_score:  number | null
}

// ── JWT para Kling ────────────────────────────────────────────────────────────

function generateKlingJWT(accessKey: string, secretKey: string): string {
  const now     = Math.floor(Date.now() / 1000)
  const header  = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
  const payload = Buffer.from(JSON.stringify({ iss: accessKey, exp: now + 1800, nbf: now - 5 })).toString('base64url')
  const sig     = createHmac('sha256', secretKey).update(`${header}.${payload}`).digest('base64url')
  return `${header}.${payload}.${sig}`
}

// ── ElevenLabs TTS ────────────────────────────────────────────────────────────

async function generateElevenLabsAudio(
  text:    string,
  voiceId: string,
  apiKey:  string,
): Promise<Buffer> {
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method:  'POST',
    headers: {
      'xi-api-key':   apiKey,
      'Content-Type': 'application/json',
      'Accept':       'audio/mpeg',
    },
    body: JSON.stringify({
      text,
      model_id:       'eleven_multilingual_v2',
      voice_settings: { stability: 0.5, similarity_boost: 0.75 },
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`ElevenLabs TTS error ${res.status}: ${text}`)
  }

  return Buffer.from(await res.arrayBuffer())
}

// ── Supabase Storage ──────────────────────────────────────────────────────────

async function uploadToStorage(
  bucketPath: string,
  data:       Buffer,
  mimeType:   string,
): Promise<string> {
  const { error } = await supabase.storage
    .from('video-clips')
    .upload(bucketPath, data, { contentType: mimeType, upsert: true })

  if (error) throw new Error(`Storage upload falhou (${bucketPath}): ${error.message}`)

  const { data: { publicUrl } } = supabase.storage
    .from('video-clips')
    .getPublicUrl(bucketPath)

  return publicUrl
}

// ── HeyGen Lip Sync ───────────────────────────────────────────────────────────

async function generateHeyGenClip(
  avatarId: string,
  audioUrl: string,
  apiKey:   string,
): Promise<string> {
  const createRes = await fetch('https://api.heygen.com/v2/video/generate', {
    method:  'POST',
    headers: { 'X-Api-Key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      video_inputs: [{
        character: { type: 'avatar', avatar_id: avatarId, avatar_style: 'normal' },
        voice:     { type: 'audio',  audio_url: audioUrl },
      }],
      dimension: { width: 608, height: 1080 },
    }),
  })

  if (!createRes.ok) {
    const t = await createRes.text()
    throw new Error(`HeyGen create video error ${createRes.status}: ${t}`)
  }

  const createData = await createRes.json() as { data?: { video_id?: string }; error?: string }
  if (createData.error) throw new Error(`HeyGen error: ${createData.error}`)
  const videoId = createData.data?.video_id
  if (!videoId) throw new Error('HeyGen não retornou video_id')

  console.log(`    [HeyGen] Vídeo submetido: ${videoId}. Aguardando…`)

  // Polling até completed ou timeout (10 min)
  const timeoutMs = 10 * 60 * 1000
  const startAt   = Date.now()
  while (Date.now() - startAt < timeoutMs) {
    await sleep(15_000)

    const pollRes  = await fetch(`https://api.heygen.com/v1/video_status.get?video_id=${videoId}`, {
      headers: { 'X-Api-Key': apiKey },
    })
    const pollData = await pollRes.json() as { data?: { status?: string; video_url?: string }; error?: string }
    const status   = pollData.data?.status

    console.log(`    [HeyGen] Status: ${status}`)
    if (status === 'completed') {
      const videoUrl = pollData.data?.video_url
      if (!videoUrl) throw new Error(`HeyGen completed mas sem video_url`)
      return videoUrl
    }
    if (status === 'failed') throw new Error(`HeyGen video processing failed: ${videoId}`)
  }

  throw new Error(`HeyGen timeout (10 min) para video_id ${videoId}`)
}

// ── Kling Text-to-Video ───────────────────────────────────────────────────────

async function generateKlingClip(
  prompt:          string,
  durationSeconds: number,
  jwt:             string,
): Promise<string> {
  const duration = durationSeconds <= 5 ? '5' : '10'

  const createRes = await fetch('https://api.klingai.com/v1/videos/text2video', {
    method:  'POST',
    headers: { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model:            'kling-v1',
      prompt,
      negative_prompt:  'blurry, distorted, text overlay, watermark, logo, low quality',
      cfg_scale:        0.5,
      mode:             'std',
      aspect_ratio:     '9:16',
      duration,
    }),
  })

  if (!createRes.ok) {
    const t = await createRes.text()
    throw new Error(`Kling create error ${createRes.status}: ${t}`)
  }

  const createData = await createRes.json() as { code: number; data?: { task_id?: string }; message?: string }
  if (createData.code !== 0) throw new Error(`Kling error: ${createData.message}`)
  const taskId = createData.data?.task_id
  if (!taskId) throw new Error('Kling não retornou task_id')

  console.log(`    [Kling] Task submetida: ${taskId}. Aguardando…`)

  // Polling até succeed ou timeout (15 min)
  const timeoutMs = 15 * 60 * 1000
  const startAt   = Date.now()
  while (Date.now() - startAt < timeoutMs) {
    await sleep(20_000)

    // JWT precisa ser renovado a cada polling (expira em 30min, mas renovar por segurança)
    const pollRes  = await fetch(`https://api.klingai.com/v1/videos/text2video/${taskId}`, {
      headers: { Authorization: `Bearer ${jwt}` },
    })
    const pollData = await pollRes.json() as {
      code: number
      data?: { task_status?: string; task_result?: { videos?: Array<{ url: string }> } }
      message?: string
    }

    if (pollData.code !== 0) throw new Error(`Kling poll error: ${pollData.message}`)
    const status = pollData.data?.task_status
    console.log(`    [Kling] Status: ${status}`)

    if (status === 'succeed') {
      const url = pollData.data?.task_result?.videos?.[0]?.url
      if (!url) throw new Error('Kling succeed mas sem video URL')
      return url
    }
    if (status === 'failed') throw new Error(`Kling task failed: ${taskId}`)
  }

  throw new Error(`Kling timeout (15 min) para task ${taskId}`)
}

// ── FFmpeg Trim de UGC ────────────────────────────────────────────────────────

async function trimUgcClip(
  inputPath:       string,
  durationSeconds: number,
  outputPath:      string,
): Promise<void> {
  await fs.mkdir(path.dirname(outputPath), { recursive: true })

  return new Promise((resolve, reject) => {
    const ffmpeg = spawn('ffmpeg', [
      '-y',
      '-i',  inputPath,
      '-t',  String(durationSeconds),
      '-vf', 'scale=608:1080:force_original_aspect_ratio=increase,crop=608:1080',
      '-c:v', 'libx264',
      '-c:a', 'aac',
      '-movflags', '+faststart',
      outputPath,
    ])

    ffmpeg.stderr.on('data', (d: Buffer) => process.stderr.write(d))
    ffmpeg.on('close', code => {
      if (code === 0) resolve()
      else reject(new Error(`FFmpeg saiu com código ${code}`))
    })
    ffmpeg.on('error', reject)
  })
}

// ── Database helpers ──────────────────────────────────────────────────────────

async function loadFinalVideo(finalVideoId: string): Promise<{
  id:                  string
  product_id:          string
  copy_combination_id: string
  status:              string
}> {
  const { data, error } = await supabase
    .from('final_videos')
    .select('id, product_id, copy_combination_id, status')
    .eq('id', finalVideoId)
    .single()

  if (error) throw error
  if (!data) throw new Error(`final_video ${finalVideoId} não encontrado`)
  return data as { id: string; product_id: string; copy_combination_id: string; status: string }
}

async function loadVideoAssets(productId: string, copyCombinationId: string): Promise<VideoAssets> {
  // Busca o artefato video_assets mais recente vinculado à combinação
  const { data, error } = await supabase
    .from('product_knowledge')
    .select('artifact_data')
    .eq('product_id', productId)
    .eq('artifact_type', 'video_assets')
    .eq('status', 'fresh')
    .order('created_at', { ascending: false })
    .limit(10)

  if (error) throw error

  // Filtra pelo copy_combination_id dentro do artifact_data
  const match = (data ?? []).find(
    (row: { artifact_data: VideoAssets }) => row.artifact_data?.combination_used === copyCombinationId
      || (row.artifact_data as unknown as { copy_combination_id?: string })?.copy_combination_id === copyCombinationId
  )

  if (!match) {
    throw new Error(
      `Artefato video_assets não encontrado para combinação ${copyCombinationId}. ` +
      `Execute o pipeline criativo (script-writer → keyframe-generator → video-maker) primeiro.`
    )
  }

  return match.artifact_data as VideoAssets
}

async function loadPersonaAssets(productId: string): Promise<PersonaAssets> {
  const { data, error } = await supabase
    .from('persona_assets')
    .select('id, heygen_avatar_id, elevenlabs_voice_id, status')
    .eq('product_id', productId)
    .eq('status', 'ready')
    .maybeSingle()

  if (error) throw error
  if (!data) {
    throw new Error(
      `persona_assets não encontrado (status: ready) para produto ${productId}. ` +
      `Execute setup-persona.ts primeiro.`
    )
  }

  return data as PersonaAssets
}

async function loadApprovedUgc(productId: string): Promise<TikTokVideo[]> {
  const { data, error } = await supabase
    .from('tiktok_videos')
    .select('id, local_path, tiktok_url, duration_seconds, relevance_score')
    .eq('product_id', productId)
    .eq('status', 'approved')
    .order('relevance_score', { ascending: false })

  if (error) throw error
  return (data ?? []) as TikTokVideo[]
}

async function updateFinalVideoStatus(
  finalVideoId: string,
  status:       string,
  progressStep: string,
): Promise<void> {
  const { error } = await supabase
    .from('final_videos')
    .update({ status, progress_step: progressStep })
    .eq('id', finalVideoId)
  if (error) console.warn(`[DB] Falha ao atualizar status (${status}): ${error.message}`)
}

async function appendClipToConfig(finalVideoId: string, clip: GeneratedClip, warnings: string[]): Promise<void> {
  // Lê composição atual, adiciona o novo clip, regrava
  const { data } = await supabase
    .from('final_videos')
    .select('composition_config')
    .eq('id', finalVideoId)
    .single()

  const existing = (data?.composition_config as CompositionConfig | null) ?? {
    clips: [],
    pacing_config: { cut_style: 'abrupt', music_volume: 0.15, narration_volume: 1.0 },
    production_warnings: [],
  }

  // Substitui se já existir (retry de cena específica), senão adiciona
  const idx = existing.clips.findIndex(c => c.scene_number === clip.scene_number)
  if (idx >= 0) existing.clips[idx] = clip
  else existing.clips.push(clip)

  existing.clips.sort((a, b) => a.scene_number - b.scene_number)
  existing.production_warnings = Array.from(new Set([...existing.production_warnings, ...warnings]))

  const { error } = await supabase
    .from('final_videos')
    .update({ composition_config: existing })
    .eq('id', finalVideoId)

  if (error) console.warn(`[DB] Falha ao salvar clip ${clip.scene_number}: ${error.message}`)
}

// ── Tipo de clip por seção ────────────────────────────────────────────────────

const PERSONA_SECTIONS = new Set(['hook', 'problem', 'agitation', 'offer', 'cta'])
const SCENE_3D_SECTIONS = new Set(['mechanism'])

function resolveClipType(section: string, ugcAvailable: boolean): ClipType {
  if (PERSONA_SECTIONS.has(section)) return 'persona'
  if (SCENE_3D_SECTIONS.has(section)) return '3d'
  // proof e demais: ugc se disponível, senão 3d
  return ugcAvailable ? 'ugc' : '3d'
}

// ── Utils ─────────────────────────────────────────────────────────────────────

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      'final-video-id': { type: 'string' },
      'dry-run':        { type: 'boolean' },
      'skip-heygen':    { type: 'boolean' },
      'skip-kling':     { type: 'boolean' },
      'scene':          { type: 'string' },
    },
  })

  const finalVideoId  = values['final-video-id']
  const dryRun        = values['dry-run']     ?? false
  const skipHeyGen    = values['skip-heygen'] ?? false
  const skipKling     = values['skip-kling']  ?? false
  const onlyScene     = values['scene'] ? parseInt(values['scene']!, 10) : null

  if (!finalVideoId) throw new Error('--final-video-id é obrigatório')

  const elevenlabsKey = process.env.ELEVENLABS_API_KEY
  const heygenKey     = process.env.HEYGEN_API_KEY
  const klingApiKey   = process.env.KLING_API_KEY   // formato "ACCESS_KEY:SECRET_KEY"

  if (!elevenlabsKey)           throw new Error('ELEVENLABS_API_KEY não configurado')
  if (!skipHeyGen && !heygenKey) throw new Error('HEYGEN_API_KEY não configurado')
  if (!skipKling && !klingApiKey) throw new Error('KLING_API_KEY não configurado')

  const [klingAccessKey, klingSecretKey] = (klingApiKey ?? ':').split(':')

  console.log(`\n[generate-scenes] final_video_id: ${finalVideoId}`)

  // ── Carregar dados ──
  const finalVideo   = await loadFinalVideo(finalVideoId)
  console.log(`[generate-scenes] product_id: ${finalVideo.product_id}`)
  console.log(`[generate-scenes] combination: ${finalVideo.copy_combination_id}`)

  const videoAssets  = await loadVideoAssets(finalVideo.product_id, finalVideo.copy_combination_id)
  const persona      = await loadPersonaAssets(finalVideo.product_id)
  const approvedUgc  = await loadApprovedUgc(finalVideo.product_id)

  console.log(`[generate-scenes] Cenas: ${videoAssets.scenes.length}`)
  console.log(`[generate-scenes] UGC aprovado: ${approvedUgc.length} clips`)
  console.log(`[generate-scenes] Avatar HeyGen: ${persona.heygen_avatar_id}`)
  console.log(`[generate-scenes] Voz ElevenLabs: ${persona.elevenlabs_voice_id}`)

  await updateFinalVideoStatus(finalVideoId, 'generating_scenes', 'Iniciando geração de cenas')

  const tmpDir     = path.join(os.tmpdir(), 'adcraft', 'clips', finalVideoId)
  await fs.mkdir(tmpDir, { recursive: true })

  const scenes     = onlyScene
    ? videoAssets.scenes.filter(s => s.scene_number === onlyScene)
    : videoAssets.scenes

  let ugcIndex = 0

  for (const scene of scenes) {
    const sceneWarnings: string[] = []
    const clipType = resolveClipType(scene.section, approvedUgc.length > ugcIndex)

    console.log(`\n[Cena ${scene.scene_number}/${videoAssets.scenes.length}] section=${scene.section} tipo=${clipType}`)
    await updateFinalVideoStatus(
      finalVideoId,
      'generating_scenes',
      `Cena ${scene.scene_number}/${videoAssets.scenes.length}: ${scene.section}`,
    )

    let clipUrl:       string | null = null
    let audioUrl:      string | null = null
    let voUrl:         string | null = null
    let resolvedType:  ClipType | '3d_fallback' = clipType
    let tiktokVideoId: string | null = null

    if (clipType === 'persona') {
      // ── Persona: ElevenLabs → upload → HeyGen ──
      console.log(`  [ElevenLabs] Gerando áudio para: "${scene.narration.substring(0, 60)}…"`)
      const audioBuffer = await generateElevenLabsAudio(
        scene.narration,
        persona.elevenlabs_voice_id,
        elevenlabsKey!,
      )

      const audioPath = `audio/${finalVideoId}/scene_${scene.scene_number}.mp3`
      audioUrl = await uploadToStorage(audioPath, audioBuffer, 'audio/mpeg')
      console.log(`  [Storage] Áudio salvo: ${audioUrl}`)

      if (!dryRun && !skipHeyGen) {
        try {
          clipUrl = await generateHeyGenClip(persona.heygen_avatar_id, audioUrl, heygenKey!)
          console.log(`  [HeyGen] ✓ Clip: ${clipUrl}`)
        } catch (err) {
          const msg = `Cena ${scene.scene_number} HeyGen falhou: ${(err as Error).message}`
          console.warn(`  ⚠ ${msg}`)
          sceneWarnings.push(msg)
        }
      } else {
        console.log(`  [HeyGen] Pulado (dry-run ou --skip-heygen)`)
      }

    } else if (clipType === '3d') {
      // ── 3D: Kling + ElevenLabs VO ──
      if (!dryRun && !skipKling) {
        const jwt = generateKlingJWT(klingAccessKey, klingSecretKey)
        let klingAttempt = 0
        while (klingAttempt < 2) {
          try {
            clipUrl = await generateKlingClip(scene.veo3_prompt_en, scene.duration_seconds, jwt)
            console.log(`  [Kling] ✓ Clip: ${clipUrl}`)
            break
          } catch (err) {
            klingAttempt++
            const msg = `Cena ${scene.scene_number} Kling tentativa ${klingAttempt}: ${(err as Error).message}`
            console.warn(`  ⚠ ${msg}`)
            if (klingAttempt >= 2) {
              sceneWarnings.push(`Kling falhou 2× na cena ${scene.scene_number} — clip_url=null`)
              resolvedType = '3d_fallback'
            } else {
              await sleep(5_000)
            }
          }
        }
      } else {
        console.log(`  [Kling] Pulado (dry-run ou --skip-kling)`)
      }

      // VO separado para cenas 3D
      console.log(`  [ElevenLabs] Gerando VO para cena 3D…`)
      try {
        const voBuffer = await generateElevenLabsAudio(
          scene.narration,
          persona.elevenlabs_voice_id,
          elevenlabsKey!,
        )
        const voPath = `audio/${finalVideoId}/scene_${scene.scene_number}_vo.mp3`
        voUrl = await uploadToStorage(voPath, voBuffer, 'audio/mpeg')
        console.log(`  [Storage] VO salvo: ${voUrl}`)
      } catch (err) {
        const msg = `Cena ${scene.scene_number} VO falhou: ${(err as Error).message}`
        console.warn(`  ⚠ ${msg}`)
        sceneWarnings.push(msg)
      }

    } else if (clipType === 'ugc') {
      // ── UGC: trim FFmpeg → upload ──
      const ugcClip = approvedUgc[ugcIndex]
      ugcIndex++
      tiktokVideoId = ugcClip.id

      const localPath = ugcClip.local_path
      if (!localPath) {
        const msg = `Cena ${scene.scene_number}: tiktok_video sem local_path. Pulando UGC.`
        console.warn(`  ⚠ ${msg}`)
        sceneWarnings.push(msg)
        resolvedType = '3d_fallback'
      } else {
        try {
          const outPath = path.join(tmpDir, `ugc_${scene.scene_number}.mp4`)
          console.log(`  [FFmpeg] Trimando ${localPath} → ${scene.duration_seconds}s`)
          await trimUgcClip(localPath, scene.duration_seconds, outPath)

          const ugcBuffer = await fs.readFile(outPath)
          const storagePath = `clips/${finalVideoId}/ugc_${scene.scene_number}.mp4`
          clipUrl = await uploadToStorage(storagePath, ugcBuffer, 'video/mp4')
          console.log(`  [Storage] UGC salvo: ${clipUrl}`)

          // Limpar arquivo temporário
          await fs.unlink(outPath).catch(() => undefined)
        } catch (err) {
          const msg = `Cena ${scene.scene_number} UGC falhou: ${(err as Error).message}`
          console.warn(`  ⚠ ${msg}`)
          sceneWarnings.push(msg)
          resolvedType = '3d_fallback'
        }
      }
    }

    const generatedClip: GeneratedClip = {
      scene_number:     scene.scene_number,
      section:          scene.section,
      clip_type:        resolvedType,
      clip_url:         clipUrl,
      audio_url:        audioUrl,
      vo_url:           voUrl,
      duration_seconds: scene.duration_seconds,
      subtitle_text:    scene.subtitle_text,
      overlay_text:     scene.overlay_text,
      audio_cue:        scene.audio_cue,
      ...(tiktokVideoId ? { tiktok_video_id: tiktokVideoId } : {}),
    }

    await appendClipToConfig(finalVideoId, generatedClip, sceneWarnings)
    console.log(`  [DB] ✓ Clip ${scene.scene_number} salvo em composition_config`)
  }

  // ── Limpar diretório temporário ──
  await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => undefined)

  // Status: pronto para composição
  await updateFinalVideoStatus(finalVideoId, 'generating_scenes', 'Cenas concluídas')

  console.log(`\n[generate-scenes] ✓ Todos os ${scenes.length} clips gerados.`)
  console.log(`  Próximo passo: npx tsx scripts/video/compose-final.ts --final-video-id ${finalVideoId}`)
}

main().catch(err => {
  console.error('\n[generate-scenes] ERRO FATAL:', err.message)
  process.exit(1)
})
