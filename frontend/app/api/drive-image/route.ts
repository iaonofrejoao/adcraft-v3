// GET /api/drive-image?url=<encoded_drive_url>
// Proxy server-side para imagens e vídeos do Google Drive.
// Suporta range requests para seeking de vídeo no <video> nativo.

import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const driveUrl = searchParams.get('url')

  if (!driveUrl) {
    return new NextResponse(null, { status: 400 })
  }

  if (
    !driveUrl.startsWith('https://drive.google.com/') &&
    !driveUrl.startsWith('https://lh3.googleusercontent.com/')
  ) {
    return new NextResponse(null, { status: 400 })
  }

  try {
    const fetchHeaders: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    }

    // Repassa range header para suporte a seeking de vídeo
    const range = req.headers.get('range')
    if (range) fetchHeaders['Range'] = range

    const res = await fetch(driveUrl, {
      redirect: 'follow',
      headers:  fetchHeaders,
    })

    if (!res.ok && res.status !== 206) {
      return new NextResponse(null, { status: res.status })
    }

    const contentType = res.headers.get('content-type') ?? ''

    // Se o Drive retornou HTML (não autenticado ou arquivo não público)
    if (!contentType.startsWith('image/') && !contentType.startsWith('video/')) {
      return new NextResponse(null, { status: 403 })
    }

    const responseHeaders: Record<string, string> = {
      'Content-Type':  contentType,
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'public, max-age=86400, stale-while-revalidate=3600',
    }

    const contentLength = res.headers.get('content-length')
    if (contentLength) responseHeaders['Content-Length'] = contentLength

    const contentRange = res.headers.get('content-range')
    if (contentRange) responseHeaders['Content-Range'] = contentRange

    // Stream direto — não bufferiza (essencial para vídeos grandes)
    return new NextResponse(res.body, {
      status:  res.status,
      headers: responseHeaders,
    })
  } catch {
    return new NextResponse(null, { status: 502 })
  }
}
