import * as dotenv from 'dotenv'
import * as path from 'path'
import * as fs from 'fs'

dotenv.config({ path: path.resolve(__dirname, '../../.env') })

import { GoogleGenAI } from '@google/genai'

const PROJECT  = process.env.GOOGLE_CLOUD_PROJECT!
const LOCATION = 'us-central1'
process.env.GOOGLE_APPLICATION_CREDENTIALS = path.resolve(process.cwd(), process.env.GOOGLE_APPLICATION_CREDENTIALS!)

;(async () => {
  const ai = new GoogleGenAI({ vertexai: true, project: PROJECT, location: LOCATION })

  console.log('Gerando vídeo...')
  const op = await ai.models.generateVideos({
    model:  'veo-3.0-fast-generate-001',
    prompt: 'Woman speaking to camera, UGC style',
    config: { aspectRatio: '9:16', numberOfVideos: 1 },
  })

  // Inspecionar métodos disponíveis no objeto de operação
  console.log('Métodos da operação:', Object.getOwnPropertyNames(Object.getPrototypeOf(op)).filter(m => m !== 'constructor'))
  console.log('Propriedades:', Object.keys(op))
  console.log('done:', (op as any).done)
  console.log('name:', (op as any).name ?? (op as any).operationName)

  // Aguardar com polling manual usando o método correto
  let result = op as any
  for (let i = 0; i < 36; i++) { // max 3 min
    await new Promise(r => setTimeout(r, 5000))
    process.stdout.write('.')

    // Tentar diferentes métodos
    if (typeof result.wait === 'function')        { result = await result.wait(); break }
    if (typeof result.getResult === 'function')   { result = await result.getResult(); break }
    if (typeof result.poll === 'function')        { result = await result.poll() }
    if (typeof result.refresh === 'function')     { result = await result.refresh() }

    // Se tiver done=true, parar
    if (result.done) break
  }
  console.log()
  console.log('done:', result.done)
  console.log('response keys:', result.response ? Object.keys(result.response) : 'null')

  if (result.response?.generatedVideos?.length) {
    const video = result.response.generatedVideos[0]
    console.log('✅ Vídeo gerado! URI:', video.video?.uri?.slice(0, 80))
  } else {
    console.log('Resposta:', JSON.stringify(result, null, 2).slice(0, 400))
  }
})().catch(e => console.error('❌ Erro:', e.message))
