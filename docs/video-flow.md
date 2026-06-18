# Fluxo de Geração de Vídeo — AdCraft v3

> Última atualização: 2026-06-17

---

## Visão geral

O pipeline de vídeo transforma uma combinação de copy (Hook + Body + CTA) em clips individuais por cena no formato 9:16, prontos para edição final. Usa dois modelos Google acessíveis via `GEMINI_API_KEY`: **Nano Banana** (consistência visual do personagem) e **Veo 3** (geração de vídeo com áudio nativo). Os clips são salvos no Google Drive.

---

## Camada 1 — Curadoria de UGC (pesquisa)

UGC (User Generated Content) são vídeos do TikTok coletados para referência, análise competitiva e inteligência criativa. Não são mais inseridos no vídeo final.

```
[Usuário clica "Coletar UGC" na aba TikTok do produto]
       │
       ▼
POST /api/products/[sku]/scrape-ugc
       │
       ▼
scripts/video/scrape-ugc.ts
  ├── Apify (tiktok-hashtag-scraper) → até 20 vídeos por hashtag
  ├── Score de relevância local (keywords + engagement + duração)
  └── Upsert em tiktok_videos (status: 'pending')
       │
       ▼
[Usuário revisa cards na aba TikTok]
  ├── Aprovar → PATCH { status: 'approved' } → dispara analyze-ugc em background
  └── Rejeitar → PATCH { status: 'rejected' }
```

### Análise Gemini (ao aprovar)

O `analyze-ugc.ts` analisa o vídeo com Gemini Vision e salva como artefato `ugc_reference` em `product_knowledge` com embedding semântico para busca futura. Os insights de UGC alimentam o `viral-expert` e `benchmark-intelligence` nos pipelines criativos.

---

## Camada 2 — Pipeline criativo → fila de vídeos

A geração dos planos de execução acontece dentro do pipeline de copy (Fase 2).

```
Para cada combinação aprovada (adcraft_scripts_fila):
  script-writer.md       → artefato 'script'
  character-generator.md → artefato 'character'
  viral-expert.md        → artefato 'viral_brief'
  keyframe-generator.md  → artefato 'keyframes'
    - Cada keyframe: scene_type ('persona' | 'scene'), personas_prompt, veo3_prompt_en + narração
  video-maker.md         → artefato 'video_assets'
    - Lista de cenas com drive_filename e fluxo de geração por cena
       │
       ▼
INSERT final_videos (status: 'queued', copy_combination_id)
```

O usuário aciona esse fluxo clicando em **"Gerar Script"** na aba de copies. O vídeo não é gerado aqui — apenas o plano de execução (artefato `video_assets`) é criado.

---

## Camada 3 — Geração real de vídeo

Acionado pelo comando `/adcraft_video_gerar` ou manualmente via:
```bash
npx tsx scripts/video/process-video-queue.ts --product-id <uuid>
```

```
process-video-queue.ts
       │
       ├── [PASSO 1] Verificar/criar character board
       │     Se persona_assets.nano_banana_character_board = null:
       │       └── setup-character-board.ts
       │             ├── Lê artefato 'character' (image_prompt_en do personagem)
       │             ├── Nano Banana → 4 imagens de referência (character board)
       │             └── Upload para Supabase Storage → salva URLs em persona_assets
       │             → persona_assets (status: 'ready')
       │
       └── [PASSO 2] generate-scenes.ts
             Para cada cena do artefato 'video_assets':
             │
             ├── scene_type='persona':
             │     1. Nano Banana → generateFirstFrame(characterBoard, scene.veo3_prompt_en)
             │     2. Veo 3 → imageToVideo(firstFrame, scene.veo3_prompt_en, duration)
             │     3. Google Drive → saveClip(clip, scene.drive_filename, folderId)
             │
             └── scene_type='scene':
                   1. Veo 3 → textToVideo(scene.veo3_prompt_en, duration)
                   2. Google Drive → saveClip(clip, scene.drive_filename, folderId)

             → final_videos (status: 'ready', drive_folder_url)
```

---

## Estrutura do criativo (template 30–45s)

```
0s  – 3s   HOOK VISUAL             (persona, close-up)
           Narração embutida no prompt Veo 3.

3s  – 12s  AGITAÇÃO DO PROBLEMA    (persona, medium)
           Personagem fala — Veo 3 gera vídeo + áudio sincronizados.

12s – 25s  SOLUÇÃO + DEMONSTRAÇÃO  (scene, produto em destaque)
           Veo 3 gera cena de produto/mecanismo.

25s – 35s  PROVA SOCIAL            (persona ou scene)
           Personagem reage / valida o resultado.

35s – 42s  CTA DIRETO              (persona, close-up)
           Personagem aponta para câmera. Overlay com CTA.
```

---

## Nomenclatura dos arquivos no Drive

```
{sku}_{storyboard_tag}_cena{N:02d}_{section}.mp4
```
Exemplo: `CITX_v1_H1_B2_C3_VID_cena01_hook.mp4`

Todos os clips de um vídeo ficam em uma pasta no Drive com o nome `storyboard_tag`.

---

## Toolchain

| Função | Ferramenta | Script |
|--------|-----------|--------|
| Scraping TikTok | Apify (tiktok-hashtag-scraper) | `scrape-ugc.ts` |
| Análise UGC | Gemini Vision (Files API) | `analyze-ugc.ts` |
| Character board | Nano Banana (GEMINI_API_KEY) | `nano-banana-client.ts` |
| Primeiro frame | Nano Banana (GEMINI_API_KEY) | `nano-banana-client.ts` |
| Geração de vídeo + áudio | Veo 3 (GEMINI_API_KEY) | `veo3-client.ts` |
| Upload de clips | Google Drive API | `google-drive.ts` |

---

## Variáveis de ambiente necessárias

| Serviço | Variável |
|---------|----------|
| Gemini (Nano Banana + Veo 3) | `GEMINI_API_KEY` |
| Google Drive | `GOOGLE_DRIVE_FOLDER_ID` |
| Google Drive auth | `GOOGLE_SERVICE_ACCOUNT_JSON` ou `GOOGLE_SERVICE_ACCOUNT_PATH` |
| Apify | `APIFY_TOKEN` |
| Supabase | `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` |

---

## Tabelas do banco

| Tabela | Descrição |
|--------|-----------|
| `tiktok_videos` | Vídeos coletados do TikTok — curadoria e análise |
| `persona_assets` | Character board do Nano Banana (`nano_banana_character_board`) — 1 por produto |
| `final_videos` | Vídeos finais por combinação de copy; `drive_folder_url` aponta para pasta no Drive |
| `product_knowledge` | Artefatos do pipeline: `script`, `character`, `viral_brief`, `keyframes`, `video_assets`, `ugc_reference` |

---

## Skills e comandos relacionados

| Comando | Ação |
|---------|------|
| `/adcraft_scrape_ugc` | Coleta vídeos TikTok via Apify |
| `/adcraft_video_persona` | Cria character board via Nano Banana |
| `/adcraft_video_gerar` | Processa fila de vídeos (Nano Banana + Veo 3 → Drive) |
| `/adcraft_scripts_fila` | Processa scripts na fila (storyboard + artefatos) |

---

## Modelos de IA com IDs configuráveis

Os IDs de modelo podem ser sobrescritos via variáveis de ambiente (útil para testar previews):

| Variável | Default | Descrição |
|----------|---------|-----------|
| `VEO3_MODEL_ID` | `veo-3.0-generate-preview` | Modelo Veo 3 |
| `NANO_BANANA_MODEL_ID` | `nano-banana-generate-preview` | Modelo Nano Banana |
