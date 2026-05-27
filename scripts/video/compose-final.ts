/**
 * scripts/video/compose-final.ts
 * Composição final de vídeo a partir dos clips gerados pelo generate-scenes.ts.
 *
 * Pipeline:
 *   1. Download de todos os clips/áudios para diretório temporário
 *   2. Mesclar VO nas cenas 3D (FFmpeg)
 *   3. Normalizar clips para 1080×1920, H.264, 30fps (FFmpeg)
 *   4. Concatenar clips em ordem (FFmpeg concat demuxer)
 *   5. Queimar legendas (SRT gerado do subtitle_text ou faster-whisper)
 *   6. Adicionar música de fundo com ducking -18dB (FFmpeg amix)
 *   7. Export final: H.264, AAC 192k, faststart, 1080×1920
 *   8. Extrair thumbnail, upload para Supabase Storage, atualizar final_videos
 *
 * Uso:
 *   npx tsx scripts/video/compose-final.ts \
 *     --final-video-id <uuid> \
 *     [--word-timestamps]   # usa faster-whisper para timing word-level
 *     [--no-music]          # compõe sem trilha sonora
 *     [--skip-subtitles]    # pula legendas
 *     [--dry-run]           # baixa e valida clips, sem compor
 *
 * Dependências do sistema:
 *   ffmpeg (no PATH)
 *   python3 + faster_whisper (opcional, para --word-timestamps)
 */

import * as dotenv  from 'dotenv'
import * as path    from 'path'
import * as fs      from 'node:fs/promises'
import * as os      from 'node:os'
import { spawn, spawnSync } from 'node:child_process'
import { parseArgs }        from 'node:util'
import { supabase }         from '../../workers/lib/db'

dotenv.config({ path: path.resolve(__dirname, '../../.env') })

// ── Types ─────────────────────────────────────────────────────────────────────

interface GeneratedClip {
  scene_number:     number
  section:          string
  clip_type:        string
  clip_url:         string | null
  audio_url:        string | null
  vo_url:           string | null
  duration_seconds: number
  subtitle_text:    string | null
  overlay_text:     string | null
  audio_cue:        string | null
  tiktok_video_id?: string
}

interface CompositionConfig {
  clips:            GeneratedClip[]
  pacing_config: {
    cut_style:        string
    music_volume:     number
    narration_volume: number
  }
  production_warnings: string[]
}

interface AudioConfig {
  background_music_style:  string
  background_music_volume: number
}

// ── FFmpeg helpers ────────────────────────────────────────────────────────────

function ffmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn('ffmpeg', ['-y', ...args], { stdio: ['ignore', 'ignore', 'pipe'] })
    const errChunks: Buffer[] = []
    proc.stderr.on('data', (d: Buffer) => errChunks.push(d))
    proc.on('error', err => {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        reject(new Error('ffmpeg não encontrado. Instale com: apt-get install ffmpeg (Linux) ou brew install ffmpeg (Mac)'))
      } else {
        reject(err)
      }
    })
    proc.on('close', code => {
      if (code === 0) {
        resolve()
      } else {
        const errMsg = Buffer.concat(errChunks).toString().slice(-2000)
        reject(new Error(`FFmpeg saiu com código ${code}:\n${errMsg}`))
      }
    })
  })
}

async function ffprobeGetDuration(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const proc = spawn('ffprobe', [
      '-v', 'quiet', '-print_format', 'json',
      '-show_format', filePath,
    ])
    const chunks: Buffer[] = []
    proc.stdout.on('data', (d: Buffer) => chunks.push(d))
    proc.on('close', code => {
      if (code !== 0) return reject(new Error(`ffprobe falhou com código ${code}`))
      try {
        const data = JSON.parse(Buffer.concat(chunks).toString()) as { format: { duration: string } }
        resolve(parseFloat(data.format.duration))
      } catch (e) {
        reject(e)
      }
    })
    proc.on('error', reject)
  })
}

// ── Download ──────────────────────────────────────────────────────────────────

async function downloadFile(url: string, destPath: string): Promise<void> {
  await fs.mkdir(path.dirname(destPath), { recursive: true })
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Download falhou (${res.status}): ${url}`)
  const buf = await res.arrayBuffer()
  await fs.writeFile(destPath, Buffer.from(buf))
}

// ── Legendas ─────────────────────────────────────────────────────────────────

function formatSRTTime(seconds: number): string {
  const h  = Math.floor(seconds / 3600)
  const m  = Math.floor((seconds % 3600) / 60)
  const s  = Math.floor(seconds % 60)
  const ms = Math.round((seconds % 1) * 1000)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms).padStart(3, '0')}`
}

function generateSRTFromScript(clips: GeneratedClip[]): string {
  let srt     = ''
  let counter = 1
  let offset  = 0

  for (const clip of clips) {
    const text = clip.subtitle_text?.trim()
    if (text) {
      const words    = text.split(/\s+/)
      const lineSize = 8
      const lines: string[] = []
      for (let i = 0; i < words.length; i += lineSize) {
        lines.push(words.slice(i, i + lineSize).join(' '))
      }
      const timePerLine = clip.duration_seconds / lines.length
      lines.forEach((line, i) => {
        const start = offset + i * timePerLine
        const end   = offset + (i + 1) * timePerLine - 0.05
        srt += `${counter}\n${formatSRTTime(start)} --> ${formatSRTTime(end)}\n${line}\n\n`
        counter++
      })
    }
    offset += clip.duration_seconds
  }
  return srt
}

interface WordTimestamp { word: string; start: number; end: number }

function isFasterWhisperAvailable(): boolean {
  const result = spawnSync('python3', ['-c', 'import faster_whisper'], { encoding: 'utf8' })
  return result.status === 0
}

async function generateSRTFromWhisper(audioPath: string): Promise<string> {
  const script = `
import json, sys
from faster_whisper import WhisperModel
model = WhisperModel("base", device="cpu", compute_type="int8")
segs, _ = model.transcribe(sys.argv[1], word_timestamps=True, language="pt")
words = [{"word": w.word.strip(), "start": round(w.start, 3), "end": round(w.end, 3)}
         for s in segs for w in (s.words or []) if w.word.strip()]
print(json.dumps(words))
`

  return new Promise((resolve, reject) => {
    const proc    = spawn('python3', ['-c', script, audioPath])
    const chunks: Buffer[] = []
    const errBuf: Buffer[] = []
    proc.stdout.on('data', (d: Buffer) => chunks.push(d))
    proc.stderr.on('data', (d: Buffer) => errBuf.push(d))
    proc.on('close', code => {
      if (code !== 0) {
        const err = Buffer.concat(errBuf).toString()
        return reject(new Error(`faster-whisper falhou: ${err}`))
      }
      try {
        const words  = JSON.parse(Buffer.concat(chunks).toString()) as WordTimestamp[]
        let srt      = ''
        let counter  = 1
        let lineWords: WordTimestamp[] = []
        const flush = () => {
          if (lineWords.length === 0) return
          const start = lineWords[0].start
          const end   = lineWords[lineWords.length - 1].end
          const text  = lineWords.map(w => w.word).join(' ')
          srt += `${counter}\n${formatSRTTime(start)} --> ${formatSRTTime(end)}\n${text}\n\n`
          counter++
          lineWords = []
        }
        for (const w of words) {
          lineWords.push(w)
          if (lineWords.length >= 6) flush()
        }
        flush()
        resolve(srt)
      } catch (e) {
        reject(e)
      }
    })
    proc.on('error', reject)
  })
}

// ── Música de fundo ───────────────────────────────────────────────────────────

const MUSIC_STYLE_MAP: Record<string, string[]> = {
  upbeat:        ['upbeat', 'energetic', 'fast'],
  energético:    ['upbeat', 'energetic', 'fast'],
  inspiracional: ['inspirational', 'warm', 'positive'],
  warm:          ['inspirational', 'warm', 'positive'],
  tenso:         ['tension', 'dramatic', 'intense'],
  percussivo:    ['tension', 'dramatic', 'intense'],
  suspense:      ['ambient', 'suspense', 'calm'],
  instrumental:  ['ambient', 'suspense', 'calm'],
}

async function findMusicFile(style: string): Promise<string | null> {
  const musicDir = path.resolve(__dirname, '../../assets/music')
  try {
    const files = await fs.readdir(musicDir)
    const mp3s  = files.filter(f => f.endsWith('.mp3') || f.endsWith('.m4a'))
    if (mp3s.length === 0) return null

    const keywords = MUSIC_STYLE_MAP[style.toLowerCase()] ?? []
    const match    = mp3s.find(f => keywords.some(k => f.toLowerCase().includes(k)))
    return path.join(musicDir, match ?? mp3s[0])
  } catch {
    return null
  }
}

// ── Upload para Supabase Storage ──────────────────────────────────────────────

async function uploadFileToStorage(localPath: string, storagePath: string, mimeType: string): Promise<string> {
  const buf = await fs.readFile(localPath)
  for (let attempt = 0; attempt < 3; attempt++) {
    const { error } = await supabase.storage
      .from('video-clips')
      .upload(storagePath, buf, { contentType: mimeType, upsert: true })

    if (!error) {
      const { data: { publicUrl } } = supabase.storage.from('video-clips').getPublicUrl(storagePath)
      return publicUrl
    }
    if (attempt < 2) await sleep(2 ** attempt * 1000)
    else throw new Error(`Upload falhou após 3 tentativas: ${error.message}`)
  }
  throw new Error('unreachable')
}

// ── Database ──────────────────────────────────────────────────────────────────

async function loadFinalVideoWithConfig(finalVideoId: string): Promise<{
  product_id:          string
  copy_combination_id: string
  composition_config:  CompositionConfig
}> {
  const { data, error } = await supabase
    .from('final_videos')
    .select('product_id, copy_combination_id, composition_config')
    .eq('id', finalVideoId)
    .single()

  if (error) throw error
  if (!data) throw new Error(`final_video ${finalVideoId} não encontrado`)

  const config = data.composition_config as CompositionConfig | null
  if (!config?.clips?.length) {
    throw new Error(
      `composition_config vazio para ${finalVideoId}. ` +
      `Execute generate-scenes.ts primeiro.`
    )
  }

  return data as { product_id: string; copy_combination_id: string; composition_config: CompositionConfig }
}

async function loadAudioConfig(productId: string, combinationId: string): Promise<AudioConfig> {
  const { data } = await supabase
    .from('product_knowledge')
    .select('artifact_data')
    .eq('product_id', productId)
    .eq('artifact_type', 'video_assets')
    .eq('status', 'fresh')
    .order('created_at', { ascending: false })
    .limit(10)

  const match = (data ?? []).find(
    (r: { artifact_data: { combination_used?: string; audio_config?: AudioConfig } }) =>
      r.artifact_data?.combination_used === combinationId
  )

  return (match?.artifact_data?.audio_config as AudioConfig | null) ?? {
    background_music_style:  'upbeat',
    background_music_volume: 0.15,
  }
}

async function updateFinalVideoStatus(id: string, status: string, step: string): Promise<void> {
  const { error } = await supabase
    .from('final_videos')
    .update({ status, progress_step: step })
    .eq('id', id)
  if (error) console.warn(`[DB] Status update falhou: ${error.message}`)
}

async function finalizeFinalVideo(
  id:              string,
  videoUrl:        string,
  thumbnailUrl:    string,
  durationSeconds: number,
): Promise<void> {
  const { error } = await supabase
    .from('final_videos')
    .update({
      status:           'ready',
      progress_step:    'Pronto',
      video_url:        videoUrl,
      thumbnail_url:    thumbnailUrl,
      duration_seconds: durationSeconds,
      completed_at:     new Date().toISOString(),
    })
    .eq('id', id)

  if (error) throw new Error(`Falha ao finalizar final_video: ${error.message}`)
}

// ── Utils ─────────────────────────────────────────────────────────────────────

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

// ── Main pipeline ─────────────────────────────────────────────────────────────

async function main() {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      'final-video-id':  { type: 'string'  },
      'word-timestamps': { type: 'boolean' },
      'no-music':        { type: 'boolean' },
      'skip-subtitles':  { type: 'boolean' },
      'dry-run':         { type: 'boolean' },
    },
  })

  const finalVideoId    = values['final-video-id']
  const useWordTimings  = values['word-timestamps'] ?? false
  const noMusic         = values['no-music']        ?? false
  const skipSubtitles   = values['skip-subtitles']  ?? false
  const dryRun          = values['dry-run']         ?? false

  if (!finalVideoId) throw new Error('--final-video-id é obrigatório')

  console.log(`\n[compose-final] final_video_id: ${finalVideoId}`)

  const { product_id, copy_combination_id, composition_config } =
    await loadFinalVideoWithConfig(finalVideoId)

  const clips       = composition_config.clips.sort((a, b) => a.scene_number - b.scene_number)
  const audioConfig = await loadAudioConfig(product_id, copy_combination_id)

  console.log(`[compose-final] ${clips.length} clips — duração total: ${clips.reduce((s, c) => s + c.duration_seconds, 0)}s`)

  if (dryRun) {
    console.log('[DRY-RUN] Clips encontrados:')
    clips.forEach(c => console.log(`  Cena ${c.scene_number}: ${c.clip_type} — ${c.clip_url ?? 'SEM URL'}`))
    return
  }

  // ── Setup diretório temporário ──
  const tmpBase = path.join(os.tmpdir(), 'adcraft', 'compose', finalVideoId)
  const rawDir  = path.join(tmpBase, 'raw')
  const normDir = path.join(tmpBase, 'norm')
  await fs.mkdir(rawDir,  { recursive: true })
  await fs.mkdir(normDir, { recursive: true })

  await updateFinalVideoStatus(finalVideoId, 'composing', 'Baixando clips')

  // ── Fase 1: Download ──
  console.log('\n[FASE 1] Baixando assets…')
  const rawPaths: Map<number, { video: string; vo: string | null; audio: string | null }> = new Map()

  await Promise.all(clips.map(async clip => {
    const sceneNum = clip.scene_number
    let videoPath: string

    if (clip.clip_url) {
      videoPath = path.join(rawDir, `${String(sceneNum).padStart(2, '0')}_${clip.section}.mp4`)
      await downloadFile(clip.clip_url, videoPath)
      console.log(`  Cena ${sceneNum}: clip baixado`)
    } else {
      // 3d_fallback: gerar tela preta
      videoPath = path.join(rawDir, `${String(sceneNum).padStart(2, '0')}_${clip.section}.mp4`)
      await ffmpeg([
        '-f', 'lavfi', '-i', `color=black:size=1080x1920:rate=30`,
        '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo',
        '-t', String(clip.duration_seconds),
        '-c:v', 'libx264', '-c:a', 'aac',
        videoPath,
      ])
      console.log(`  Cena ${sceneNum}: tela preta (clip ausente)`)
    }

    let voPath: string | null = null
    if (clip.vo_url) {
      voPath = path.join(rawDir, `${String(sceneNum).padStart(2, '0')}_vo.mp3`)
      await downloadFile(clip.vo_url, voPath)
    }

    let audioPath: string | null = null
    if (clip.audio_url) {
      audioPath = path.join(rawDir, `${String(sceneNum).padStart(2, '0')}_audio.mp3`)
      await downloadFile(clip.audio_url, audioPath)
    }

    rawPaths.set(sceneNum, { video: videoPath, vo: voPath, audio: audioPath })
  }))

  // ── Fase 2: Mesclar VO nas cenas 3D ──
  console.log('\n[FASE 2] Mesclando VO em cenas 3D…')
  for (const clip of clips) {
    const raw = rawPaths.get(clip.scene_number)!
    if (clip.clip_type === '3d' && raw.vo) {
      const mergedPath = path.join(rawDir, `${String(clip.scene_number).padStart(2, '0')}_merged.mp4`)
      await ffmpeg([
        '-i', raw.video,
        '-i', raw.vo,
        '-c:v', 'copy', '-c:a', 'aac',
        '-map', '0:v', '-map', '1:a',
        '-shortest',
        mergedPath,
      ])
      rawPaths.set(clip.scene_number, { ...raw, video: mergedPath })
      console.log(`  Cena ${clip.scene_number}: VO mesclado`)
    }
  }

  // ── Fase 3: Normalizar ──
  await updateFinalVideoStatus(finalVideoId, 'composing', 'Normalizando clips')
  console.log('\n[FASE 3] Normalizando clips para 1080×1920…')
  const normPaths: string[] = []

  for (const clip of clips.sort((a, b) => a.scene_number - b.scene_number)) {
    const raw      = rawPaths.get(clip.scene_number)!
    const normPath = path.join(normDir, `${String(clip.scene_number).padStart(2, '0')}_${clip.section}.mp4`)

    await ffmpeg([
      '-i', raw.video,
      '-vf', 'scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920',
      '-c:v', 'libx264', '-preset', 'fast', '-crf', '22',
      '-c:a', 'aac', '-ar', '44100', '-ac', '2',
      '-r', '30', '-pix_fmt', 'yuv420p',
      normPath,
    ])
    normPaths.push(normPath)
    console.log(`  Cena ${clip.scene_number} normalizada`)
  }

  // ── Fase 4: Concatenar ──
  await updateFinalVideoStatus(finalVideoId, 'composing', 'Concatenando cenas')
  console.log('\n[FASE 4] Concatenando clips…')

  const concatListPath = path.join(tmpBase, 'concat_list.txt')
  const concatPath     = path.join(tmpBase, 'concat.mp4')

  const listContent = normPaths.map(p => `file '${p.replace(/'/g, "'\\''")}'`).join('\n')
  await fs.writeFile(concatListPath, listContent)

  await ffmpeg([
    '-f', 'concat', '-safe', '0',
    '-i', concatListPath,
    '-c', 'copy',
    concatPath,
  ])
  console.log('  Concat concluído')

  let currentVideo = concatPath

  // ── Fase 5: Legendas ──
  if (!skipSubtitles) {
    await updateFinalVideoStatus(finalVideoId, 'composing', 'Adicionando legendas')
    console.log('\n[FASE 5] Gerando legendas…')

    let srtContent = ''
    const srtPath  = path.join(tmpBase, 'subs.srt')

    if (useWordTimings && isFasterWhisperAvailable()) {
      console.log('  Usando faster-whisper para word-level timing…')
      try {
        // Concatenar todos os áudios de narração para um arquivo único
        const audioFiles = clips
          .map(c => rawPaths.get(c.scene_number)!)
          .filter(r => r.audio !== null)
          .map(r => r.audio!)

        if (audioFiles.length > 0) {
          const narrationListPath = path.join(tmpBase, 'audio_list.txt')
          await fs.writeFile(narrationListPath, audioFiles.map(f => `file '${f.replace(/'/g, "'\\''")}'`).join('\n'))
          const narrationFullPath = path.join(tmpBase, 'narration_full.mp3')

          await ffmpeg(['-f', 'concat', '-safe', '0', '-i', narrationListPath, '-c', 'copy', narrationFullPath])
          srtContent = await generateSRTFromWhisper(narrationFullPath)
          console.log('  faster-whisper concluído')
        }
      } catch (err) {
        console.warn(`  ⚠ faster-whisper falhou: ${(err as Error).message}. Usando script timing.`)
      }
    }

    if (!srtContent) {
      console.log('  Usando script timing (subtitle_text das cenas)…')
      srtContent = generateSRTFromScript(clips)
    }

    if (srtContent.trim()) {
      await fs.writeFile(srtPath, srtContent, 'utf8')

      const withSubsPath = path.join(tmpBase, 'with_subs.mp4')
      const subtitleFilter = `subtitles=${srtPath.replace(/\\/g, '/').replace(/:/g, '\\:')}:force_style='FontName=Arial,FontSize=62,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,Bold=1,Outline=3,Shadow=1,Alignment=2,MarginV=80'`

      await ffmpeg([
        '-i', currentVideo,
        '-vf', subtitleFilter,
        '-c:v', 'libx264', '-preset', 'fast', '-crf', '22',
        '-c:a', 'copy',
        withSubsPath,
      ])
      currentVideo = withSubsPath
      console.log('  Legendas queimadas')
    } else {
      console.log('  Nenhum subtitle_text disponível — legendas puladas')
    }
  }

  // ── Fase 6: Música de fundo ──
  if (!noMusic) {
    await updateFinalVideoStatus(finalVideoId, 'composing', 'Mixando trilha sonora')
    console.log('\n[FASE 6] Adicionando música de fundo…')

    const musicPath = await findMusicFile(audioConfig.background_music_style)
    if (musicPath) {
      const withMusicPath  = path.join(tmpBase, 'with_music.mp4')
      const totalDuration  = clips.reduce((s, c) => s + c.duration_seconds, 0)
      const fadeOutStart   = Math.max(0, totalDuration - 2)
      const musicVolume    = audioConfig.background_music_volume ?? 0.126

      await ffmpeg([
        '-i', currentVideo,
        '-stream_loop', '-1', '-i', musicPath,
        '-filter_complex',
          `[1:a]volume=${musicVolume},afade=t=in:st=0:d=1,afade=t=out:st=${fadeOutStart}:d=2[music];` +
          `[0:a][music]amix=inputs=2:duration=first:dropout_transition=2[a]`,
        '-map', '0:v', '-map', '[a]',
        '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k',
        '-shortest',
        withMusicPath,
      ])
      currentVideo = withMusicPath
      console.log(`  Música adicionada: ${path.basename(musicPath)} (vol: ${musicVolume})`)
    } else {
      console.log('  Nenhum arquivo de música encontrado em assets/music/ — pulando')
    }
  }

  // ── Fase 7: Export final ──
  await updateFinalVideoStatus(finalVideoId, 'composing', 'Exportando vídeo final')
  console.log('\n[FASE 7] Export final 1080×1920…')

  const finalPath = path.join(tmpBase, 'final.mp4')
  await ffmpeg([
    '-i', currentVideo,
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '20',
    '-c:a', 'aac', '-b:a', '192k',
    '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart',
    finalPath,
  ])

  const durationSeconds = await ffprobeGetDuration(finalPath)
  const fileSizeMB      = (await fs.stat(finalPath)).size / (1024 * 1024)

  console.log(`  Export concluído: ${durationSeconds.toFixed(1)}s — ${fileSizeMB.toFixed(1)} MB`)

  // Re-encode com qualidade menor se arquivo grande demais
  if (fileSizeMB > 500) {
    console.warn('  ⚠ Arquivo > 500 MB. Re-encodando com CRF 28…')
    const finalSavedPath = path.join(tmpBase, 'final_reenc.mp4')
    await ffmpeg([
      '-i', finalPath,
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '28',
      '-c:a', 'aac', '-b:a', '128k',
      '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
      finalSavedPath,
    ])
    await fs.rename(finalSavedPath, finalPath)
    console.log('  Re-encode concluído')
  }

  // ── Fase 8: Thumbnail + Upload ──
  await updateFinalVideoStatus(finalVideoId, 'composing', 'Fazendo upload')
  console.log('\n[FASE 8] Thumbnail + upload…')

  const thumbPath = path.join(tmpBase, 'thumbnail.jpg')
  await ffmpeg([
    '-i', finalPath,
    '-ss', '1', '-vframes', '1', '-q:v', '2',
    thumbPath,
  ])

  const videoStoragePath = `final_videos/${finalVideoId}/final.mp4`
  const thumbStoragePath = `final_videos/${finalVideoId}/thumbnail.jpg`

  const [videoUrl, thumbnailUrl] = await Promise.all([
    uploadFileToStorage(finalPath,  videoStoragePath, 'video/mp4'),
    uploadFileToStorage(thumbPath,  thumbStoragePath, 'image/jpeg'),
  ])

  console.log(`  Vídeo:     ${videoUrl}`)
  console.log(`  Thumbnail: ${thumbnailUrl}`)

  // ── Finalizar no banco ──
  await finalizeFinalVideo(finalVideoId, videoUrl, thumbnailUrl, Math.round(durationSeconds * 100) / 100)

  // ── Limpeza ──
  await fs.rm(tmpBase, { recursive: true, force: true }).catch(() => undefined)

  console.log(`\n[compose-final] ✓ Vídeo pronto!`)
  console.log(`  Duração:  ${durationSeconds.toFixed(1)}s`)
  console.log(`  URL:      ${videoUrl}`)
  console.log(`  Thumb:    ${thumbnailUrl}`)
  console.log(`  Status:   ready`)
}

main().catch(err => {
  console.error('\n[compose-final] ERRO FATAL:', err.message)
  process.exit(1)
})
