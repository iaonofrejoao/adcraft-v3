// GET /api/thumbnail-proxy?url=<encoded_url>
//
// Modos suportados:
//   TikTok page URL  → yt-dlp extrai CDN URL atual, depois fetch server-side
//   Facebook CDN URL (*.fbcdn.net) → fetch server-side direto com headers adequados
//
// Cache em memória por 6h para evitar re-requisições frequentes.

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
const FBCDN_URL_RE  = /^https:\/\/[^/]*\.fbcdn\.net\//

function cacheKey(url: string) { return createHash('md5').update(url).digest('hex') }

// ── TikTok: usa yt-dlp para obter URL CDN atual ───────────────────────────────

function getTiktokThumbnailUrl(tiktokUrl: string): Promise<string> {
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
      const thumbUrl = output.split('\n').map(l => l.trim()).find(l => l.startsWith('http'))
      if (code !== 0 || !thumbUrl) {
        return reject(new Error(`yt-dlp code ${code}`))
      }
      resolve(thumbUrl)
    })
    child.on('error', reject)
  })
}

async function fetchTiktokEntry(tiktokUrl: string): Promise<CacheEntry> {
  const thumbUrl = await getTiktokThumbnailUrl(tiktokUrl)

  const res = await fetch(thumbUrl, {
    headers: {
      'Referer':    'https://www.tiktok.com/',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept':     'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
    },
  })

  if (!res.ok) throw new Error(`CDN TikTok retornou ${res.status}`)

  const contentType = res.headers.get('content-type') ?? 'image/jpeg'
  const buffer      = Buffer.from(await res.arrayBuffer())
  return { buffer, contentType, expiresAt: Date.now() + CACHE_TTL }
}

// ── Facebook CDN: fetch direto com headers ────────────────────────────────────

async function fetchFbcdnEntry(cdnUrl: string): Promise<CacheEntry> {
  const res = await fetch(cdnUrl, {
    headers: {
      'Referer':    'https://www.facebook.com/',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept':     'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
    },
  })

  if (!res.ok) throw new Error(`Facebook CDN retornou ${res.status}`)

  const contentType = res.headers.get('content-type') ?? 'image/jpeg'
  const buffer      = Buffer.from(await res.arrayBuffer())
  return { buffer, contentType, expiresAt: Date.now() + CACHE_TTL }
}

// ── Cache wrapper ─────────────────────────────────────────────────────────────

function getOrFetch(url: string, fetcher: (u: string) => Promise<CacheEntry>): Promise<CacheEntry> {
  const key    = cacheKey(url)
  const cached = memCache.get(key)

  if (cached) {
    return cached.then(entry => {
      if (entry.expiresAt > Date.now()) return entry
      memCache.delete(key)
      return getOrFetch(url, fetcher)
    })
  }

  const promise = fetcher(url).catch(err => {
    memCache.delete(key)
    throw err
  })
  memCache.set(key, promise)
  return promise
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url')

  if (!url) return new Response('URL é obrigatória', { status: 400 })

  let entry: CacheEntry
  try {
    if (TIKTOK_URL_RE.test(url)) {
      entry = await getOrFetch(url, fetchTiktokEntry)
    } else if (FBCDN_URL_RE.test(url)) {
      entry = await getOrFetch(url, fetchFbcdnEntry)
    } else {
      return new Response('URL não suportada', { status: 400 })
    }
  } catch (err: any) {
    console.error('[thumbnail-proxy]', err.message)
    return new Response('Falha ao buscar thumbnail', { status: 502 })
  }

  return new Response(new Uint8Array(entry.buffer), {
    status: 200,
    headers: {
      'Content-Type':  entry.contentType,
      'Cache-Control': 'public, max-age=21600',
    },
  })
}
