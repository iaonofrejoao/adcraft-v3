/**
 * Obtém o refresh token OAuth2 para o Google Drive.
 * Inicia um servidor local na porta 8080, abre o browser, captura o código
 * e troca pelo refresh token automaticamente.
 *
 * Uso: npx tsx scripts/auth/get-drive-refresh-token.ts
 */
import * as dotenv from 'dotenv'
import * as path from 'path'
import * as http from 'node:http'
import { exec } from 'node:child_process'

dotenv.config({ path: path.resolve(__dirname, '../../.env') })

const CLIENT_ID     = process.env.CLIENT_ID_OAUTH!
const CLIENT_SECRET = process.env.SECRET_CLIENT_KEY_OAUTH!
const REDIRECT_URI  = 'http://localhost:8080'
const SCOPE         = 'https://www.googleapis.com/auth/drive.file'

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('CLIENT_ID_OAUTH e SECRET_CLIENT_KEY_OAUTH precisam estar no .env')
  process.exit(1)
}

const authUrl =
  `https://accounts.google.com/o/oauth2/v2/auth` +
  `?client_id=${CLIENT_ID}` +
  `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
  `&response_type=code` +
  `&scope=${encodeURIComponent(SCOPE)}` +
  `&access_type=offline` +
  `&prompt=consent`

console.log('\n🔐 Abrindo navegador para autorização do Google Drive...')
console.log('\nSe não abrir automaticamente, cole esta URL no navegador:')
console.log('\x1b[33m' + authUrl + '\x1b[0m')

// Abrir no Windows
exec(`start "" "${authUrl}"`)

// Servidor local para capturar o código
const server = http.createServer(async (req, res) => {
  const url    = new URL(req.url!, `http://localhost:8080`)
  const code   = url.searchParams.get('code')
  const error  = url.searchParams.get('error')

  if (error) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    res.end(`<h2>❌ Erro: ${error}</h2>`)
    server.close()
    process.exit(1)
  }

  if (!code) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    res.end('<h2>Aguardando autorização...</h2>')
    return
  }

  // Trocar code por tokens
  console.log('\n✅ Código recebido. Trocando por refresh token...')

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id:     CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri:  REDIRECT_URI,
      grant_type:    'authorization_code',
    }),
  })

  const tokens = await tokenRes.json() as {
    access_token:  string
    refresh_token: string
    expires_in:    number
    error?:        string
  }

  if (tokens.error || !tokens.refresh_token) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    res.end(`<h2>❌ Erro ao obter tokens: ${tokens.error ?? 'refresh_token vazio'}</h2>`)
    console.error('Erro:', tokens)
    server.close()
    process.exit(1)
  }

  // Exibir resultado
  console.log('\n\x1b[32m✅ REFRESH TOKEN OBTIDO COM SUCESSO!\x1b[0m')
  console.log('\nAdicione no .env:')
  console.log('\x1b[36m' + `GOOGLE_DRIVE_REFRESH_TOKEN=${tokens.refresh_token}` + '\x1b[0m')

  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
  res.end(`
    <html><body style="font-family:sans-serif;padding:40px;background:#111;color:#eee">
      <h2 style="color:#4ade80">✅ Autorizado com sucesso!</h2>
      <p>Volte ao terminal para copiar o refresh token.</p>
      <p style="color:#888;font-size:13px">Você pode fechar esta aba.</p>
    </body></html>
  `)

  server.close()
  process.exit(0)
})

server.listen(8080, () => {
  console.log('\n⏳ Aguardando autorização em http://localhost:8080 ...\n')
})
