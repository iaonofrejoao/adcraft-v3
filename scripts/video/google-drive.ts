/**
 * scripts/video/google-drive.ts
 * Upload de clips de vídeo/imagem para o Google Drive com nomenclatura padronizada.
 *
 * Auth (prioridade):
 *   1. OAuth2 refresh token: GOOGLE_DRIVE_REFRESH_TOKEN + CLIENT_ID_OAUTH + SECRET_CLIENT_KEY_OAUTH
 *   2. Service Account JWT:  GOOGLE_SERVICE_ACCOUNT_JSON ou GOOGLE_SERVICE_ACCOUNT_PATH
 *
 * Nomenclatura de arquivo:
 *   {sku}_{storyboard_tag}_cena{N:02d}_{section}.mp4
 *   ex: CITX_v1_H1_B2_C3_VID_cena01_hook.mp4
 *
 * Uso standalone (teste):
 *   npx tsx scripts/video/google-drive.ts --test --folder-id <id> --file /tmp/test.mp4
 */

import * as dotenv    from 'dotenv'
import * as path      from 'path'
import * as fs        from 'node:fs/promises'
import { createReadStream } from 'node:fs'
import { parseArgs }  from 'node:util'
import { Readable }   from 'node:stream'

dotenv.config({ path: path.resolve(__dirname, '../../.env') })

const DRIVE_UPLOAD_BASE = 'https://www.googleapis.com/upload/drive/v3/files'
const DRIVE_FILES_BASE  = 'https://www.googleapis.com/drive/v3/files'
const DRIVE_SCOPE       = 'https://www.googleapis.com/auth/drive.file'
const TOKEN_URI         = 'https://oauth2.googleapis.com/token'

// ── Auth ─────────────────────────────────────────────────────────────────────

let _cachedToken: { token: string; expiresAt: number } | null = null

async function getAccessToken(): Promise<string> {
  if (_cachedToken && Date.now() < _cachedToken.expiresAt - 60_000) {
    return _cachedToken.token
  }

  const refreshToken = process.env.GOOGLE_DRIVE_REFRESH_TOKEN
  if (refreshToken) {
    return getTokenViaOAuth2(refreshToken)
  }

  return getTokenViaServiceAccount()
}

async function getTokenViaOAuth2(refreshToken: string): Promise<string> {
  const clientId     = process.env.CLIENT_ID_OAUTH
  const clientSecret = process.env.SECRET_CLIENT_KEY_OAUTH
  if (!clientId || !clientSecret) {
    throw new Error('CLIENT_ID_OAUTH e SECRET_CLIENT_KEY_OAUTH precisam estar no .env')
  }

  const res = await fetch(TOKEN_URI, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    new URLSearchParams({
      grant_type:    'refresh_token',
      refresh_token: refreshToken,
      client_id:     clientId,
      client_secret: clientSecret,
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Falha ao renovar token OAuth2: ${res.status} — ${text}`)
  }

  const data = await res.json() as { access_token: string; expires_in: number }
  _cachedToken = { token: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 }
  return _cachedToken.token
}

async function getTokenViaServiceAccount(): Promise<string> {
  const key = await loadServiceAccountKey()

  const now      = Math.floor(Date.now() / 1000)
  const expiry   = now + 3600
  const tokenUri = key.token_uri ?? TOKEN_URI

  const header  = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const payload = btoa(JSON.stringify({ iss: key.client_email, scope: DRIVE_SCOPE, aud: tokenUri, exp: expiry, iat: now }))

  const signingInput = `${header}.${payload}`
  const signature    = await signRS256(signingInput, key.private_key)
  const jwt          = `${signingInput}.${signature}`

  const res = await fetch(tokenUri, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Falha ao obter access token do Drive: ${res.status} — ${text}`)
  }

  const data = await res.json() as { access_token: string; expires_in: number }
  _cachedToken = { token: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 }
  return _cachedToken.token
}

async function loadServiceAccountKey(): Promise<ServiceAccountKey> {
  const jsonStr = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
  if (jsonStr) return JSON.parse(jsonStr) as ServiceAccountKey

  const keyPath = process.env.GOOGLE_SERVICE_ACCOUNT_PATH
  if (keyPath) {
    const content = await fs.readFile(keyPath, 'utf-8')
    return JSON.parse(content) as ServiceAccountKey
  }

  throw new Error(
    'Credenciais do Drive não encontradas. ' +
    'Defina GOOGLE_SERVICE_ACCOUNT_JSON (JSON string) ou GOOGLE_SERVICE_ACCOUNT_PATH (caminho para arquivo .json)',
  )
}

async function signRS256(data: string, privateKeyPem: string): Promise<string> {
  const { createSign } = await import('node:crypto')
  const sign = createSign('RSA-SHA256')
  sign.update(data)
  const sig = sign.sign(privateKeyPem)
  // Base64url encode
  return sig.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

// ── Operações do Drive ────────────────────────────────────────────────────────

/**
 * Cria (ou encontra existente) uma pasta no Drive.
 * Se já existir pasta com o mesmo nome dentro do parentFolderId, retorna o ID existente.
 */
export async function ensureFolder(name: string, parentFolderId: string): Promise<string> {
  const token = await getAccessToken()

  // Verificar se já existe
  const q = encodeURIComponent(
    `name='${name}' and mimeType='application/vnd.google-apps.folder' and '${parentFolderId}' in parents and trashed=false`,
  )
  const searchRes = await fetch(`${DRIVE_FILES_BASE}?q=${q}&fields=files(id)`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (searchRes.ok) {
    const { files } = await searchRes.json() as { files: Array<{ id: string }> }
    if (files.length > 0) return files[0].id
  }

  // Criar pasta
  const createRes = await fetch(DRIVE_FILES_BASE, {
    method:  'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify({
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents:  [parentFolderId],
    }),
  })
  if (!createRes.ok) {
    const text = await createRes.text()
    throw new Error(`Erro ao criar pasta no Drive: ${createRes.status} — ${text}`)
  }
  const { id } = await createRes.json() as { id: string }
  return id
}

/**
 * Faz upload de um arquivo (Buffer) para o Drive.
 * Retorna { fileId, webViewLink, directUrl } — directUrl serve direto em <img>/<video>.
 */
export async function saveClip(
  clipBuffer: Buffer,
  filename: string,
  parentFolderId: string,
  mimeType = 'video/mp4',
): Promise<{ fileId: string; webViewLink: string; directUrl: string }> {
  const token = await getAccessToken()

  const metadata = JSON.stringify({ name: filename, parents: [parentFolderId] })
  const boundary = '----FileBoundary'

  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`),
    Buffer.from(metadata),
    Buffer.from(`\r\n--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`),
    clipBuffer,
    Buffer.from(`\r\n--${boundary}--`),
  ])

  const res = await fetch(`${DRIVE_UPLOAD_BASE}?uploadType=multipart&fields=id,webViewLink`, {
    method:  'POST',
    headers: {
      Authorization:  `Bearer ${token}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
      'Content-Length': String(body.byteLength),
    },
    body,
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Erro ao fazer upload para Drive: ${res.status} — ${text}`)
  }

  const file = await res.json() as { id: string; webViewLink: string }

  // Tornar publicamente acessível (leitor)
  await fetch(`${DRIVE_FILES_BASE}/${file.id}/permissions`, {
    method:  'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify({ role: 'reader', type: 'anyone' }),
  })

  return {
    fileId:      file.id,
    webViewLink: file.webViewLink,
    directUrl:   `https://drive.google.com/uc?export=view&id=${file.id}`,
  }
}

/**
 * Monta o nome do arquivo seguindo a convenção do projeto.
 * Exemplo: CITX_v1_H1_B2_C3_VID_cena01_hook.mp4
 */
export function buildFilename(storyboardTag: string, sceneNumber: number, section: string): string {
  const paddedScene = String(sceneNumber).padStart(2, '0')
  return `${storyboardTag}_cena${paddedScene}_${section}.mp4`
}

// ── Estrutura de pastas padronizada ──────────────────────────────────────────
//
// adcraft_files/
// ├── images/
// │   ├── personas/{SKU}/          ← character boards
// │   └── graphics/{nome}/         ← artes futuras
// └── videos/{storyboard_tag}/     ← clips por criativo

const _folderCache: Record<string, string> = {}

async function resolveFolder(...segments: string[]): Promise<string> {
  const key      = segments.join('/')
  if (_folderCache[key]) return _folderCache[key]

  const rootId = process.env.GOOGLE_DRIVE_FOLDER_ID
  if (!rootId) throw new Error('GOOGLE_DRIVE_FOLDER_ID não definido no .env')

  let parentId = rootId
  for (const name of segments) {
    const cacheKey = segments.slice(0, segments.indexOf(name) + 1).join('/')
    if (_folderCache[cacheKey]) {
      parentId = _folderCache[cacheKey]
    } else {
      parentId = await ensureFolder(name, parentId)
      _folderCache[cacheKey] = parentId
    }
  }

  _folderCache[key] = parentId
  return parentId
}

/**
 * Salva imagem de character board em adcraft_files/images/personas/{sku}/
 */
export async function savePersonaImageToDrive(
  buffer:   Buffer,
  sku:      string,
  filename: string,
): Promise<{ fileId: string; directUrl: string }> {
  const folderId = await resolveFolder('adcraft_files', 'images', 'personas', sku)
  const { fileId, directUrl } = await saveClip(buffer, filename, folderId, 'image/png')
  return { fileId, directUrl }
}

/**
 * Salva clip de vídeo em adcraft_files/videos/{storyboardTag}/
 */
export async function saveVideoClipToDrive(
  buffer:        Buffer,
  storyboardTag: string,
  filename:      string,
): Promise<{ fileId: string; directUrl: string }> {
  const folderId = await resolveFolder('adcraft_files', 'videos', storyboardTag)
  const { fileId, directUrl } = await saveClip(buffer, filename, folderId, 'video/mp4')
  return { fileId, directUrl }
}

// ── CLI de teste ──────────────────────────────────────────────────────────────

if (require.main === module) {
  const { values: args } = parseArgs({
    args: process.argv.slice(2),
    options: {
      test:      { type: 'boolean' },
      'folder-id': { type: 'string' },
      file:      { type: 'string' },
      name:      { type: 'string' },
    },
  })

  if (!args.test) {
    console.error('Use --test para rodar em modo standalone')
    process.exit(1)
  }

  ;(async () => {
    const folderId = args['folder-id'] ?? process.env.GOOGLE_DRIVE_FOLDER_ID
    if (!folderId) throw new Error('--folder-id obrigatório (ou GOOGLE_DRIVE_FOLDER_ID)')

    const filePath = args.file ?? '/tmp/test-video.mp4'
    const filename = args.name ?? 'TEST_v1_H1_B2_C3_VID_cena01_hook.mp4'

    console.log(`Criando pasta de teste no Drive...`)
    const subFolderId = await ensureFolder('AdCraft-Test', folderId)
    console.log(`Pasta criada/encontrada: ${subFolderId}`)

    console.log(`Fazendo upload de ${filePath}...`)
    const buf = await fs.readFile(filePath)
    const url = await saveClip(buf, filename, subFolderId)
    console.log(`Upload concluído: ${url}`)
  })().catch(e => { console.error(e); process.exit(1) })
}
