import * as dotenv from 'dotenv'
import * as path from 'path'
dotenv.config({ path: path.resolve(__dirname, '../.env') })

const key = process.env.GEMINI_API_KEY!

async function main() {
  const res = await fetch(
    'https://generativelanguage.googleapis.com/v1beta/models?pageSize=200',
    { headers: { 'x-goog-api-key': key } }
  )
  const data = await res.json() as any

  // todos os modelos
  console.log('\n=== TODOS OS MODELOS ===')
  for (const m of (data.models ?? [])) {
    console.log(`${m.name}  →  ${(m.supportedGenerationMethods ?? []).join(', ')}`)
  }

  // filtrar por vídeo/imagem
  const relevant = (data.models ?? []).filter((m: any) =>
    /veo|video|imagen|image/i.test(m.name)
  )
  console.log('\n=== MODELOS DE VÍDEO / IMAGEM ===')
  console.log(JSON.stringify(relevant, null, 2))
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1) })
