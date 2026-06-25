/**
 * scripts/video/google-auth.ts
 * Auth helper para Gemini API usando service account (sem API key).
 * Usa google-auth-library para obter Bearer tokens a partir do JSON da conta de serviço.
 * O token é cacheado e renovado automaticamente pela biblioteca.
 */

import { GoogleAuth, AuthClient } from 'google-auth-library'
import * as path from 'node:path'
import * as fs from 'node:fs'

// Quando chamado por API routes do Next.js, o .env raiz do projeto não é carregado.
// Tentamos carregá-lo aqui como fallback, se disponível.
function loadRootEnvIfNeeded() {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) return
  try {
    const rootEnv = path.resolve(process.cwd(), '..', '.env')
    if (fs.existsSync(rootEnv)) {
      const lines = fs.readFileSync(rootEnv, 'utf-8').split('\n')
      for (const line of lines) {
        const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
        if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim()
      }
    }
  } catch {
    // silencioso — o env pode estar configurado de outra forma
  }
}

const SCOPES = [
  'https://www.googleapis.com/auth/cloud-platform',
  'https://www.googleapis.com/auth/generative-language',
]

let _client: AuthClient | null = null
let _auth: GoogleAuth | null = null

function resolveCredentialsPath(keyFile: string): string {
  if (path.isAbsolute(keyFile)) return keyFile

  // Tenta resolver a partir de vários diretórios candidatos:
  // 1. cwd() — pode ser frontend/ (Next.js) ou raiz do projeto (scripts)
  // 2. Um nível acima do cwd() — caso cwd() seja frontend/
  // 3. Dois níveis acima — caso cwd() seja frontend/app/...
  const candidates = [
    path.resolve(process.cwd(), keyFile),
    path.resolve(process.cwd(), '..', keyFile),
    path.resolve(process.cwd(), '../..', keyFile),
  ]

  for (const candidate of candidates) {
    try {
      require('fs').accessSync(candidate)
      return candidate
    } catch {
      // tenta o próximo
    }
  }

  // Se nenhum funcionar, retorna o primeiro (vai falhar com ENOENT, mas com path correto)
  return candidates[0]
}

async function getAuth(): Promise<GoogleAuth> {
  if (_auth) return _auth

  loadRootEnvIfNeeded()

  const keyFile = process.env.GOOGLE_APPLICATION_CREDENTIALS
  if (!keyFile) throw new Error('GOOGLE_APPLICATION_CREDENTIALS não definida no .env')

  const resolvedPath = resolveCredentialsPath(keyFile)

  _auth = new GoogleAuth({ keyFile: resolvedPath, scopes: SCOPES })
  return _auth
}

async function getClient(): Promise<AuthClient> {
  if (_client) return _client
  const auth = await getAuth()
  _client = await auth.getClient()
  return _client
}

export async function getProjectId(): Promise<string> {
  const auth = await getAuth()
  const projectId = await auth.getProjectId()
  if (!projectId) throw new Error('google-auth: não foi possível determinar o project ID')
  return projectId
}

export async function getBearerToken(): Promise<string> {
  const client = await getClient()
  const tokenResponse = await client.getAccessToken()
  if (!tokenResponse.token) throw new Error('google-auth: não foi possível obter access token')
  return tokenResponse.token
}

export async function getAuthHeaders(): Promise<Record<string, string>> {
  const token = await getBearerToken()
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  }
}
