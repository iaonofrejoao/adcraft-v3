Gera os clips de vídeo por cena para o final_video $ARGUMENTS

Pré-condições:
1. `persona_assets.nano_banana_character_board` preenchido e `status = 'ready'` para o produto
2. Artefato `video_assets` salvo no pipeline (gerado pelo video-maker)
3. `GOOGLE_DRIVE_FOLDER_ID` definido no .env
4. Credenciais do Drive configuradas (`GOOGLE_SERVICE_ACCOUNT_JSON` ou `GOOGLE_SERVICE_ACCOUNT_PATH`)

Execute:
```
npx tsx scripts/video/generate-scenes.ts --final-video-id <uuid>
```

O script vai gerar clip por clip:
- Cenas `scene_type='persona'` → Nano Banana (primeiro frame) → Veo 3 image-to-video (com áudio nativo)
- Cenas `scene_type='scene'` → Veo 3 text-to-video direto (com áudio nativo)
- Cada clip salvo no Google Drive: `{sku}_{storyboard_tag}_cena{N:02d}_{section}.mp4`

Para regenerar apenas uma cena específica:
```
npx tsx scripts/video/generate-scenes.ts --final-video-id <uuid> --scene <n>
```

Para visualizar o plano sem chamar as APIs:
```
npx tsx scripts/video/generate-scenes.ts --final-video-id <uuid> --dry-run
```

Ao concluir, `final_videos.drive_folder_url` conterá o link para a pasta no Drive.
Registre a atividade em TAREFAS.md.

$ARGUMENTS = final_video_id (UUID).
