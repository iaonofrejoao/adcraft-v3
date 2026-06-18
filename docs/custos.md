# Custos de geração de vídeo — AdCraft v3

> Atualizado em 2026-06-17 para refletir o novo pipeline (Nano Banana + Veo 3).
> Os valores abaixo são estimativas baseadas nos preços Gemini API de junho/2026.

## Pipeline atual: Nano Banana + Veo 3

| Componente | Volume estimado | USD | R$ |
|---|---|---|---|
| Gemini (agentes: 5 agentes × ~80k tokens) | ~100k in / 40k out | ~$0,90 | ~R$5,13 |
| Nano Banana (character board: 4 imagens) | 1× por produto | a confirmar | — |
| Nano Banana (primeiro frame por cena) | ~5 cenas × 1 frame | a confirmar | — |
| Veo 3 (text-to-video / image-to-video por cena) | ~5 clips × 5–10s | a confirmar | — |
| Supabase Storage (character board) | ~2MB | <$0,01 | <R$0,06 |
| Google Drive (clips por vídeo) | ~50–100MB | gratuito* | — |

*Dentro da cota gratuita do Drive para service accounts.

**Nota:** O custo exato do Nano Banana e Veo 3 depende da tabela de preços Gemini API vigente.
Verificar em [Google AI Pricing](https://ai.google.dev/pricing) antes de escalar a produção.

---

## Pipeline anterior (descontinuado): HeyGen + Kling + ElevenLabs

Mantido para referência histórica de comparação.

| Componente | Volume real | USD | R$ |
|---|---|---|---|
| ElevenLabs (6 calls × ~200 chars) | ~1.200 chars | $0,36 | R$2,05 |
| HeyGen (5 vídeos lip sync, ~30s total) | 0,5 min gerado | $0,97–1,49 | R$5,53–8,49 |
| Kling AI (1 clip mechanism, 10s) | 1 × 10s | $0,28 | R$1,60 |
| Claude Sonnet 4.6 (12 agentes) | ~100k in / 40k out | $0,90 | R$5,13 |
| **Total por criativo** | | ~$2,51–3,03 | ~R$14–17 |
