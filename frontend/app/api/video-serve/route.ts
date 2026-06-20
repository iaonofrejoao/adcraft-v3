// GET /api/video-serve?path=<encoded-absolute-path>
// Streams a local MP4 file with HTTP byte-range support (seeking + thumbnails).
// Only files inside VIDEO_OUTPUT_DIR are accessible.

export const runtime = 'nodejs'

import { NextRequest } from 'next/server'
import * as fs   from 'node:fs'
import * as path from 'node:path'

function getOutputDir(): string {
  return process.env.VIDEO_OUTPUT_DIR ?? 'C:\\Videos\\AdCraft'
}

function nodeReadStreamToWeb(stream: fs.ReadStream): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      stream.on('data', (chunk: Buffer | string) => {
        controller.enqueue(Buffer.isBuffer(chunk) ? new Uint8Array(chunk) : new TextEncoder().encode(chunk as string))
      })
      stream.on('end',   ()    => controller.close())
      stream.on('error', (err) => controller.error(err))
    },
    cancel() {
      stream.destroy()
    },
  })
}

export async function GET(req: NextRequest) {
  const rawPath = req.nextUrl.searchParams.get('path')

  if (!rawPath) {
    return new Response('Parâmetro path é obrigatório', { status: 400 })
  }

  const outputDir = path.resolve(getOutputDir())
  const resolved  = path.resolve(rawPath)
  const separator = path.sep

  if (!resolved.startsWith(outputDir + separator) && resolved !== outputDir) {
    return new Response('Acesso não autorizado', { status: 403 })
  }

  if (!fs.existsSync(resolved)) {
    return new Response('Arquivo não encontrado', { status: 404 })
  }

  const stat     = fs.statSync(resolved)
  const fileSize = stat.size
  const range    = req.headers.get('range')

  if (range) {
    const match = range.match(/bytes=(\d*)-(\d*)/)
    if (!match) {
      return new Response('Range inválido', {
        status: 416,
        headers: { 'Content-Range': `bytes */${fileSize}` },
      })
    }

    const start = match[1] ? parseInt(match[1], 10) : 0
    const end   = match[2] ? parseInt(match[2], 10) : fileSize - 1

    if (start > end || end >= fileSize) {
      return new Response('Range não satisfazível', {
        status: 416,
        headers: { 'Content-Range': `bytes */${fileSize}` },
      })
    }

    const chunkSize = end - start + 1
    const stream    = fs.createReadStream(resolved, { start, end })

    return new Response(nodeReadStreamToWeb(stream), {
      status: 206,
      headers: {
        'Content-Range':  `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges':  'bytes',
        'Content-Length': String(chunkSize),
        'Content-Type':   'video/mp4',
        'Cache-Control':  'public, max-age=3600',
      },
    })
  }

  const stream = fs.createReadStream(resolved)

  return new Response(nodeReadStreamToWeb(stream), {
    status: 200,
    headers: {
      'Content-Length': String(fileSize),
      'Content-Type':   'video/mp4',
      'Accept-Ranges':  'bytes',
      'Cache-Control':  'public, max-age=3600',
    },
  })
}
