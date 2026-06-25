/**
 * workers/lib/canvas/drive-upload.ts
 * Lib pura de upload para Google Drive com hierarquia AdCraft/{sku}/{combinationId}/{tipo}/.
 * Sem dotenv, sem parseArgs — pronta para ser chamada de API routes.
 */

const DRIVE_UPLOAD_BASE = 'https://www.googleapis.com/upload/drive/v3/files'
const DRIVE_FILES_BASE  = 'https://www.googleapis.com/drive/v3/files'
const TOKEN_URI         = 'https://oauth2.googleapis.com/token'
const DRIVE_SCOPE       = 'https://www.googleapis.com/auth/drive.file'

// ── Auth ─────────────────────────────────────────────────────────────────────

let _cachedToken: { token: string; expiresAt: number } | null = null

async function getAccessToken(): Promise<string> {
  if (_cachedToken && Date.now() < _cachedToken.expiresAt - 60_000) {
    return _cachedToken.token
  }

  const refreshToken = process.env.GOOGLE_DRIVE_REFRESH_TOKEN
  if (refreshToken) return getTokenViaOAuth2(refreshToken)
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
    body:    new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken, client_id: clientId, client_secret: clientSecret }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Falha ao renovar token OAuth2: ${res.status} — ${text}`)
  }

  const data = await res.json() as { access_token: string; expires_in: number }
  _cachedToken = { token: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 }
  return _cachedToken.token
}

interface ServiceAccountKey {
  client_email: string
  private_key:  string
  token_uri?:   string
}

async function getTokenViaServiceAccount(): Promise<string> {
  const jsonStr = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
  if (!jsonStr) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON ou GOOGLE_DRIVE_REFRESH_TOKEN precisam estar no .env')

  const key    = JSON.parse(jsonStr) as ServiceAccountKey
  const now    = Math.floor(Date.now() / 1000)
  const expiry = now + 3600
  const tokenUri = key.token_uri ?? TOKEN_URI

  const header  = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const payload = btoa(JSON.stringify({ iss: key.client_email, scope: DRIVE_SCOPE, aud: tokenUri, exp: expiry, iat: now }))
  const signingInput = `${header}.${payload}`

  const { createSign } = await import('node:crypto')
  const sign = createSign('RSA-SHA256')
  sign.update(signingInput)
  const signature = sign.sign(key.private_key).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
  const jwt = `${signingInput}.${signature}`

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

// ── Operações do Drive ────────────────────────────────────────────────────────

const _folderCache: Record<string, string> = {}

/**
 * Encontra ou cria uma pasta no Drive dentro de um parentId.
 */
export async function findOrCreateFolder(name: string, parentId: string): Promise<string> {
  const cacheKey = `${parentId}/${name}`
  if (_folderCache[cacheKey]) return _folderCache[cacheKey]

  const token = await getAccessToken()
  const q = encodeURIComponent(
    `name='${name}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`,
  )
  const searchRes = await fetch(`${DRIVE_FILES_BASE}?q=${q}&fields=files(id)`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (searchRes.ok) {
    const { files } = await searchRes.json() as { files: Array<{ id: string }> }
    if (files.length > 0) {
      _folderCache[cacheKey] = files[0].id
      return files[0].id
    }
  }

  const createRes = await fetch(DRIVE_FILES_BASE, {
    method:  'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify({ name, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] }),
  })
  if (!createRes.ok) {
    const text = await createRes.text()
    throw new Error(`Erro ao criar pasta no Drive: ${createRes.status} — ${text}`)
  }
  const { id } = await createRes.json() as { id: string }
  _folderCache[cacheKey] = id
  return id
}

/**
 * Faz upload de um Buffer para o Drive e torna publicamente legível.
 */
export async function uploadFile(
  buffer:   Buffer,
  filename: string,
  mimeType: string,
  folderId: string,
): Promise<{ fileId: string; driveUrl: string }> {
  const token    = await getAccessToken()
  const metadata = JSON.stringify({ name: filename, parents: [folderId] })
  const boundary = '----FileBoundary'

  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`),
    Buffer.from(metadata),
    Buffer.from(`\r\n--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`),
    buffer,
    Buffer.from(`\r\n--${boundary}--`),
  ])

  const res = await fetch(`${DRIVE_UPLOAD_BASE}?uploadType=multipart&fields=id`, {
    method:  'POST',
    headers: {
      Authorization:    `Bearer ${token}`,
      'Content-Type':   `multipart/related; boundary=${boundary}`,
      'Content-Length': String(body.byteLength),
    },
    body,
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Erro ao fazer upload para Drive: ${res.status} — ${text}`)
  }

  const file = await res.json() as { id: string }

  await fetch(`${DRIVE_FILES_BASE}/${file.id}/permissions`, {
    method:  'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify({ role: 'reader', type: 'anyone' }),
  })

  return {
    fileId:   file.id,
    driveUrl: `https://drive.google.com/uc?export=view&id=${file.id}`,
  }
}

/**
 * Upload com hierarquia automática: AdCraft/{sku}/{combinationId}/{nodeType}/
 */
export async function uploadToCanvasFolder(
  buffer:        Buffer,
  filename:      string,
  mimeType:      string,
  sku:           string,
  combinationId: string,
  nodeType:      string,
): Promise<{ fileId: string; driveUrl: string }> {
  const rootId = process.env.GOOGLE_DRIVE_FOLDER_ID
  if (!rootId) throw new Error('GOOGLE_DRIVE_FOLDER_ID não definido no .env')

  const adcraftId = await findOrCreateFolder('AdCraft', rootId)
  const skuId     = await findOrCreateFolder(sku, adcraftId)
  const comboId   = await findOrCreateFolder(combinationId, skuId)
  const typeId    = await findOrCreateFolder(nodeType, comboId)

  return uploadFile(buffer, filename, mimeType, typeId)
}

/**
 * Remove um arquivo do Drive.
 */
export async function deleteFile(fileId: string): Promise<void> {
  const token = await getAccessToken()
  await fetch(`${DRIVE_FILES_BASE}/${fileId}`, {
    method:  'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })
}
