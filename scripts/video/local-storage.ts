/**
 * scripts/video/local-storage.ts
 * Armazenamento local de clips de vídeo e imagens de personagem.
 * Substitui o google-drive.ts para o fluxo de desenvolvimento e produção local.
 *
 * Estrutura de pastas:
 *   {VIDEO_OUTPUT_DIR}/videos/{storyboard_tag}/   — clips MP4 por cena
 *   {VIDEO_OUTPUT_DIR}/personas/{sku}/            — character board PNGs
 *
 * VIDEO_OUTPUT_DIR é lido de process.env (padrão: C:\Videos\AdCraft).
 */

import * as fs   from 'node:fs/promises'
import * as path from 'node:path'

export function getOutputDir(): string {
  return process.env.VIDEO_OUTPUT_DIR ?? 'C:\\Videos\\AdCraft'
}

/**
 * Garante que uma subpasta existe dentro de parentPath.
 * Retorna o path absoluto da pasta criada.
 */
export async function ensureFolder(name: string, parentPath: string): Promise<string> {
  const folderPath = path.join(parentPath, name)
  await fs.mkdir(folderPath, { recursive: true })
  return folderPath
}

/**
 * Salva um clip de vídeo (Buffer MP4) no disco.
 * Retorna o path absoluto do arquivo salvo.
 */
export async function saveClip(
  clipBuffer: Buffer,
  filename: string,
  folderPath: string,
): Promise<string> {
  const filePath = path.join(folderPath, filename)
  await fs.writeFile(filePath, clipBuffer)
  return filePath
}

/**
 * Monta o nome do arquivo de clip seguindo a convenção do projeto.
 * Exemplo: BWNP_v1_H2_B1_C2_VID_cena01_hook.mp4
 */
export function buildFilename(storyboardTag: string, sceneNumber: number, section: string): string {
  const paddedScene = String(sceneNumber).padStart(2, '0')
  return `${storyboardTag}_cena${paddedScene}_${section}.mp4`
}

/**
 * Salva as imagens do character board localmente (fluxo legado, sem persona_id).
 * Retorna array de paths absolutos.
 */
export async function savePersonaImages(
  images: Buffer[],
  sku: string,
): Promise<string[]> {
  const personasDir = path.join(getOutputDir(), 'personas', sku)
  await fs.mkdir(personasDir, { recursive: true })

  const paths: string[] = []
  for (let i = 0; i < images.length; i++) {
    const filePath = path.join(personasDir, `board-${i + 1}.png`)
    await fs.writeFile(filePath, images[i])
    paths.push(filePath)
  }
  return paths
}

/**
 * Salva a imagem de referência de uma persona específica.
 * Nomenclatura: personas/{sku}/{personaId}.png
 * Retorna o path absoluto do arquivo salvo.
 */
export async function savePersonaImage(
  image: Buffer,
  sku: string,
  personaId: string,
): Promise<string> {
  const personasDir = path.join(getOutputDir(), 'personas', sku)
  await fs.mkdir(personasDir, { recursive: true })
  const filePath = path.join(personasDir, `${personaId}.png`)
  await fs.writeFile(filePath, image)
  return filePath
}

/**
 * Lê imagens do character board — aceita tanto paths locais quanto URLs HTTP.
 * Unifica o acesso para que o generate-scenes.ts não precise distinguir.
 */
export async function loadBoardImages(sources: string[]): Promise<Buffer[]> {
  const buffers: Buffer[] = []
  for (const src of sources) {
    if (src.startsWith('http://') || src.startsWith('https://')) {
      const res = await fetch(src)
      if (!res.ok) throw new Error(`Erro ao baixar imagem do board: ${src} — ${res.status}`)
      buffers.push(Buffer.from(await res.arrayBuffer()))
    } else {
      buffers.push(await fs.readFile(src))
    }
  }
  return buffers
}
