import * as dotenv from 'dotenv'
import * as path from 'path'
import { GoogleAuth } from 'google-auth-library'

dotenv.config({ path: path.resolve(__dirname, '../../.env') })

const keyFile = process.env.GOOGLE_APPLICATION_CREDENTIALS!
const resolvedPath = path.isAbsolute(keyFile) ? keyFile : path.resolve(process.cwd(), keyFile)

const OP_ID   = process.argv[2]!
const MODEL   = 'veo-3.0-fast-generate-001'
const BASE    = 'https://generativelanguage.googleapis.com/v1beta'
const OP_NAME = `models/${MODEL}/operations/${OP_ID}`

;(async () => {
  // Verificar escopos do token atual (dual scope)
  const auth1 = new GoogleAuth({ keyFile: resolvedPath, scopes: ['https://www.googleapis.com/auth/cloud-platform', 'https://www.googleapis.com/auth/generative-language'] })
  const client1 = await auth1.getClient()
  const t1 = (await client1.getAccessToken()).token!
  const info1 = await fetch(`https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${t1}`)
  const data1 = await info1.json() as any
  console.log('=== Token dual scopes ===')
  console.log('scope:', data1.scope)
  console.log()

  // Testar GET com token SOMENTE generative-language
  const auth2 = new GoogleAuth({ keyFile: resolvedPath, scopes: ['https://www.googleapis.com/auth/generative-language'] })
  const client2 = await auth2.getClient()
  const t2 = (await client2.getAccessToken()).token!
  const info2 = await fetch(`https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${t2}`)
  const data2 = await info2.json() as any
  console.log('=== Token só generative-language ===')
  console.log('scope:', data2.scope)

  if (OP_ID) {
    const r = await fetch(`${BASE}/${OP_NAME}`, {
      headers: { Authorization: `Bearer ${t2}` },
    })
    const b = await r.text()
    console.log('\nGET poll com só generative-language scope:')
    console.log('Status:', r.status, '|', b.slice(0, 300))
  }
})().catch(e => console.error('Erro:', e.message))
