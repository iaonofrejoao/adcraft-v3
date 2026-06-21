/**
 * Teste de upload para o Google Drive usando a estrutura padronizada do projeto.
 *
 * Uso:
 *   # Subir character board (imagens PNG):
 *   npx tsx scripts/video/test-upload-images.ts --type persona --sku BWNP --folder "C:\Videos\AdCraft\personas\BWNP"
 *
 *   # Subir clips de vídeo (MP4):
 *   npx tsx scripts/video/test-upload-images.ts --type video --tag BWNP_v1_H2_B1_C2_VID --folder "C:\Videos\AdCraft\videos\BWNP_v1_H2_B1_C2_VID"
 */
import * as dotenv from 'dotenv'
import * as path   from 'path'
import * as fs     from 'node:fs/promises'
import { parseArgs } from 'node:util'
import { savePersonaImageToDrive, saveVideoClipToDrive } from './google-drive'

dotenv.config({ path: path.resolve(__dirname, '../../.env') })

const { values: args } = parseArgs({
  args: process.argv.slice(2),
  options: {
    type:   { type: 'string' },   // 'persona' | 'video'
    sku:    { type: 'string' },   // para type=persona
    tag:    { type: 'string' },   // para type=video (storyboard_tag)
    folder: { type: 'string' },   // pasta local com os arquivos
  },
})

;(async () => {
  const type        = args.type
  const localFolder = args.folder
  if (!type || !localFolder) {
    console.error('Use: --type persona|video --folder <caminho> [--sku SKU | --tag TAG]')
    process.exit(1)
  }

  const MEDIA_EXTS = /\.(png|jpg|jpeg|mp4|mov|webm)$/i
  const files = (await fs.readdir(localFolder)).filter(f => MEDIA_EXTS.test(f)).sort()

  if (files.length === 0) {
    console.error(`Nenhum arquivo de mídia encontrado em ${localFolder}`)
    process.exit(1)
  }

  console.log(`\n📂 ${files.length} arquivo(s) em ${localFolder}`)

  for (const filename of files) {
    const buffer = await fs.readFile(path.join(localFolder, filename))
    process.stdout.write(`⬆️  ${filename}... `)

    let result: { fileId: string; directUrl: string }

    if (type === 'persona') {
      const sku = args.sku
      if (!sku) throw new Error('--sku é obrigatório para type=persona')
      result = await savePersonaImageToDrive(buffer, sku, filename)
    } else if (type === 'video') {
      const tag = args.tag
      if (!tag) throw new Error('--tag é obrigatório para type=video')
      result = await saveVideoClipToDrive(buffer, tag, filename)
    } else {
      throw new Error(`--type inválido: '${type}'. Use 'persona' ou 'video'.`)
    }

    console.log(`OK\n   file_id  : ${result.fileId}\n   url      : ${result.directUrl}`)
  }

  console.log('\n✅ Upload concluído.')
})().catch(e => { console.error('\n❌', e.message); process.exit(1) })
