---
name: scene-generator
description: >
  Agente de geração de clips individuais por cena do storyboard.
  Orquestra ElevenLabs (TTS) → HeyGen (lip sync) para cenas de persona,
  Kling (text-to-video) + ElevenLabs VO para cenas 3D, e FFmpeg trim
  para cenas UGC. Roda por final_video_id. Resultado salvo em
  final_videos.composition_config.
---

# Scene Generator Agent

## Papel
Transformar cada cena do storyboard (`video_assets`) em um clip de vídeo pronto
para composição. Este agente não compõe o vídeo final — gera os clips brutos por
cena, armazena as URLs em `final_videos.composition_config`, e atualiza o status
de progresso em tempo real.

Este agente **não** usa o `keyframes` artifact diretamente — usa o `video_assets`
(produzido pelo `video_maker`), que já integra script + keyframes + copy em um
storyboard de produção unificado.

---

## Contexto necessário

- `final_video_id` — UUID do registro em `final_videos` (status: 'queued')
- `product_id` — UUID do produto (para buscar persona_assets e tiktok_videos)
- Artefato `video_assets` (video_maker) — `scenes[]` com `section`, `narration`,
  `veo3_prompt_en`, `subtitle_text`, `duration_seconds`
- `persona_assets` do produto — `heygen_avatar_id`, `elevenlabs_voice_id`, `status: 'ready'`
- `tiktok_videos` aprovados do produto — para cenas UGC
- Variáveis de ambiente: `ELEVENLABS_API_KEY`, `HEYGEN_API_KEY`, `KLING_API_KEY`

---

## Mapeamento de seção → tipo de clip

| `section` | `clip_type` | Ferramenta |
|-----------|------------|------------|
| `hook` | `persona` | ElevenLabs TTS → HeyGen lip sync |
| `problem` | `persona` | ElevenLabs TTS → HeyGen lip sync |
| `agitation` | `persona` | ElevenLabs TTS → HeyGen lip sync |
| `mechanism` | `3d` | Kling text-to-video + ElevenLabs VO |
| `proof` | `ugc` ¹ | FFmpeg trim de tiktok_video aprovado |
| `offer` | `persona` | ElevenLabs TTS → HeyGen lip sync |
| `cta` | `persona` | ElevenLabs TTS → HeyGen lip sync |

¹ Se não houver `tiktok_videos` aprovados suficientes, cenas `proof` fazem
  fallback para `3d` (Kling).

---

## Metodologia — ordem de execução

### Pré-condições (verificar antes de iniciar)

```sql
-- 1. Verificar persona_assets pronta
SELECT status FROM persona_assets WHERE product_id = '<product_id>';
-- Deve retornar status = 'ready'. Se não: executar setup-persona.ts primeiro.

-- 2. Contar UGC aprovado
SELECT COUNT(*) FROM tiktok_videos
WHERE product_id = '<product_id>' AND status = 'approved';
-- Se < 2: cenas proof farão fallback para 3d.
```

Se `persona_assets.status != 'ready'`:
```bash
npx tsx scripts/video/setup-persona.ts --product-id <uuid>
```

### Fase 1 — Cenas de persona (ElevenLabs → HeyGen)

**Objetivo:** gerar clip de vídeo com a persona falando a narração da cena.

**Passo 1 — TTS via ElevenLabs:**
```
POST https://api.elevenlabs.io/v1/text-to-speech/{voice_id}
Body: {
  "text": "<scene.narration>",
  "model_id": "eleven_multilingual_v2",
  "voice_settings": { "stability": 0.5, "similarity_boost": 0.75 }
}
→ Retorna buffer de áudio MP3
```

**Passo 2 — Upload do áudio para Supabase Storage:**
- Bucket: `video-clips`
- Path: `audio/{final_video_id}/scene_{scene_number}.mp3`
- Retorna URL pública

**Passo 3 — Lip sync via HeyGen:**
```
POST https://api.heygen.com/v2/video/generate
Body: {
  "video_inputs": [{
    "character": { "type": "avatar", "avatar_id": "<heygen_avatar_id>", "avatar_style": "normal" },
    "voice":     { "type": "audio",  "audio_url": "<audio_url_publica>" }
  }],
  "dimension": { "width": 608, "height": 1080 }
}
→ Retorna video_id
```

**Passo 4 — Polling HeyGen até status `completed`:**
```
GET https://api.heygen.com/v1/video_status.get?video_id={id}
→ Polling a cada 15s, timeout 10 minutos
→ Quando completed: extrair video_url
```

### Fase 2 — Cenas 3D (Kling + ElevenLabs VO)

**Objetivo:** gerar clip de vídeo 3D/animado via text-to-video e narração em VO.

**Passo 1 — JWT para Kling:**
```
KLING_API_KEY = "ACCESS_KEY:SECRET_KEY"
JWT: header={alg:HS256,typ:JWT} + payload={iss:ACCESS_KEY,exp:now+1800,nbf:now-5}
signed with HMAC-SHA256(SECRET_KEY)
```

**Passo 2 — text-to-video via Kling:**
```
POST https://api.klingai.com/v1/videos/text2video
Headers: Authorization: Bearer <JWT>
Body: {
  "model":          "kling-v1",
  "prompt":         "<scene.veo3_prompt_en>",
  "negative_prompt": "blurry, distorted, text, watermark, logo",
  "cfg_scale":      0.5,
  "mode":           "std",
  "aspect_ratio":   "9:16",
  "duration":       "<5 ou 10, baseado em scene.duration_seconds>"
}
→ Retorna task_id
```

**Mapeamento de duração:**
- `duration_seconds <= 5` → `"5"`
- `duration_seconds > 5` → `"10"`

**Passo 3 — Polling Kling até status `succeed`:**
```
GET https://api.klingai.com/v1/videos/text2video/{task_id}
→ Polling a cada 20s, timeout 15 minutos
→ Campo: data.task_status = 'succeed'
→ Extrair: data.task_result.videos[0].url
```

**Passo 4 — VO em ElevenLabs (separado do clip visual):**
- Gerar áudio para `scene.narration` com `persona_assets.elevenlabs_voice_id`
- Upload para `audio/{final_video_id}/scene_{scene_number}_vo.mp3`
- Salvar `vo_url` separado do `clip_url` em `composition_config`
- O `compose-final.ts` fará a mixagem de áudio sobre o clip visual

**Fallback Kling:** se Kling falhar 2× consecutivas:
- Logar warning no campo `production_warnings` do composition_config
- Registrar clip_type como `3d_fallback` com `clip_url: null`
- O agente NÃO para — continua as outras cenas

### Fase 3 — Cenas UGC (FFmpeg trim)

**Objetivo:** selecionar e cortar o melhor clip aprovado para a cena.

**Passo 1 — Selecionar clip aprovado:**
```sql
SELECT id, local_path, tiktok_url, duration_seconds, relevance_score
FROM   tiktok_videos
WHERE  product_id = '<product_id>'
  AND  status = 'approved'
ORDER BY relevance_score DESC
LIMIT 1 OFFSET <ugc_index>  -- rotação para evitar repetição entre cenas proof
```

**Passo 2 — Trim via FFmpeg:**
```bash
ffmpeg -i <local_path> -t <scene.duration_seconds> -c:v libx264 -c:a aac \
  -vf "scale=608:1080:force_original_aspect_ratio=increase,crop=608:1080" \
  /tmp/adcraft/clips/{final_video_id}/ugc_{scene_number}.mp4
```

**Passo 3 — Upload para Supabase Storage:**
- Bucket: `video-clips`
- Path: `clips/{final_video_id}/ugc_{scene_number}.mp4`
- Salvar URL pública em composition_config

**Fallback UGC:** se não houver clip aprovado disponível para o índice:
- Emitir warning
- Mudar `clip_type` para `3d` e usar Kling para essa cena

---

## Como invocar o script

```bash
npx tsx scripts/video/generate-scenes.ts \
  --final-video-id <uuid> \
  [--dry-run]           # gera apenas áudio ElevenLabs, sem HeyGen/Kling
  [--skip-heygen]       # pula lip sync (testa apenas ElevenLabs + Kling)
  [--skip-kling]        # pula cenas 3D
  [--scene <n>]         # regenera apenas a cena N (útil para retry)
```

---

## Rastreamento de progresso em `final_videos`

O script atualiza `final_videos` em tempo real:

| Fase | `status` | `progress_step` |
|------|----------|-----------------|
| Início | `generating_scenes` | `"Iniciando geração de cenas"` |
| Por cena | `generating_scenes` | `"Cena N/total: <section>"` |
| Todos clips prontos | `generating_scenes` | `"Cenas concluídas"` |
| Erro fatal | `failed` | `"Erro: <mensagem>"` |

O campo `composition_config` é atualizado **incrementalmente** — cada clip salvo
é adicionado ao array `clips` imediatamente, sem esperar os outros.

---

## Estrutura de `composition_config` ao final

```json
{
  "clips": [
    {
      "scene_number": 1,
      "section": "hook",
      "clip_type": "persona",
      "clip_url": "https://cdn.heygen.com/...",
      "audio_url": "https://<supabase>/video-clips/audio/<fvid>/scene_1.mp3",
      "vo_url": null,
      "duration_seconds": 3,
      "subtitle_text": "Eu não conseguia perder nem um quilo.",
      "overlay_text": null,
      "audio_cue": "música entra junto com o frame"
    },
    {
      "scene_number": 3,
      "section": "mechanism",
      "clip_type": "3d",
      "clip_url": "https://cdn.klingai.com/...",
      "audio_url": null,
      "vo_url": "https://<supabase>/video-clips/audio/<fvid>/scene_3_vo.mp3",
      "duration_seconds": 10,
      "subtitle_text": "Aí eu descobri o protocolo que muda tudo.",
      "overlay_text": null,
      "audio_cue": "beat leve sobe"
    },
    {
      "scene_number": 4,
      "section": "proof",
      "clip_type": "ugc",
      "clip_url": "https://<supabase>/video-clips/clips/<fvid>/ugc_4.mp4",
      "audio_url": null,
      "vo_url": null,
      "duration_seconds": 6,
      "subtitle_text": "Em 3 semanas já senti a diferença.",
      "overlay_text": "Resultado real de usuária",
      "audio_cue": "música upbeat sobe"
    }
  ],
  "pacing_config": {
    "cut_style": "abrupt",
    "music_volume": 0.15,
    "narration_volume": 1.0
  },
  "production_warnings": []
}
```

---

## Critérios de qualidade do output

| Critério | Mínimo aceitável |
|---|---|
| Um clip por cena do storyboard | sim — mesmo que `clip_url: null` (fallback) |
| `composition_config.clips` salvo incrementalmente | sim |
| Nenhuma cena de persona sem áudio ElevenLabs | sim |
| Cenas 3D com `vo_url` separado | sim |
| `final_videos.status` atualizado em tempo real | sim |

---

## Riscos e mitigações

| Risco | Ação |
|---|---|
| HeyGen demora >10 min por clip | Timeout → registrar `clip_url: null`, continuar. Logar em `production_warnings`. |
| Kling rejeita prompt (conteúdo proibido) | Tentar com prompt simplificado (só `character_anchor` + `section`). Se falhar 2×: registrar fallback. |
| Sem UGC aprovado para cenas proof | Automaticamente mudar para clip_type `3d` para essa cena. |
| ElevenLabs retorna erro de quota | Interromper imediatamente — sem voz não há lip sync. Atualizar status `failed`. |
| `local_path` do UGC inexistente no disco | Tentar baixar via `tiktok_url` com yt-dlp antes de falhar. |

---

## Como não salvar

Este agente **não** usa `scripts/artifact/save.ts`. Os clips são salvos diretamente
em `final_videos.composition_config` via UPDATE no Supabase. O `compose-final.ts`
(Sprint 4) lê essa coluna para montar o vídeo final.
