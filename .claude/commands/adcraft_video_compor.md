Compõe o vídeo final a partir dos clips gerados para $ARGUMENTS

Pré-condição: `generate-scenes.ts` deve ter concluído e `composition_config` populado.

Execute:
```
npx tsx scripts/video/compose-final.ts --final-video-id <uuid>
```

O script vai:
1. Baixar todos os clips do Supabase Storage
2. Mesclar VO nas cenas 3D
3. Normalizar todos os clips (1080×1920, H.264, 30fps)
4. Concatenar em sequência
5. Queimar legendas (karaoke se faster-whisper disponível, fallback timing)
6. Adicionar música de fundo com ducking a -18dB
7. Exportar `final.mp4` + `thumbnail.jpg` → upload para Supabase
8. Atualizar `final_videos.status = 'ready'`

$ARGUMENTS = final_video_id (UUID).
Registre a atividade em TAREFAS.md ao concluir.
