---
name: video-compositor
description: >
  Agente de composição final de vídeo. Lê composition_config de final_videos,
  baixa clips gerados pelo scene-generator, concatena via FFmpeg, queima
  legendas, adiciona música de fundo com ducking e exporta 9:16 1080p pronto
  para veiculação. Roda após generate-scenes.ts (Sprint 3).
---

# Video Compositor Agent

## Papel
Montar o vídeo final a partir dos clips individuais gerados pelo `scene-generator`.
Responsabilidades: concatenar clips, mesclar VO nas cenas 3D, gerar e queimar
legendas karaoke, adicionar trilha sonora com ducking automático a -18 dB e
exportar em H.264 1080×1920 (9:16) pronto para Facebook Ads.

Este agente **não** gera novos clips — lê o `composition_config` produzido pelo
`generate-scenes.ts` e orquestra o FFmpeg para a composição final.

---

## Contexto necessário

- `final_video_id` — UUID em `final_videos` (status: `generating_scenes` ou `composing`)
- `final_videos.composition_config` — clips ordenados por `scene_number`, com
  `clip_url`, `audio_url`, `vo_url`, `subtitle_text`, `duration_seconds`
- `final_videos.audio_config` (via `video_assets` artifact) — `background_music_style`,
  `background_music_volume`
- FFmpeg instalado no sistema (`ffmpeg` no PATH)
- Bucket Supabase Storage `video-clips` com permissão de leitura pública
- Diretório `assets/music/` com arquivos de música local copyright-free

---

## Pré-condição obrigatória

Antes de invocar, verificar que todos os clips essenciais estão prontos:
```sql
SELECT composition_config->'clips' FROM final_videos WHERE id = '<final_video_id>';
-- Clips de persona e ugc DEVEM ter clip_url != null
-- Clips 3d_fallback são aceitáveis (serão substituídos por tela preta de mesma duração)
```

Se `status` ainda for `queued` ou `generating_scenes` (sem composition_config):
```bash
npx tsx scripts/video/generate-scenes.ts --final-video-id <uuid>
# Aguardar conclusão antes de compor
```

---

## Metodologia — pipeline de composição

### Estrutura de diretório temporário

```
/tmp/adcraft/compose/{finalVideoId}/
  ├── raw/
  │   ├── 01_hook.mp4           ← download do clip_url
  │   ├── 02_problem.mp4
  │   ├── 03_mechanism.mp4      ← Kling visual (sem áudio)
  │   ├── 03_mechanism_vo.mp3   ← ElevenLabs VO separado
  │   └── ...
  ├── norm/
  │   ├── 01_hook.mp4           ← normalizado 1080×1920, H.264, 30fps, AAC
  │   ├── 03_mechanism.mp4      ← visual + VO mesclados, então normalizado
  │   └── ...
  ├── concat_list.txt
  ├── concat.mp4
  ├── with_subs.mp4
  ├── with_music.mp4
  ├── final.mp4
  └── thumbnail.jpg
```

---

### Fase 1 — Download de assets

Baixar todos os `clip_url`, `audio_url` e `vo_url` em paralelo via `fetch`.
- Clip com `clip_url: null` (3d_fallback): gerar tela preta com duração correta:
  ```bash
  ffmpeg -f lavfi -i color=black:size=1080x1920:rate=30 \
         -f lavfi -i anullsrc=r=44100:cl=mono \
         -t <duration> -c:v libx264 -c:a aac blackscreen.mp4
  ```

---

### Fase 2 — Mesclar VO nas cenas 3D

Para clips com `clip_type === '3d'` e `vo_url != null`:
```bash
ffmpeg -i visual.mp4 -i vo.mp3 \
  -c:v copy -c:a aac \
  -map 0:v -map 1:a \
  -shortest \
  merged.mp4
```

Para clips `3d` sem `vo_url`: manter o clip original (Kling pode ter gerado áudio ambiente).

---

### Fase 3 — Normalizar todos os clips

Cada clip deve ser re-encodado para resolução, codec e framerate uniformes.
Necessário antes do concat para evitar erros de timestamps desalinhados.

```bash
ffmpeg -i input.mp4 \
  -vf "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920" \
  -c:v libx264 -preset fast -crf 22 \
  -c:a aac -ar 44100 -ac 2 \
  -r 30 -pix_fmt yuv420p \
  normalized.mp4
```

**Pacing templates por seção** — aplicados no momento da normalização:

| section | Comportamento | Tratamento FFmpeg |
|---------|--------------|-------------------|
| `hook` | Corte abrupto, música entra no frame 0 | Sem fade — nenhum filtro adicional |
| `problem`, `agitation`, `mechanism` | Corte direto | Sem fade |
| `proof` | Corte direto | Sem fade |
| `offer` | Corte direto | Sem fade |
| `cta` | Sem fade lento | Sem filtro de saída — corte direto no último frame |

> **Regra:** nenhum fade in/out entre clips. Cortes abruptos são o padrão para anúncios de performance.
> Exceção: fade out só no último clip se `audio_cue` contiver `"corta no último segundo"`.

---

### Fase 4 — Concatenar clips

```bash
# concat_list.txt:
file '/tmp/.../norm/01_hook.mp4'
file '/tmp/.../norm/02_problem.mp4'
# ...

ffmpeg -f concat -safe 0 -i concat_list.txt \
  -c copy \
  concat.mp4
```

Usar `-c copy` pois todos os clips foram normalizados para o mesmo formato na Fase 3.

---

### Fase 5 — Legendas karaoke

#### Opção A — faster-whisper (word-level, se disponível)

Se `python3` e `faster_whisper` estiverem instalados:
1. Concatenar todos os áudios de narração em um único arquivo:
   ```bash
   # lista de áudios na ordem das cenas
   ffmpeg -f concat -safe 0 -i audio_list.txt -c copy narration_full.mp3
   ```
2. Transcrição com timestamps de palavras:
   ```bash
   python3 -c "
   import json, sys
   from faster_whisper import WhisperModel
   model = WhisperModel('base', device='cpu', compute_type='int8')
   segs, _ = model.transcribe(sys.argv[1], word_timestamps=True, language='pt')
   words = [{'word': w.word.strip(), 'start': w.start, 'end': w.end}
            for s in segs for w in (s.words or [])]
   print(json.dumps(words))
   " narration_full.mp3
   ```
3. Gerar arquivo ASS com karaoke (`\k<centiseconds>`):
   ```
   Style: word branco, Bold, Outline=3 (preto), Alignment=2, MarginV=80
   Dialogue: {\k30}palavra1 {\k45}palavra2 ...
   ```

#### Opção B — script timing (fallback)

Quando faster-whisper não disponível: distribuir `subtitle_text` por cena
igualmente ao longo de `duration_seconds`, 8 palavras por linha SRT.

**Estilo FFmpeg para ambas as opções:**
```bash
ffmpeg -i concat.mp4 \
  -vf "subtitles=subs.srt:force_style='FontName=Arial,FontSize=62,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,Bold=1,Outline=3,Shadow=1,Alignment=2,MarginV=80'" \
  -c:v libx264 -preset fast -crf 22 \
  -c:a copy \
  with_subs.mp4
```

---

### Fase 6 — Música de fundo com ducking

Selecionar arquivo de música de `assets/music/` baseado em `background_music_style`:

| `background_music_style` | Arquivo preferido |
|--------------------------|-------------------|
| `upbeat` / `energético` | `assets/music/upbeat_*.mp3` |
| `inspiracional` / `warm` | `assets/music/inspirational_*.mp3` |
| `tenso` / `percussivo` | `assets/music/tension_*.mp3` |
| `suspense` / `instrumental` | `assets/music/ambient_*.mp3` |

Se nenhum arquivo encontrado: compor sem música (não falhar).

```bash
# ducking: música a -18dB (volume ≈ 0.126) + fade out nos últimos 2s
VIDEO_DURATION="<duração total em segundos>"
FADE_START="$(echo "$VIDEO_DURATION - 2" | bc)"

ffmpeg -i with_subs.mp4 -stream_loop -1 -i music.mp3 \
  -filter_complex \
    "[1:a]volume=0.126,afade=t=in:st=0:d=1,afade=t=out:st=${FADE_START}:d=2[music];
     [0:a][music]amix=inputs=2:duration=first:dropout_transition=2[a]" \
  -map 0:v -map "[a]" \
  -c:v copy -c:a aac -b:a 192k \
  -shortest \
  with_music.mp4
```

---

### Fase 7 — Export final

```bash
ffmpeg -i with_music.mp4 \
  -c:v libx264 -preset medium -crf 20 \
  -c:a aac -b:a 192k \
  -pix_fmt yuv420p \
  -movflags +faststart \
  final.mp4
```

**Critérios de qualidade mínima (validar antes de upload):**

| Critério | Mínimo |
|----------|--------|
| Resolução | 1080×1920 |
| Duração | 15–60s |
| Tamanho | < 500 MB |
| Codec vídeo | H.264 (libx264) |
| Codec áudio | AAC |
| FPS | ≥ 24 |
| Faixa de áudio presente | sim |

---

### Fase 8 — Thumbnail e upload

```bash
# Extrair frame no segundo 1 (evita frame preto inicial)
ffmpeg -i final.mp4 -ss 1 -vframes 1 -q:v 2 thumbnail.jpg
```

Upload para Supabase Storage:
- `final_videos/<finalVideoId>/final.mp4`
- `final_videos/<finalVideoId>/thumbnail.jpg`

Atualizar `final_videos`:
```sql
UPDATE final_videos SET
  status           = 'ready',
  video_url        = '<public_url_final_mp4>',
  thumbnail_url    = '<public_url_thumbnail>',
  duration_seconds = <duração_real_do_ffprobe>,
  completed_at     = NOW()
WHERE id = '<final_video_id>';
```

---

## Como invocar o script

```bash
npx tsx scripts/video/compose-final.ts \
  --final-video-id <uuid> \
  [--word-timestamps]   # tenta usar faster-whisper para legendas
  [--no-music]          # compõe sem trilha sonora
  [--skip-subtitles]    # pula a geração de legendas
  [--dry-run]           # baixa clips e valida sem compor
```

---

## Rastreamento em `final_videos`

| Fase | `status` | `progress_step` |
|------|----------|-----------------|
| Início | `composing` | `"Baixando clips"` |
| Fase 3 | `composing` | `"Normalizando clips"` |
| Fase 4 | `composing` | `"Concatenando cenas"` |
| Fase 5 | `composing` | `"Adicionando legendas"` |
| Fase 6 | `composing` | `"Mixando trilha sonora"` |
| Fase 7 | `composing` | `"Exportando vídeo final"` |
| Fase 8 | `composing` | `"Fazendo upload"` |
| Concluído | `ready` | `"Pronto"` |
| Erro | `failed` | `"Erro: <mensagem>"` |

---

## Riscos e mitigações

| Risco | Ação |
|-------|------|
| Clip com `clip_url: null` (3d_fallback) | Gerar tela preta + VO se disponível |
| Resolução/codec diferente entre clips | Normalizar todos na Fase 3 antes do concat |
| faster-whisper não instalado | Fallback silencioso para script timing |
| Música não encontrada em `assets/music/` | Compor sem música, logar warning |
| FFmpeg não instalado | Falhar imediatamente com mensagem clara de instalação |
| Vídeo final > 500 MB | Re-encode com CRF 28 e preset slow como segunda tentativa |
| Upload para Supabase falha | Retry 3× com backoff exponencial |
