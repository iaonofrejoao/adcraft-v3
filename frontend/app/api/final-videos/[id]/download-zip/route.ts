// GET /api/final-videos/[id]/download-zip
// Lê os clips locais do criativo e retorna um ZIP para download.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { readFile } from 'fs/promises'
import { existsSync } from 'fs'

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_KEY  || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase env não configurado')
  return createClient(url, key)
}

interface SceneEntry {
  scene_number: number
  drive_filename?: string
  local_path?:    string
  drive_url?:     string
  status?:        string
  section?:       string
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const supabase = getServiceClient()

    const { data: video, error } = await supabase
      .from('final_videos')
      .select('id, drive_folder_url, composition_config')
      .eq('id', params.id)
      .maybeSingle()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!video) return NextResponse.json({ error: 'Criativo não encontrado' }, { status: 404 })

    const scenes: SceneEntry[] =
      (video.composition_config as { scenes?: SceneEntry[] } | null)?.scenes ?? []

    const doneScenes = scenes.filter(s => s.local_path && existsSync(s.local_path))

    if (doneScenes.length === 0) {
      return NextResponse.json({ error: 'Nenhum clip disponível localmente' }, { status: 404 })
    }

    // Montar ZIP em memória com JSZip (compatível com Node.js)
    const JSZip = (await import('jszip')).default
    const zip = new JSZip()

    await Promise.all(
      doneScenes.map(async (scene) => {
        const buf = await readFile(scene.local_path!)
        const filename = scene.drive_filename ?? `cena${String(scene.scene_number).padStart(2, '0')}.mp4`
        zip.file(filename, buf)
      }),
    )

    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'STORE' })

    // Deriva nome do ZIP a partir do folder ou do primeiro filename
    const folderName =
      video.drive_folder_url
        ? (video.drive_folder_url as string).split(/[\\/]/).pop()
        : (doneScenes[0].drive_filename ?? 'criativo').replace(/_cena\d.*/, '')
    const zipName = `${folderName ?? 'criativo'}.zip`

    return new NextResponse(zipBuffer.buffer as ArrayBuffer, {
      status: 200,
      headers: {
        'Content-Type':        'application/zip',
        'Content-Disposition': `attachment; filename="${zipName}"`,
        'Content-Length':      String(zipBuffer.length),
      },
    })
  } catch (err) {
    console.error('[download-zip]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
