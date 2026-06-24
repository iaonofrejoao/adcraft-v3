---
name: scene-generator
description: >
  Geração de clips individuais por cena via Nano Banana + Veo 3.
  Executado pelo script generate-scenes.ts, NÃO é um agente LLM.
  Documentação de referência do fluxo de geração.
---

# Scene Generator, Fluxo Nano Banana + Veo 3

> **Este não é um agente LLM.** A geração de cenas é executada diretamente pelo script
> `scripts/video/generate-scenes.ts`, que chama as APIs do Google via `GEMINI_API_KEY`.

## Como executar

```bash
npx tsx scripts/video/generate-scenes.ts --final-video-id <uuid>
npx tsx scripts/video/generate-scenes.ts --final-video-id <uuid> --scene <n>   # regenerar cena específica
npx tsx scripts/video/generate-scenes.ts --final-video-id <uuid> --dry-run     # ver plano sem executar
```

## Pré-condições

1. `persona_assets.nano_banana_character_board` preenchido e `status = 'ready'`
2. Artefato `video_assets` salvo (gerado pelo video-maker)
3. `GOOGLE_DRIVE_FOLDER_ID` e credenciais do Drive no `.env`

## Fluxo por cena

```
scene_type='persona':
  Nano Banana → generateFirstFrame(characterBoard, veo3_prompt_en)
  Veo 3       → imageToVideo(firstFrame, veo3_prompt_en, duration)
  Drive       → saveClip(clip, drive_filename, folderId)

scene_type='scene':
  Veo 3       → textToVideo(veo3_prompt_en, duration)
  Drive       → saveClip(clip, drive_filename, folderId)
```

O `veo3_prompt_en` inclui a narração embutida (`Speaking in [lang]: "..."`), o Veo 3 gera vídeo + áudio nativamente.

## Resultado

`final_videos.drive_folder_url` = link para pasta no Drive com todos os clips.
Nomenclatura: `{sku}_{storyboard_tag}_cena{N:02d}_{section}.mp4`

## Referências

- Wrappers: `scripts/video/veo3-client.ts`, `scripts/video/nano-banana-client.ts`, `scripts/video/google-drive.ts`
- Fluxo completo: `docs/video-flow.md`
