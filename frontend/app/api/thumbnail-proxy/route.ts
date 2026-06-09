// GET /api/thumbnail-proxy?url=<encoded_tiktok_page_url>
//
// yt-dlp --get-thumbnail obtém a URL CDN válida e atual do TikTok.
// O fetch server-side evita o bloqueio de hotlink do CDN.
// Cache em memória por 6h para não re-chamar yt-dlp a cada request.

import { type NextRequest } from 'next/server'
import { spawn }            from 'child_process'
import { createHash }       from 'crypto'

interface CacheEntry {
  buffer:      Buffer
  contentType: string
  expiresAt:   number
}

const memCache   = new Map<string, Promise<CacheEntry>>()
const CACHE_TTL  = 6 * 60 * 60 * 1000   // 6h

const TIKTOK_URL_RE = /^https:\/\/(www\.)?tiktok\.com\/@[^/]+\/video\/\d+/

function cacheKey(url: string) { return createHash('md5').update(url).digest('hex') }

function getThumbnailUrl(tiktokUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    let output = ''
    const child = spawn('python', [
      '-m', 'yt_dlp',
      '--no-playlist',
      '--print', 'thumbnail',
      '--skip-download',
      tiktokUrl,
    ])
    child.stdout.on('data', (d: Buffer) => { output += d.toString() })
    child.on('close', code => {
      const thumbUrl = output.trim()
      if (code !== 0 || !thumbUrl) {
        return reject(new Error(`yt-dlp code ${code}`))
      }
      resolve(thumbUrl)
    })
    child.on('error', reject)
  })
}

async function fetchEntry(tiktokUrl: string): Promise<CacheEntry> {
  const thumbUrl = await getThumbnailUrl(tiktokUrl)

  const res = await fetch(thumbUrl, {
    headers: {
      'Referer':     'https://www.tiktok.com/',
      'User-Agent':  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept':      'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
    },
  })

  if (!res.ok) throw new Error(`CDN retornou ${res.status}`)

  const contentType = res.headers.get('content-type') ?? 'image/jpeg'
  const buffer      = Buffer.from(await res.arrayBuffer())

  return { buffer, contentType, expiresAt: Date.now() + CACHE_TTL }
}

function getOrFetch(tiktokUrl: string): Promise<CacheEntry> {
  const key    = cacheKey(tiktokUrl)
  const cached = memCache.get(key)

  if (cached) {
    return cached.then(entry => {
      if (entry.expiresAt > Date.now()) return entry
      // Expirou — remove e refaz
      memCache.delete(key)
      return getOrFetch(tiktokUrl)
    })
  }

  const promise = fetchEntry(tiktokUrl).catch(err => {
    memCache.delete(key)
    throw err
  })
  memCache.set(key, promise)
  return promise
}

export async function GET(req: NextRequest) {
  const tiktokUrl = req.nextUrl.searchParams.get('url')

  if (!tiktokUrl || !TIKTOK_URL_RE.test(tiktokUrl)) {
    return new Response('URL TikTok inválida', { status: 400 })
  }

  let entry: CacheEntry
  try {
    entry = await getOrFetch(tiktokUrl)
  } catch (err: any) {
    console.error('[thumbnail-proxy]', err.message)
    return new Response('Falha ao buscar thumbnail', { status: 502 })
  }

  return new Response(entry.buffer, {
    status: 200,
    headers: {
      'Content-Type':  entry.contentType,
      'Cache-Control': 'public, max-age=21600',
    },
  })
}
