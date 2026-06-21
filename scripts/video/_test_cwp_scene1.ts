/**
 * Teste: cena 1 (hook) com prompt Cinema Worldbuilder Pro 2.0
 * Usa Veo 3 Fast + character board como first frame (image-to-video)
 */
import * as dotenv from 'dotenv'
import * as path from 'path'
import * as fs from 'fs'
import { imageToVideo } from './veo3-client'
import { saveVideoClipToDrive } from './google-drive'

dotenv.config({ path: path.resolve(__dirname, '../../.env') })

// Forçar Fast para este teste
process.env.VEO3_MODEL_ID = 'veo-3.0-fast-generate-001'

const CHARACTER_BOARD = 'C:/Videos/AdCraft/personas/SUEA/board-1.png'
const OUTPUT_DIR      = 'C:/Videos/AdCraft/videos/SUEA_v1_H2_B3_C2_VID'
const OUTPUT_FILE     = path.join(OUTPUT_DIR, 'SUEA_v1_H2_B3_C2_VID_cena01_hook_CWP_v2.mp4')

// Prompt Cinema Worldbuilder Pro 2.0 — M1 Narrative, 100mm ECU, 5s
const CWP_PROMPT = `Scene & Mood: A woman alone in a kitchen catches herself mid-thought — the kind of offhand pause that precedes a statement nobody planned to say out loud. Two seconds of interior quiet, then the line lands like a correction.

Frame Map: Vertical 9:16 portrait frame. Subject anchored center-frame, x=50%, extreme close-up — eyes and upper face occupying the upper 65% of frame height, forehead near the top edge. Lower frame holds jaw and the collar of the sweatshirt. Kitchen background compressed into warm soft-focus planes. The face owns the full vertical frame; no open negative space on either side.

Subject Lock: Face, hair, sage green sweatshirt, and silhouette identical to the reference image throughout. Body squared to camera, shoulders slightly forward, chin level. Gaze 15–20° down-left for the first 2 seconds — soft, unfocused, mid-thought — then rises slowly, landing directly on the camera lens by second 3.5. Lips sealed between breaths; jaw relaxed. Hands offscreen. Face, hair, wardrobe, and silhouette identical throughout.

Cross-Frame Rules: Single subject. No other figure enters the frame. Subject holds center throughout; no lateral drift, no position change.

Movement: 0–2s: full stillness — downward gaze held, one slow controlled chest breath visible at the base of the frame, no mouth movement. 2–3.5s: eyes rise in a slow deliberate arc from down-left to direct lens contact, 1.5 seconds of travel. 3.5s: eyes lock to lens, lips part on the first syllable. 3.5–5s: line delivered in a low measured conversational cadence. Micro-motion throughout: subtle breath rise in the chest, fine hair-fiber movement from ambient airflow, a single controlled blink just before the gaze lifts. Background fully static. Camera holds a micro-tremor handheld with no push — only natural operator breath causing faint frame drift.

Last Frame: Subject center-frame ECU, eyes direct to lens, lips slightly parted after the final word, gaze steady and held. Kitchen background in warm soft defocus behind. No on-screen text, no captions, no signage typography, no rendered text in the frame.

World Plate: American suburban kitchen interior — white upper cabinets, butcher-block countertop in the compressed background, soft natural daylight from a left-side window off-frame. Mid-morning diffused quality, not harsh. Warm neutral palette. Counter objects suggest lived-in domesticity.

Sound Bed: Diegetic only — one slow controlled breath at second 1, faint room tone from AC airflow, subtle fabric micro-rustle at the shoulder on the breath, then speech across 3.5–5s. No music, no score, no background voices.

Capture Realism: Subject sits inside real depth — thin atmosphere suspended in the air between camera, subject, and the soft kitchen background, the background rendered softer, desaturated, and lower-contrast than the foreground so the face sits within the air rather than pasted on a flat plane. Skin reads true cinematic matte — zero shine on forehead, nose bridge, cheekbones, temples, chin, and collarbones, real peach fuzz catching light at the jaw and hairline, real soft fine even pore texture, light absorbed like true subsurface scattering, warmth preserved and natural, slightly desaturated but never pale or washed-out or cool-shifted, never plastic, never doll-skin, and never harsh — no acne, no blemishes, no enlarged or rough pores, fine flattering texture. Low-contrast curve — shadows lifted gently holding texture, highlights rolled off softly never clipping to white, nothing crushed to black. All specular highlights surgically removed from skin, hair, fabric, and surrounding surfaces, every pixel reading matte and diffuse. Slightly desaturated grade with warmth preserved.

Camera Capture: vertical 9:16 portrait orientation, wide-latitude cinema capture, vintage 100mm spherical character at a wide aperture — natural round bokeh, soft frame-edge falloff — light diffusion bloom softening highlights, micro-tremor handheld with natural operator breath, color-negative daylight film rendition with fine 35mm grain, teal-amber grade, shallow depth of field, 24fps 180° shutter, 5 seconds. Speaking in English: "Your afternoon cravings are not hunger. They're a broken blood sugar signal."`

;(async () => {
  console.log('=== Teste CWP-2.0 — Cena 1 Hook (Veo 3 Fast) ===')
  console.log(`Prompt: ${CWP_PROMPT.length} chars | ~${Math.round(CWP_PROMPT.split(' ').length)} palavras`)
  console.log()

  const imageBuf = fs.readFileSync(CHARACTER_BOARD)
  console.log(`Character board: ${(imageBuf.byteLength / 1024).toFixed(1)} KB`)
  console.log('Gerando via image-to-video...')
  console.log()

  const videoBuf = await imageToVideo(imageBuf, CWP_PROMPT, 5, '9:16')

  fs.mkdirSync(OUTPUT_DIR, { recursive: true })
  fs.writeFileSync(OUTPUT_FILE, videoBuf)
  console.log(`✓ Salvo: ${OUTPUT_FILE} (${(videoBuf.byteLength / 1024).toFixed(0)} KB)`)

  console.log('⬆ Subindo para o Drive...')
  const { directUrl } = await saveVideoClipToDrive(videoBuf, 'SUEA_v1_H2_B3_C2_VID', 'SUEA_v1_H2_B3_C2_VID_cena01_hook_CWP_v2.mp4')
  console.log(`✓ Drive: ${directUrl}`)
})().catch(e => { console.error('Erro:', e.message); process.exit(1) })
