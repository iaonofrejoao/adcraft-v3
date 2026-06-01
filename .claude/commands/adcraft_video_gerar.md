Gera os clips de vídeo por cena para o final_video $ARGUMENTS

Pré-condições:
1. `persona_assets.status = 'ready'` para o produto
2. Artefato `video_assets` salvo no pipeline

Execute:
```
npx tsx scripts/video/generate-scenes.ts --final-video-id <uuid>
```

O script vai gerar clip por clip:
- Cenas `hook`, `problem`, `agitation`, `offer`, `cta` → ElevenLabs TTS → HeyGen lip sync
- Cenas `mechanism` → Kling text-to-video + ElevenLabs VO
- Cenas `proof` → FFmpeg trim de tiktok_video aprovado (fallback: Kling)

Após conclusão, verifique se `composition_config` foi preenchido e rode:
```
/video_compor <final_video_id>
```

$ARGUMENTS = final_video_id (UUID).
Registre a atividade em TAREFAS.md ao concluir.
