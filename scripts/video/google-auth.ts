/**
 * scripts/video/google-auth.ts
 * Auth helper para Gemini API usando service account (sem API key).
 * Usa google-auth-library para obter Bearer tokens a partir do JSON da conta de serviço.
 * O token é cacheado e renovado automaticamente pela biblioteca.
 */

import { GoogleAuth, AuthClient } from 'google-auth-library'
import * as path from 'node:path'

const SCOPES = [
  'https://www.googleapis.com/auth/cloud-platform',
  'https://www.googleapis.com/auth/generative-language',
]

let _client: AuthClient | null = null
let _auth: GoogleAuth | null = null

async function getAuth(): Promise<GoogleAuth> {
  if (_auth) return _auth

  const keyFile = process.env.GOOGLE_APPLICATION_CREDENTIALS
  if (!keyFile) throw new Error('GOOGLE_APPLICATION_CREDENTIALS não definida no .env')

  const resolvedPath = path.isAbsolute(keyFile)
    ? keyFile
    : path.resolve(process.cwd(), keyFile)

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
