/**
 * Diagnóstico completo do Vertex AI — testa o projeto e a service account configurados
 * e lista o que está funcionando / o que falta.
 */
import * as dotenv from 'dotenv'
import * as path from 'path'
import { getBearerToken, getProjectId } from './google-auth'

dotenv.config({ path: path.resolve(__dirname, '../../.env') })

const LOCATION = 'us-central1'
const MODEL     = 'veo-3.0-fast-generate-001'

;(async () => {
  const token     = await getBearerToken()
  const projectId = process.env.GOOGLE_CLOUD_PROJECT || await getProjectId()
  console.log('=== Diagnóstico Vertex AI ===')
  console.log('project_id configurado:', projectId)
  console.log()

  // 1. Vertex AI API habilitada?
  console.log('1) Testando Vertex AI API (listar modelos)...')
  const r1 = await fetch(
    `https://${LOCATION}-aiplatform.googleapis.com/v1beta/projects/${projectId}/locations/${LOCATION}/publishers/google/models`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  const b1 = await r1.text()
  if (r1.ok) {
    const models = JSON.parse(b1)
    const veoModels = (models.publisherModels || []).filter((m: any) => m.name?.includes('veo'))
    console.log('  ✅ Vertex AI API acessível')
    console.log('  Modelos Veo disponíveis:', veoModels.length ? veoModels.map((m: any) => m.name).join(', ') : '(nenhum)')
  } else {
    console.log('  ❌ Vertex AI API falhou — status:', r1.status)
    console.log('  Detalhe:', b1.slice(0, 300))
  }
  console.log()

  // 2. IAM — service account tem permissão?
  console.log('2) Testando IAM da service account...')
  const r2 = await fetch(
    `https://cloudresourcemanager.googleapis.com/v1/projects/${projectId}:testIamPermissions`,
    {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body:    JSON.stringify({ permissions: ['aiplatform.endpoints.predict', 'resourcemanager.projects.get'] }),
    }
  )
  const b2 = await r2.text()
  if (r2.ok) {
    const iam = JSON.parse(b2)
    console.log('  Permissões concedidas:', iam.permissions || '(nenhuma)')
    if (!(iam.permissions || []).includes('aiplatform.endpoints.predict')) {
      console.log('  ❌ Falta: aiplatform.endpoints.predict — adicionar roles/aiplatform.user à service account')
    } else {
      console.log('  ✅ Service account tem permissão Vertex AI')
    }
  } else {
    console.log('  Erro ao checar IAM — status:', r2.status, b2.slice(0, 200))
  }
  console.log()

  // 3. Veo 3 endpoint direto
  console.log('3) Testando endpoint Veo 3 predictLongRunning no Vertex AI...')
  const endpoint = `https://${LOCATION}-aiplatform.googleapis.com/v1beta/projects/${projectId}/locations/${LOCATION}/publishers/google/models/${MODEL}:predictLongRunning`
  const r3 = await fetch(endpoint, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body:    JSON.stringify({ instances: [{ prompt: 'test' }], parameters: { aspectRatio: '9:16', sampleCount: 1 } }),
  })
  const b3 = await r3.text()
  if (r3.ok) {
    console.log('  ✅ Veo 3 respondeu — operação criada:', JSON.parse(b3).name)
  } else {
    console.log('  ❌ Status:', r3.status)
    console.log('  Detalhe:', b3.slice(0, 400))
  }
  console.log()

  // 4. Verificar se o projeto ID no console é diferente
  console.log('4) Verificando project ID pelo token...')
  const r4 = await fetch(`https://cloudresourcemanager.googleapis.com/v1/projects/${projectId}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const b4 = await r4.text()
  if (r4.ok) {
    const proj = JSON.parse(b4)
    console.log('  ✅ Projeto existe:', proj.projectId, '| Nome:', proj.name, '| Status:', proj.lifecycleState)
  } else {
    console.log('  ❌ Projeto não encontrado — status:', r4.status)
    console.log('  Isso indica que o GOOGLE_CLOUD_PROJECT está errado')
    console.log('  Detalhe:', b4.slice(0, 300))
  }
})().catch(e => console.error('Erro:', e.message))
