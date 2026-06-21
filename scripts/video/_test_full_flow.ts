import * as dotenv from 'dotenv'
import * as path from 'path'
import * as fs from 'fs'
import { textToVideo, getVeo3SessionUsage } from './veo3-client'
import { printGeminiUsage } from './nano-banana-client'

dotenv.config({ path: path.resolve(__dirname, '../../.env') })

;(async () => {
  console.log('=== Teste Veo 3 — fluxo completo (5s) ===')
  console.log('Gerando vídeo de teste via text-to-video...')

  const buf = await textToVideo('Brazilian woman, 30s, smiling at camera, natural light, UGC style, 5 seconds', 5)

  const outputPath = 'C:/Videos/AdCraft/videos/test_veo3_ok.mp4'
  fs.mkdirSync(path.dirname(outputPath), { recursive: true })
  fs.writeFileSync(outputPath, buf)
  console.log(`\n✅ Vídeo salvo: ${outputPath} (${(buf.byteLength / 1024).toFixed(0)} KB)`)

  const usage = getVeo3SessionUsage()
  console.log('Uso Veo 3:', usage.calls, 'chamadas')
})().catch(e => { console.error('❌ Erro:', e.message); process.exit(1) })
