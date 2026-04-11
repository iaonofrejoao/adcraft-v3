// Wrapper FFmpeg para Node.js — portado de backend/app/tools/render_video_ffmpeg.py
// Fase 4.2 — usa fluent-ffmpeg como equivalente ao ffmpeg-python.
//
// Funções exportadas:
//   renderFinalCreative()   — pipeline completo (entrada principal)
//   concatenateClips()      — une clipes na ordem correta
//   mixAudio()              — adiciona narração e trilha de fundo
//   addSubtitles()          — burn de legendas SRT
//   exportForPlatform()     — redimensiona para aspect ratio de anúncio
//   validateVideoQuality()  — verifica requisitos mínimos para anúncio pago
//   generateSrt()           — gera SRT a partir do roteiro
//
// Requisito: FFmpeg instalado no PATH do sistema.
//   apt-get install -y ffmpeg   (Ubuntu/Debian)

import * as fs      from 'fs';
import * as os      from 'os';
import * as path    from 'path';
import * as crypto  from 'crypto';
import ffmpeg       from 'fluent-ffmpeg';

// ── Configuração de aspect ratios ─────────────────────────────────────────────

export type AspectRatioKey = '9:16' | '1:1' | '16:9' | '4:5' | '9x16' | '1x1' | '16x9' | '4x5';

interface RatioConfig {
  width:       number;
  height:      number;
  description: string;
}

const ASPECT_RATIO_CONFIG: Record<string, RatioConfig> = {
  '9:16': { width: 1080, height: 1920, description: 'Reels, Stories, TikTok' },
  '1:1':  { width: 1080, height: 1080, description: 'Feed quadrado' },
  '16:9': { width: 1920, height: 1080, description: 'YouTube, apresentações' },
  '4:5':  { width: 1080, height: 1350, description: 'Feed vertical (maior área)' },
  '9x16': { width: 1080, height: 1920, description: 'Reels, Stories, TikTok' },
  '1x1':  { width: 1080, height: 1080, description: 'Feed quadrado' },
  '16x9': { width: 1920, height: 1080, description: 'YouTube, apresentações' },
  '4x5':  { width: 1080, height: 1350, description: 'Feed vertical (maior área)' },
};

// Estilo padrão das legendas — otimizado para anúncios em mobile
const SUBTITLE_STYLE =
  'FontName=Arial,' +
  'FontSize=18,' +
  'PrimaryColour=&H00FFFFFF,' +   // Branco
  'OutlineColour=&H00000000,' +   // Contorno preto
  'BackColour=&H80000000,' +      // Fundo semi-transparente
  'Outline=2,' +
  'Shadow=1,' +
  'Alignment=2,' +                 // Centralizado na parte inferior
  'MarginV=30';

// ── Helpers internos ──────────────────────────────────────────────────────────

function assertFfmpeg(): void {
  try {
    // fluent-ffmpeg lança se não encontrar o binário na primeira operação.
    // Checagem preemptiva via which.
    const { execSync } = require('child_process');
    execSync('ffmpeg -version', { stdio: 'ignore' });
  } catch {
    throw new Error(
      'ffmpeg: binário não encontrado no PATH. Instale com: apt-get install -y ffmpeg',
    );
  }
}

function tmpDir(): string {
  const dir = path.join(os.tmpdir(), `adcraft_${crypto.randomUUID()}`);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function runFfmpeg(command: ffmpeg.FfmpegCommand): Promise<void> {
  return new Promise((resolve, reject) => {
    command
      .on('error', (err: Error) => reject(new Error(`ffmpeg: ${err.message}`)))
      .on('end',   () => resolve())
      .run();
  });
}

async function downloadFile(url: string, dest: string): Promise<void> {
  const resp = await fetch(url, { redirect: 'follow' });
  if (!resp.ok) throw new Error(`ffmpeg/_download: HTTP ${resp.status} para ${url}`);
  const buffer = Buffer.from(await resp.arrayBuffer());
  fs.writeFileSync(dest, buffer);
}

async function downloadClips(urls: string[], dir: string): Promise<string[]> {
  const paths: string[] = [];
  for (let i = 0; i < urls.length; i++) {
    const dest = path.join(dir, `clip_${String(i).padStart(3, '0')}.mp4`);
    await downloadFile(urls[i], dest);
    paths.push(dest);
  }
  return paths;
}

// ── Pipeline completo ─────────────────────────────────────────────────────────

export interface RenderOptions {
  /** URLs dos clipes em ordem de exibição. */
  videoClips:     string[];
  /** "9:16" | "1:1" | "16:9" | "4:5" */
  aspectRatio:    string;
  /** URL do áudio de narração (MP3/WAV). Opcional. */
  audioUrl?:      string;
  /** URL da trilha de fundo (MP3). Volume 15%. Opcional. */
  musicUrl?:      string;
  /** Conteúdo do arquivo SRT. Opcional. */
  subtitlesSrt?:  string;
}

/**
 * Pipeline completo de renderização do vídeo final.
 * Retorna os bytes do MP4 pronto para upload no R2.
 */
export async function renderFinalCreative(opts: RenderOptions): Promise<Buffer> {
  assertFfmpeg();

  const dir = tmpDir();

  try {
    // 1 — Download dos clipes
    const clipPaths = await downloadClips(opts.videoClips, dir);

    // 2 — Concatenação
    const concatPath = path.join(dir, 'concat.mp4');
    await concatenateClips(clipPaths, concatPath);

    let currentPath = concatPath;

    // 3 — Áudio
    if (opts.audioUrl || opts.musicUrl) {
      const audioOut = path.join(dir, 'with_audio.mp4');
      await mixAudio({
        videoPath:     currentPath,
        outputPath:    audioOut,
        tmpDir:        dir,
        narrationUrl:  opts.audioUrl,
        musicUrl:      opts.musicUrl,
      });
      currentPath = audioOut;
    }

    // 4 — Legendas
    if (opts.subtitlesSrt) {
      const srtPath    = path.join(dir, 'subtitles.srt');
      const srtOut     = path.join(dir, 'with_subtitles.mp4');
      fs.writeFileSync(srtPath, opts.subtitlesSrt, 'utf-8');
      await addSubtitles(currentPath, srtPath, srtOut);
      currentPath = srtOut;
    }

    // 5 — Exportação final
    const safeRatio = opts.aspectRatio.replace(':', 'x');
    const finalPath = path.join(dir, `final_${safeRatio}.mp4`);
    await exportForPlatform(currentPath, finalPath, opts.aspectRatio);

    return fs.readFileSync(finalPath);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// ── concatenateClips ──────────────────────────────────────────────────────────

/**
 * Concatena múltiplos clipes MP4 em ordem usando o demuxer concat do FFmpeg.
 * Para um único clipe, copia diretamente (sem re-encode).
 */
export async function concatenateClips(clipPaths: string[], outputPath: string): Promise<void> {
  if (clipPaths.length === 0) throw new Error('concatenateClips: lista de clipes vazia.');

  if (clipPaths.length === 1) {
    fs.copyFileSync(clipPaths[0], outputPath);
    return;
  }

  // Cria arquivo de lista para o demuxer concat
  const listFile = path.join(path.dirname(outputPath), 'clips_list.txt');
  const listContent = clipPaths
    .map((p) => `file '${p.replace(/\\/g, '/')}'`)
    .join('\n');
  fs.writeFileSync(listFile, listContent, 'utf-8');

  const cmd = ffmpeg()
    .input(listFile)
    .inputOptions(['-f concat', '-safe 0'])
    .outputOptions(['-c copy', '-movflags faststart'])
    .output(outputPath);

  await runFfmpeg(cmd);
}

// ── mixAudio ──────────────────────────────────────────────────────────────────

export interface MixAudioOptions {
  videoPath:        string;
  outputPath:       string;
  tmpDir:           string;
  narrationUrl?:    string;
  musicUrl?:        string;
  narrationVolume?: number; // 0.0–1.0, default 1.0
  musicVolume?:     number; // 0.0–1.0, default 0.15
}

/**
 * Adiciona narração e/ou trilha de fundo ao vídeo.
 * Se nenhum áudio fornecido, copia o vídeo sem alteração.
 */
export async function mixAudio(opts: MixAudioOptions): Promise<void> {
  const {
    videoPath,
    outputPath,
    tmpDir: dir,
    narrationUrl,
    musicUrl,
    narrationVolume = 1.0,
    musicVolume     = 0.15,
  } = opts;

  if (!narrationUrl && !musicUrl) {
    fs.copyFileSync(videoPath, outputPath);
    return;
  }

  const audioParts: string[] = [];
  const filterParts: string[] = [];
  let audioCount = 0;

  if (narrationUrl) {
    const narPath = path.join(dir, 'narration.mp3');
    await downloadFile(narrationUrl, narPath);
    audioParts.push(narPath);
    filterParts.push(`[${audioCount + 1}:a]volume=${narrationVolume}[nar]`);
    audioCount++;
  }

  if (musicUrl) {
    const musPath = path.join(dir, 'music.mp3');
    await downloadFile(musicUrl, musPath);
    audioParts.push(musPath);
    filterParts.push(
      `[${audioCount + 1}:a]volume=${musicVolume},afade=t=out:st=0:d=2[mus]`,
    );
    audioCount++;
  }

  // Monta complexFilterraph
  const mixLabels = [];
  if (narrationUrl) mixLabels.push('[nar]');
  if (musicUrl)     mixLabels.push('[mus]');

  let filterGraph: string;
  let audioLabel: string;

  if (mixLabels.length === 1) {
    filterGraph = filterParts[0];
    audioLabel  = mixLabels[0];
  } else {
    filterGraph = filterParts.join(';') + `;${mixLabels.join('')}amix=inputs=${mixLabels.length}[mix]`;
    audioLabel  = '[mix]';
  }

  const cmd = ffmpeg()
    .input(videoPath)
    .inputOptions([]);

  for (const ap of audioParts) {
    cmd.input(ap);
    if (ap.endsWith('.mp3') && musicUrl && ap === audioParts[audioParts.length - 1]) {
      cmd.inputOptions(['-stream_loop -1']);
    }
  }

  cmd
    .complexFilter(filterGraph)
    .outputOptions([
      '-map 0:v',
      `-map ${audioLabel}`,
      '-vcodec copy',
      '-acodec aac',
      '-ab 192k',
      '-shortest',
    ])
    .output(outputPath);

  await runFfmpeg(cmd);
}

// ── addSubtitles ──────────────────────────────────────────────────────────────

/**
 * Burn de legendas no vídeo (hardcoded — garante visibilidade no feed mobile).
 */
export async function addSubtitles(
  videoPath: string,
  srtPath:   string,
  outputPath: string,
  style: string = SUBTITLE_STYLE,
): Promise<void> {
  if (!fs.existsSync(srtPath)) {
    throw new Error(`addSubtitles: arquivo SRT não encontrado: ${srtPath}`);
  }

  // No Windows o FFmpeg precisa de barras normais e ":" escapado
  const srtAbs = srtPath
    .replace(/\\/g, '/')
    .replace(/:/g, '\\:');

  const cmd = ffmpeg()
    .input(videoPath)
    .videoFilter(`subtitles=${srtAbs}:force_style='${style}'`)
    .outputOptions(['-acodec copy', '-preset fast', '-crf 23'])
    .output(outputPath);

  await runFfmpeg(cmd);
}

// ── exportForPlatform ─────────────────────────────────────────────────────────

/**
 * Exporta o vídeo no aspect ratio e qualidade otimizados para anúncio pago.
 * Usa padding (letterbox/pillarbox) para redimensionar sem cropar.
 */
export async function exportForPlatform(
  inputPath:   string,
  outputPath:  string,
  aspectRatio: string,
): Promise<void> {
  const config = ASPECT_RATIO_CONFIG[aspectRatio];
  if (!config) {
    throw new Error(
      `exportForPlatform: aspect_ratio desconhecido '${aspectRatio}'. ` +
      `Disponíveis: ${Object.keys(ASPECT_RATIO_CONFIG).join(', ')}`,
    );
  }

  const { width: w, height: h } = config;

  const cmd = ffmpeg()
    .input(inputPath)
    .videoFilter(
      `scale=${w}:${h}:force_original_aspect_ratio=decrease,` +
      `pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2:black`,
    )
    .videoCodec('libx264')
    .audioCodec('aac')
    .videoBitrate('4000k')
    .audioBitrate('192k')
    .outputOptions([
      '-preset medium',
      '-crf 20',
      '-movflags faststart',
      '-pix_fmt yuv420p',
    ])
    .output(outputPath);

  await runFfmpeg(cmd);
}

// ── validateVideoQuality ──────────────────────────────────────────────────────

export interface VideoMetadata {
  duration_seconds: number;
  resolution:       string;
  fps:              number;
  size_mb:          number;
  has_audio:        boolean;
}

export interface ValidationResult {
  valid:    boolean;
  issues:   string[];
  metadata: VideoMetadata;
}

/**
 * Valida se o vídeo atende aos requisitos mínimos para veiculação como anúncio pago.
 */
export async function validateVideoQuality(videoPath: string): Promise<ValidationResult> {
  if (!fs.existsSync(videoPath)) {
    throw new Error(`validateVideoQuality: arquivo não encontrado: ${videoPath}`);
  }

  const metadata = await probeVideo(videoPath);
  const issues: string[] = [];

  if (metadata.duration_seconds < 5)  issues.push(`Vídeo muito curto: ${metadata.duration_seconds}s (mínimo 5s).`);
  if (metadata.duration_seconds > 120) issues.push(`Vídeo muito longo: ${metadata.duration_seconds}s (máximo 120s para anúncio).`);
  if (Math.min(
    parseInt(metadata.resolution.split('x')[0], 10),
    parseInt(metadata.resolution.split('x')[1], 10),
  ) < 720) issues.push(`Resolução abaixo do mínimo: ${metadata.resolution} (mínimo 720p).`);
  if (metadata.fps < 24) issues.push(`Taxa de quadros abaixo do mínimo: ${metadata.fps}fps (mínimo 24fps).`);
  if (metadata.size_mb > 500) issues.push(`Arquivo muito grande: ${metadata.size_mb}MB (máximo 500MB).`);
  if (!metadata.has_audio) issues.push('Sem faixa de áudio — anúncios sem som têm alcance reduzido.');

  return { valid: issues.length === 0, issues, metadata };
}

function probeVideo(videoPath: string): Promise<VideoMetadata> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(videoPath, (err, data) => {
      if (err) return reject(new Error(`ffprobe: ${err.message}`));

      const vStream = data.streams.find((s) => s.codec_type === 'video');
      const aStream = data.streams.find((s) => s.codec_type === 'audio');
      const duration = parseFloat(String(data.format?.duration ?? '0'));
      const width    = vStream?.width  ?? 0;
      const height   = vStream?.height ?? 0;

      // fps pode ser "24/1" ou "30000/1001"
      let fps = 0;
      const fpsRaw = vStream?.r_frame_rate ?? '0/1';
      const [num, den] = String(fpsRaw).split('/').map(Number);
      if (den && den !== 0) fps = num / den;

      const sizeMb = fs.statSync(videoPath).size / (1024 * 1024);

      resolve({
        duration_seconds: Math.round(duration * 10) / 10,
        resolution:       `${width}x${height}`,
        fps:              Math.round(fps * 10) / 10,
        size_mb:          Math.round(sizeMb * 10) / 10,
        has_audio:        aStream !== undefined,
      });
    });
  });
}

// ── generateSrt ───────────────────────────────────────────────────────────────

/**
 * Gera conteúdo de arquivo SRT a partir do texto do roteiro.
 * Distribui o texto uniformemente ao longo da duração total do vídeo.
 */
export function generateSrt(
  text:            string,
  durationSeconds: number,
  wordsPerLine:    number = 7,
): string {
  if (!text.trim()) throw new Error('generateSrt: texto está vazio.');
  if (durationSeconds <= 0) throw new Error(`generateSrt: durationSeconds inválido (${durationSeconds}).`);

  const words = text.split(/\s+/).filter(Boolean);
  if (!words.length) throw new Error('generateSrt: texto sem palavras.');

  const lines: string[] = [];
  for (let i = 0; i < words.length; i += wordsPerLine) {
    lines.push(words.slice(i, i + wordsPerLine).join(' '));
  }

  const timePerLine = durationSeconds / lines.length;

  const blocks = lines.map((line, i) => {
    const start = i * timePerLine;
    const end   = (i + 1) * timePerLine;
    return `${i + 1}\n${fmtSrtTime(start)} --> ${fmtSrtTime(end)}\n${line}`;
  });

  return blocks.join('\n\n') + '\n';
}

function fmtSrtTime(t: number): string {
  const h  = Math.floor(t / 3600);
  const m  = Math.floor((t % 3600) / 60);
  const s  = Math.floor(t % 60);
  let   ms = Math.round((t % 1) * 1000);
  if (ms >= 1000) ms = 999;
  return `${pad2(h)}:${pad2(m)}:${pad2(s)},${String(ms).padStart(3, '0')}`;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}
