# Fluxo de Geração de Vídeo — AdCraft v3

> Última atualização: 2026-06-08

---

## Visão geral

O pipeline de vídeo transforma uma combinação de copy (Hook + Body + CTA) em um criativo de 30–45s no formato 9:16 para tráfego pago. Envolve três camadas independentes: curadoria de UGC, configuração de persona e geração/composição de cenas.

---

## Camada 1 — Curadoria de UGC

UGC (User Generated Content) são vídeos reais do TikTok usados como B-roll e prova social nos criativos.

```
[Usuário clica "Coletar UGC" na aba TikTok do produto]
       │
       ▼
POST /api/products/[sku]/scrape-ugc
       │
       ▼
scripts/video/scrape-ugc.ts
  ├── Apify (clockworks~tiktok-hashtag-scraper) → até 20 vídeos por hashtag
  ├── Filtro de idioma via campo textLanguage (opcional: --language en)
  ├── Score de relevância local (keywords + engagement + duração)
  │     Fórmula: keyScore×0.6 + engagement×0.2 + durScore×0.2
  └── Upsert em tiktok_videos (status: 'pending')
       │
       ▼
[Usuário revisa cards na aba TikTok — thumbnail, handle, views, score]
       │
       ├── Aprovar  → PATCH /api/products/[sku]/tiktok-videos  { status: 'approved' }
       │                 ↳ dispara analyze-ugc em background (fire-and-forget)
       └── Rejeitar → PATCH { status: 'rejected' }
```

### Análise Gemini (ao aprovar)

O `analyze-ugc.ts` roda em background **sem bloquear a resposta do PATCH**.

**Modo preferencial — vídeo completo:**
1. yt-dlp baixa o MP4 para arquivo temporário (~15–30s)
2. Upload para Gemini Files API (~10s)
3. Aguarda estado `ACTIVE` (~5s)
4. `generateContent` com o vídeo completo — Gemini amostra frames ao longo de todo o vídeo, transcreve o áudio e entende a sequência temporal
5. Deleta o arquivo da Files API após análise
6. Limpa o arquivo temporário local

**Fallback — thumbnail:** se o download ou upload falhar por qualquer motivo, analisa a thumbnail estática + metadados textuais.

O campo `analysis_mode: 'video' | 'thumbnail'` é salvo no artefato para rastrear qual modo foi usado.

Extrai 16 campos estruturados incluindo `hook_text` (transcrição exata dos primeiros 3s), `copy_spoken` (copy falada completa), `cta_text`, `editing_pace`, `audio_energy` — campos que só são possíveis com análise de vídeo completo. Salva como artefato `ugc_reference` em `product_knowledge` com embedding para busca semântica futura.

### Biblioteca UGC global

A rota `/biblioteca` agrega vídeos de todos os produtos em uma única tela com filtros cruzados por nicho, produto, status e busca full-text. Alimentada por `useVideoLibrary` → `GET /api/biblioteca/tiktok-videos`.

### Player inline no frontend

O `VideoCard` usa `/api/video-proxy?url=<tiktok_url>` para reproduzir os vídeos sem restrições de Referer. O proxy (yt-dlp + range support) faz cache em arquivo temporário. Pre-warm no hover (`?warm=1`) garante que o arquivo esteja pronto quando o usuário clica.

---

## Camada 2 — Pipeline criativo → fila de vídeos

A geração do storyboard acontece dentro do pipeline de copy (Fase 2), **antes** de qualquer geração de vídeo real.

```
Pipeline Fase 2 (scripts/creative/generate-scripts-for-combination.ts)
       │
       ▼ Para cada combinação aprovada:
  script-writer.md      → artefato 'script'
  character-generator.md → artefato 'character'
  keyframe-generator.md  → artefato 'keyframes' (storyboard cena a cena)
  video-maker.md         → artefato 'video_assets' (metadata, sem geração real)
       │
       ▼
INSERT final_videos (status: 'queued', copy_combination_id)
```

O usuário aciona esse fluxo clicando em **"Gerar Script"** na aba de copies. O vídeo não é gerado aqui — apenas o storyboard é criado e a combinação entra na fila.

---

## Camada 3 — Geração real do vídeo

Acionado pelo comando `/adcraft_video_gerar` ou manualmente via:
```bash
npx tsx scripts/video/process-video-queue.ts --product-id <uuid>
```

```
process-video-queue.ts
       │
       ├── [PASSO 1] Verifica persona_assets
       │     Se não existe ou status ≠ 'ready':
       │       └── setup-persona.ts
       │             ├── Flux 1.1 Pro (Replicate) → 6 fotos em poses distintas
       │             │     Poses: frontal, 3/4 esq., 3/4 dir., close, corpo inteiro, UGC perspective
       │             ├── HeyGen → avatar customizado (polling até 15 min)
       │             └── ElevenLabs → voz selecionada por gênero + idioma do produto
       │             → persona_assets (status: 'ready')
       │
       ├── [PASSO 2] generate-scenes.ts
       │     Para cada cena do storyboard (artefato 'keyframes'):
       │
       │     Tipo 'persona':
       │       ElevenLabs TTS (narration) → upload Supabase Storage → HeyGen lip sync → clip URL
       │
       │     Tipo '3d':
       │       Kling text-to-video (veo3_prompt_en) → clip URL
       │       ElevenLabs TTS (narration) → VO URL separado
       │
       │     Tipo 'ugc':
       │       Busca tiktok_videos approved → trim FFmpeg → upload Supabase → clip URL
       │
       │     → generated_clips (um registro por cena)
       │
       └── [PASSO 3] compose-final.ts
             ├── Download de todos os clips/áudios para diretório temporário
             ├── Mescla VO nas cenas 3D (FFmpeg)
             ├── Normaliza clips para 1080×1920, H.264, 30fps
             ├── Concatena em ordem via concat demuxer
             ├── Queima legendas (SRT gerado do subtitle_text ou faster-whisper word-level)
             ├── Adiciona música de fundo com ducking -18dB
             ├── Export final: H.264, AAC 192k, faststart, 1080×1920
             └── Extrai thumbnail → upload Supabase Storage
             → final_videos (status: 'ready', video_url, thumbnail_url, duration_seconds)
```

---

## Estrutura do criativo (template 30–45s)

```
0s  – 3s   HOOK VISUAL
           Persona olha direto para câmera, frase de impacto.
           Corte abrupto. Música entra junto.

3s  – 12s  AGITAÇÃO DO PROBLEMA
           Persona falando (HeyGen lip sync).
           Intercala com UGC clip como B-roll.

12s – 25s  SOLUÇÃO + DEMONSTRAÇÃO
           Cena 3D do produto (Kling + VO ElevenLabs).
           UGC clip de pessoa usando o produto.
           Persona reage / valida.

25s – 35s  PROVA SOCIAL
           UGC clips com resultados reais.
           Texto overlay: depoimentos, números.

35s – 42s  CTA DIRETO
           Persona fala CTA + urgência.
           Última tela: produto + link.
```

---

## Toolchain

| Função | Ferramenta | Script |
|--------|-----------|--------|
| Scraping TikTok | Apify (clockworks~tiktok-hashtag-scraper) | `scrape-ugc.ts` |
| Scoring de relevância | Algoritmo local (sem API) | `scrape-ugc.ts` |
| Análise de UGC | Gemini Vision (thumbnail + metadados) | `analyze-ugc.ts` |
| Player no frontend | yt-dlp via `/api/video-proxy` | `route.ts` |
| Fotos da persona | Flux 1.1 Pro (Replicate) | `setup-persona.ts` |
| Avatar falando | HeyGen (photo avatar + lip sync) | `setup-persona.ts` / `generate-scenes.ts` |
| Voz | ElevenLabs (premade voices) | `setup-persona.ts` / `generate-scenes.ts` |
| Cenas 3D | Kling AI (text-to-video) | `generate-scenes.ts` |
| Composição | FFmpeg (concat, mix, overlay) | `compose-final.ts` |
| Legendas | SRT estático ou faster-whisper (word-level) | `compose-final.ts` |
| Música de fundo | Biblioteca local, ducking -18dB | `compose-final.ts` |

---

## Variáveis de ambiente necessárias

| Serviço | Variável |
|---------|----------|
| Apify | `APIFY_TOKEN` |
| Gemini | `GEMINI_API_KEY` |
| Replicate (Flux) | `REPLICATE_API_TOKEN` |
| HeyGen | `HEYGEN_API_KEY` |
| ElevenLabs | `ELEVENLABS_API_KEY` |
| Kling AI | `KLING_API_KEY` (formato `ACCESS:SECRET`) |
| Supabase | `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` |

---

## Tabelas do banco

| Tabela | Descrição |
|--------|-----------|
| `tiktok_videos` | Vídeos coletados do TikTok, com status de curadoria |
| `persona_assets` | Fotos (Flux), avatar (HeyGen), voz (ElevenLabs) — 1 por produto |
| `final_videos` | Vídeos finais por combinação de copy, com status de progresso |
| `product_knowledge` | Artefatos do pipeline, incluindo `ugc_reference` com insights Gemini |

---

## Skills e comandos relacionados

| Comando | Ação |
|---------|------|
| `/adcraft_scrape_ugc` | Coleta vídeos TikTok via Apify |
| `/adcraft_video_persona` | Configura persona visual e vocal |
| `/adcraft_video_gerar` | Processa fila de vídeos (process-video-queue) |
| `/adcraft_video_compor` | Composição final a partir dos clips gerados |
| `/adcraft_scripts_fila` | Processa scripts na fila (storyboard + artefatos) |
