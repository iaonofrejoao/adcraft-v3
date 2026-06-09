// GET /api/video-proxy?url=<encoded_tiktok_page_url>
// GET /api/video-proxy?url=<...>&warm=1  → pre-aquece o cache em background, retorna 204
//
// yt-dlp baixa o vídeo para um arquivo temp na primeira requisição.
// Requisições subsequentes (replay, seek) servem do arquivo — sem espera.
// Pre-warm no hover garante que o arquivo esteja pronto quando o usuário clica.

import { type NextRequest } from 'next/server'
import { spawn }            from 'child_process'
import { createHash }       from 'crypto'
import { tmpdir }           from 'os'
import { join }             from 'path'
import { createReadStream, existsSync } from 'fs'
import { stat }             from 'fs/promises'

// ── Cache em memória: hash(url) → Promise<filePath> ───────────────────────────
// Sobrevive entre requests no mesmo processo Next.js (dev + produção normal).
const downloadCache = new Map<string, Promise<string>>()

function cacheKey(url: string)  { return createHash('md5').update(url).digest('hex') }
function cachePath(hash: string){ return join(tmpdir(), `tiktok_${hash}.mp4`) }

function downloadToFile(tiktokUrl: string, outPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn('python', [
      '-m', 'yt_dlp', '--no-playlist', '-q',
      '-f', 'b',
      '-o', outPath,
      tiktokUrl,
    ])
    child.on('close', code => code === 0 ? resolve() : reject(new Error(`yt-dlp code ${code}`)))
    child.on('error', reject)
  })
}

function getOrDownload(tiktokUrl: string): Promise<string> {
  const hash = cacheKey(tiktokUrl)
  const path = cachePath(hash)

  if (existsSync(path)) return Promise.resolve(path)
  if (downloadCache.has(hash)) return downloadCache.get(hash)!

  const promise = downloadToFile(tiktokUrl, path)
    .then(() => path)
    .catch(err => {
      downloadCache.delete(hash)
      throw err
    })
  downloadCache.set(hash, promise)
  return promise
}

// ── Helpers de stream ─────────────────────────────────────────────────────────

function nodeToWebStream(readable: NodeJS.ReadableStream): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      readable.on('data',  (c: Buffer) => controller.enqueue(new Uint8Array(c)))
      readable.on('end',   ()          => controller.close())
      readable.on('error', (e: Error)  => controller.error(e))
    },
  })
}

const TIKTOK_URL_RE = /^https:\/\/(www\.)?tiktok\.com\/@[^/]+\/video\/\d+/

// ── Handler ───────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const tiktokUrl = req.nextUrl.searchParams.get('url')
  const warm      = req.nextUrl.searchParams.get('warm') === '1'

  if (!tiktokUrl || !TIKTOK_URL_RE.test(tiktokUrl)) {
    return new Response('URL TikTok inválida', { status: 400 })
  }

  // Pre-warm: inicia download em background e retorna imediatamente
  if (warm) {
    getOrDownload(tiktokUrl).catch(() => {})
    return new Response(null, { status: 204 })
  }

  // Play: aguarda arquivo estar disponível, então serve com Range support
  let filePath: string
  try {
    filePath = await getOrDownload(tiktokUrl)
  } catch (err: any) {
    console.error('[video-proxy]', err.message)
    return new Response('Falha ao baixar vídeo', { status: 502 })
  }

  const { size } = await stat(filePath)
  const range    = req.headers.get('range')

  if (range) {
    const [startStr, endStr] = range.replace('bytes=', '').split('-')
    const start    = parseInt(startStr, 10)
    const end      = endStr ? parseInt(endStr, 10) : size - 1
    const chunkLen = end - start + 1

    const stream = nodeToWebStream(createReadStream(filePath, { start, end }))
    return new Response(stream, {
      status: 206,
      headers: {
        'Content-Type':   'video/mp4',
        'Content-Range':  `bytes ${start}-${end}/${size}`,
        'Content-Length': String(chunkLen),
        'Accept-Ranges':  'bytes',
      },
    })
  }

  const stream = nodeToWebStream(createReadStream(filePath))
  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type':   'video/mp4',
      'Content-Length': String(size),
      'Accept-Ranges':  'bytes',
      'Cache-Control':  'public, max-age=3600',
    },
  })
}
