/**
 * @deprecated Substituído por setup-character-board.ts (Nano Banana + GEMINI_API_KEY).
 * Mantido para referência histórica. Não é mais chamado pelo pipeline ativo.
 *
 * scripts/video/setup-persona.ts
 * Setup completo da persona visual e vocal de um produto.
 *
 * Fases:
 *   1. Flux 1.1 Pro (Replicate) → 6 fotos da persona em poses distintas
 *   2. HeyGen → criar avatar customizado com as fotos
 *   3. ElevenLabs → selecionar voz compatível com o perfil
 *   4. Atualizar persona_assets no banco (status: 'ready')
 *
 * Uso:
 *   npx tsx scripts/video/setup-persona.ts \
 *     --product-id <uuid> \
 *     [--pipeline-id <uuid>]   # opcional — vincula ao pipeline ativo
 *     [--dry-run]              # executa apenas Flux, exibe fotos e encerra
 *     [--skip-heygen]          # pula HeyGen (útil para testes sem cota)
 *
 * Variáveis de ambiente necessárias:
 *   REPLICATE_API_TOKEN, HEYGEN_API_KEY, ELEVENLABS_API_KEY
 *   DATABASE_URL / SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import { parseArgs } from 'node:util';
import { supabase } from '../../workers/lib/db';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// ── Types ─────────────────────────────────────────────────────────────────────

interface CharacterData {
  characters: Array<{
    physical_description: {
      age_appearance: string
      gender:         string
      ethnicity:      string
      hair:           string
      style:          string
      expression:     string
    }
    visual_anchors: {
      clothing_color:    string
      primary_setting:   string
      lighting:          string
    }
    character_role: string
    image_prompt_en: string
  }>
  primary_character_id?: string
}

interface ElevenLabsVoice {
  voice_id:    string
  name:        string
  category:    string
  labels:      Record<string, string>
}

// ── Replicate — Flux 1.1 Pro ──────────────────────────────────────────────────

const POSES = [
  'front view, facing camera directly, neutral expression with slight warm smile',
  'three-quarter left angle, slightly turned, smiling naturally',
  'three-quarter right angle, mirror of previous pose, warm expression',
  'close-up facial portrait, full face, authentic genuine expression',
  'full body shot, showing complete outfit from head to toe',
  'looking slightly above camera, storytelling UGC perspective, candid',
]

async function generatePhoto(basePrompt: string, pose: string, token: string): Promise<string> {
  const prompt = `${basePrompt}, ${pose}, high resolution portrait photography, consistent lighting, neutral or white background, photorealistic, professional headshot quality, no text, no watermark`

  const response = await fetch('https://api.replicate.com/v1/models/black-forest-labs/flux-1.1-pro/predictions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Prefer: 'wait',
    },
    body: JSON.stringify({
      input: {
        prompt,
        aspect_ratio:      '2:3',
        output_format:     'jpeg',
        output_quality:    90,
        safety_tolerance:  2,
        prompt_upsampling: true,
      },
    }),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Replicate error ${response.status}: ${text}`)
  }

  const prediction = await response.json() as { status: string; output?: string | string[]; error?: string }

  if (prediction.error) throw new Error(`Replicate prediction error: ${prediction.error}`)

  const output = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output
  if (!output) throw new Error('Replicate retornou output vazio')

  return output as string
}

async function generateAllPhotos(character: CharacterData['characters'][0], token: string): Promise<string[]> {
  const basePrompt = character.image_prompt_en
  const photos: string[] = []

  for (let i = 0; i < POSES.length; i++) {
    const pose = POSES[i]
    console.log(`  [Flux] Pose ${i + 1}/${POSES.length}: ${pose.split(',')[0]}…`)

    let url = ''
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        url = await generatePhoto(basePrompt, pose, token)
        break
      } catch (err) {
        console.warn(`    Tentativa ${attempt + 1} falhou:`, (err as Error).message)
        if (attempt === 1) throw err
        await sleep(2000)
      }
    }
    photos.push(url)
    await sleep(1000) // throttle entre fotos
  }

  return photos
}

// ── HeyGen — Avatar ───────────────────────────────────────────────────────────

async function createHeyGenAvatar(
  productName: string,
  photoUrls:   string[],
  apiKey:      string,
): Promise<string> {
  console.log('  [HeyGen] Criando avatar customizado…')

  const res = await fetch('https://api.heygen.com/v2/photo_avatar', {
    method: 'POST',
    headers: {
      'X-Api-Key':    apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name:   `${productName} Persona`,
      image_url:  photoUrls[0],       // foto frontal como principal
      extra_image_urls: photoUrls.slice(1), // demais poses
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`HeyGen create avatar error ${res.status}: ${text}`)
  }

  const data = await res.json() as { data?: { avatar_id?: string }; error?: string }
  if (data.error) throw new Error(`HeyGen error: ${data.error}`)

  const avatarId = data.data?.avatar_id
  if (!avatarId) throw new Error('HeyGen não retornou avatar_id')

  console.log(`  [HeyGen] Avatar submetido: ${avatarId}. Aguardando processamento…`)

  // Polling até ready ou timeout (15 minutos)
  const timeoutMs = 15 * 60 * 1000
  const startAt   = Date.now()
  while (Date.now() - startAt < timeoutMs) {
    await sleep(30_000)

    const pollRes = await fetch(`https://api.heygen.com/v2/photo_avatar/${avatarId}`, {
      headers: { 'X-Api-Key': apiKey },
    })
    const pollData = await pollRes.json() as { data?: { status?: string }; error?: string }
    const status   = pollData.data?.status

    console.log(`  [HeyGen] Status: ${status}`)
    if (status === 'ready') return avatarId
    if (status === 'failed') throw new Error(`HeyGen avatar processing failed for ${avatarId}`)
  }

  throw new Error('HeyGen avatar timeout (15 minutos excedido)')
}

// ── ElevenLabs — Voz ─────────────────────────────────────────────────────────

// Fallbacks por gênero/idioma para garantir que sempre há uma voz válida
const VOICE_FALLBACKS: Record<string, string> = {
  'female-pt': 'EXAVITQu4vr4xnSDxMaL', // Bella — conversacional
  'male-pt':   'ErXwobaYiN019PkySvjV', // Antoni — conversacional
  'female-en': '21m00Tcm4TlvDq8ikWAM', // Rachel — americano
  'male-en':   'TxGEqnHWrfWFTfGW9XjX', // Josh — americano
}

async function selectElevenLabsVoice(
  character:      CharacterData['characters'][0],
  targetLanguage: string,
  apiKey:          string,
): Promise<string> {
  console.log('  [ElevenLabs] Buscando vozes disponíveis…')

  const gender  = character.physical_description.gender
  const langKey = targetLanguage.startsWith('pt') ? 'pt' : 'en'
  const fallbackKey = `${gender === 'female' ? 'female' : 'male'}-${langKey}`

  try {
    const res = await fetch('https://api.elevenlabs.io/v1/voices', {
      headers: { 'xi-api-key': apiKey },
    })
    if (!res.ok) throw new Error(`ElevenLabs voices error ${res.status}`)

    const data  = await res.json() as { voices: ElevenLabsVoice[] }
    const voices = data.voices.filter(v => v.category === 'premade')

    // Preferência 1: idioma + gênero + conversational/warm
    const ideal = voices.find(v => {
      const labels = v.labels ?? {}
      const isGender  = (gender === 'female' ? v.name.match(/bella|rachel|elli|domi|jessie/i) : v.name.match(/adam|josh|arnold|sam|antoni/i))
      const isLang    = langKey === 'pt' ? (labels['language'] ?? '').includes('pt') : (labels['accent'] ?? '').includes('american')
      return isGender && isLang
    })

    if (ideal) {
      console.log(`  [ElevenLabs] Voz selecionada: ${ideal.name} (${ideal.voice_id})`)
      return ideal.voice_id
    }
  } catch (err) {
    console.warn(`  [ElevenLabs] Falha ao buscar vozes: ${(err as Error).message}. Usando fallback.`)
  }

  const fallbackId = VOICE_FALLBACKS[fallbackKey] ?? VOICE_FALLBACKS['female-pt']
  console.log(`  [ElevenLabs] Usando fallback: ${fallbackKey} → ${fallbackId}`)
  return fallbackId
}

// ── Database ──────────────────────────────────────────────────────────────────

async function getOrCreatePersonaRecord(productId: string, pipelineId?: string): Promise<string> {
  // Verifica se já existe um registro em criação ou pronto
  const { data: existing } = await supabase
    .from('persona_assets')
    .select('id, status')
    .eq('product_id', productId)
    .in('status', ['creating', 'ready'])
    .maybeSingle()

  if (existing) {
    if (existing.status === 'ready') {
      throw new Error(`Persona já existe para este produto (status: ready). Use --force para regenerar.`)
    }
    console.log(`  [DB] Retomando registro persona_assets existente: ${existing.id}`)
    return existing.id
  }

  const { data, error } = await supabase
    .from('persona_assets')
    .insert({
      product_id:  productId,
      pipeline_id: pipelineId ?? null,
      status:      'creating',
    })
    .select('id')
    .single()

  if (error) throw error
  console.log(`  [DB] Registro persona_assets criado: ${(data as { id: string }).id}`)
  return (data as { id: string }).id
}

async function updatePersonaStatus(
  personaId:          string,
  update:             {
    photos?:              string[]
    heygen_avatar_id?:    string
    elevenlabs_voice_id?: string
    status:               'creating' | 'ready' | 'failed'
    error_message?:       string
    completed_at?:        string
  }
) {
  const payload: Record<string, unknown> = { status: update.status }
  if (update.photos)              payload.photos              = update.photos
  if (update.heygen_avatar_id)    payload.heygen_avatar_id    = update.heygen_avatar_id
  if (update.elevenlabs_voice_id) payload.elevenlabs_voice_id = update.elevenlabs_voice_id
  if (update.error_message)       payload.error_message       = update.error_message
  if (update.completed_at)        payload.completed_at        = update.completed_at

  const { error } = await supabase
    .from('persona_assets')
    .update(payload)
    .eq('id', personaId)

  if (error) throw error
}

async function resolveCharacterArtifact(productId: string): Promise<CharacterData> {
  const { data, error } = await supabase
    .from('product_knowledge')
    .select('artifact_data')
    .eq('product_id', productId)
    .eq('artifact_type', 'character')
    .eq('status', 'fresh')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  if (!data) throw new Error(`Artefato 'character' não encontrado para produto ${productId}. Execute o pipeline criativo primeiro.`)

  return data.artifact_data as CharacterData
}

async function resolveProductName(productId: string): Promise<{ name: string; target_language: string }> {
  const { data, error } = await supabase
    .from('products')
    .select('name, target_language')
    .eq('id', productId)
    .maybeSingle()

  if (error) throw error
  if (!data) throw new Error(`Produto ${productId} não encontrado.`)
  return data as { name: string; target_language: string }
}

// ── Utils ─────────────────────────────────────────────────────────────────────

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      'product-id':  { type: 'string' },
      'pipeline-id': { type: 'string' },
      'dry-run':     { type: 'boolean' },
      'skip-heygen': { type: 'boolean' },
    },
  })

  const productId  = values['product-id']
  const pipelineId = values['pipeline-id']
  const dryRun     = values['dry-run']     ?? false
  const skipHeyGen = values['skip-heygen'] ?? false

  if (!productId) throw new Error('--product-id é obrigatório')

  const replicateToken   = process.env.REPLICATE_API_TOKEN
  const heygenKey        = process.env.HEYGEN_API_KEY
  const elevenlabsKey    = process.env.ELEVENLABS_API_KEY

  if (!replicateToken) throw new Error('REPLICATE_API_TOKEN não configurado')
  if (!skipHeyGen && !heygenKey) throw new Error('HEYGEN_API_KEY não configurado')
  if (!elevenlabsKey) throw new Error('ELEVENLABS_API_KEY não configurado')

  console.log(`\n[setup-persona] Produto: ${productId}`)

  // Resolver dados necessários
  const { name: productName, target_language } = await resolveProductName(productId)
  const characterData = await resolveCharacterArtifact(productId)
  const character = characterData.characters.find(
    c => c.character_id === characterData.primary_character_id
  ) ?? characterData.characters[0]

  console.log(`[setup-persona] Produto: ${productName} (${target_language})`)
  console.log(`[setup-persona] Persona: ${character.physical_description.gender}, ${character.physical_description.age_appearance}`)
  console.log(`[setup-persona] Idioma alvo: ${target_language}`)

  // ── Fase 1: Fotos ──
  console.log('\n[FASE 1] Gerando fotos via Flux 1.1 Pro…')
  const photos = await generateAllPhotos(character, replicateToken)
  console.log(`[FASE 1] ✓ ${photos.length} fotos geradas.`)
  photos.forEach((url, i) => console.log(`  Foto ${i + 1}: ${url}`))

  if (dryRun) {
    console.log('\n[DRY-RUN] Encerrando após Fase 1 (fotos). Nada salvo no banco.')
    return
  }

  // Criar registro no banco
  const personaId = await getOrCreatePersonaRecord(productId, pipelineId)
  await updatePersonaStatus(personaId, { status: 'creating', photos })
  console.log('[DB] Fotos salvas em persona_assets.')

  // ── Fase 2: HeyGen ──
  let heygenAvatarId: string | undefined
  if (!skipHeyGen && heygenKey) {
    console.log('\n[FASE 2] Criando avatar HeyGen…')
    try {
      heygenAvatarId = await createHeyGenAvatar(productName, photos, heygenKey)
      await updatePersonaStatus(personaId, { status: 'creating', heygen_avatar_id: heygenAvatarId })
      console.log(`[FASE 2] ✓ Avatar HeyGen: ${heygenAvatarId}`)
    } catch (err) {
      console.warn(`[FASE 2] ⚠ HeyGen falhou: ${(err as Error).message}. Continuando sem avatar.`)
    }
  } else {
    console.log('[FASE 2] Pulada (--skip-heygen).')
  }

  // ── Fase 3: ElevenLabs ──
  console.log('\n[FASE 3] Selecionando voz ElevenLabs…')
  const voiceId = await selectElevenLabsVoice(character, target_language, elevenlabsKey!)
  await updatePersonaStatus(personaId, { status: 'creating', elevenlabs_voice_id: voiceId })
  console.log(`[FASE 3] ✓ Voz: ${voiceId}`)

  // ── Finalizar ──
  await updatePersonaStatus(personaId, {
    status:               'ready',
    completed_at:         new Date().toISOString(),
    heygen_avatar_id:     heygenAvatarId,
    elevenlabs_voice_id:  voiceId,
  })

  console.log(`\n[setup-persona] ✓ Persona pronta! ID: ${personaId}`)
  console.log(`  Fotos:     ${photos.length} URLs`)
  console.log(`  HeyGen:    ${heygenAvatarId ?? '(sem avatar)'}`)
  console.log(`  ElevenLabs: ${voiceId}`)
  console.log(`  Status:    ready`)

  process.stdout.write(personaId + '\n')
}

main().catch(err => {
  console.error('\n[setup-persona] ERRO FATAL:', err.message)
  process.exit(1)
})
