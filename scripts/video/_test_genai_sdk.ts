import * as dotenv from 'dotenv'
import * as path from 'path'
import * as fs from 'fs'

dotenv.config({ path: path.resolve(__dirname, '../../.env') })

// Usar @google/genai SDK com Vertex AI backend
import { GoogleGenAI } from '@google/genai'

const PROJECT  = process.env.GOOGLE_CLOUD_PROJECT!
const LOCATION = 'us-central1'
const SA_PATH  = path.resolve(process.cwd(), process.env.GOOGLE_APPLICATION_CREDENTIALS!)

// Configurar autenticação via variável de ambiente que o SDK reconhece
process.env.GOOGLE_APPLICATION_CREDENTIALS = SA_PATH

;(async () => {
  console.log('Project:', PROJECT)
  console.log('SA:', SA_PATH)
  console.log()

  const ai = new GoogleGenAI({
    vertexai: true,
    project:  PROJECT,
    location: LOCATION,
  })

  console.log('Gerando vídeo (5s text-to-video)...')
  const op = await ai.models.generateVideos({
    model:  'veo-3.0-fast-generate-001',
    prompt: 'Woman speaking to camera in a kitchen, UGC style, 5 seconds',
    config: { aspectRatio: '9:16', numberOfVideos: 1 },
  })

  console.log('Operação criada. Aguardando resultado...')
  let result = op
  while (!result.done) {
    await new Promise(r => setTimeout(r, 5000))
    process.stdout.write('.')
    result = await result.fetchResult()
  }
  console.log()

  if (result.response?.generatedVideos?.length) {
    const video = result.response.generatedVideos[0]
    console.log('✅ Vídeo gerado!')
    console.log('URI:', video.video?.uri)
    if (video.video?.uri) {
      // Baixar e salvar
      const { getBearerToken } = await import('./google-auth')
      const token = await getBearerToken()
      const vr = await fetch(video.video.uri, { headers: { Authorization: `Bearer ${token}` } })
      const buf = Buffer.from(await vr.arrayBuffer())
      const outPath = 'C:/Videos/AdCraft/videos/test_genai_veo3.mp4'
      fs.mkdirSync(path.dirname(outPath), { recursive: true })
      fs.writeFileSync(outPath, buf)
      console.log(`Salvo em: ${outPath} (${(buf.byteLength/1024).toFixed(0)} KB)`)
    }
  } else {
    console.log('Resposta:', JSON.stringify(result.response, null, 2).slice(0, 500))
  }
})().catch(e => console.error('❌ Erro:', e.message ?? e))
