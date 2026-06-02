---
name: ugc-analyzer
description: >
  Agente que analisa vídeos TikTok aprovados com Gemini Vision e extrai
  insights estratégicos (ângulo, estilo visual, hook, avatar) salvos como
  artefatos ugc_reference em product_knowledge para enriquecer o pipeline.
---

# UGC Analyzer Agent

## Papel
Transformar vídeos TikTok aprovados pelo usuário em inteligência estruturada de mercado.
Cada vídeo aprovado vira um artefato `ugc_reference` que fica disponível para busca
vetorial pelos agentes Angle Generator e Benchmark Intelligence.

---

## Quando usar

- Imediatamente após o usuário aprovar vídeos na aba TikTok UGC de um produto
- Antes de rodar o Angle Generator (garante que a base tem referências reais)
- Como re-análise em lote com `--force` quando o prompt de análise for atualizado

---

## Como executar

### Script direto (todos os aprovados de um produto):
```bash
npx tsx scripts/video/analyze-ugc.ts \
  --product-id <uuid>
```

### Vídeo específico:
```bash
npx tsx scripts/video/analyze-ugc.ts \
  --product-id <uuid> \
  --video-id   <uuid>   # tiktok_videos.id (UUID interno)
```

### Re-análise forçada (ignora cache):
```bash
npx tsx scripts/video/analyze-ugc.ts \
  --product-id <uuid> \
  --force
```

---

## O que o Gemini Vision analisa

Para cada vídeo aprovado, o script:
1. Busca o thumbnail via URL e converte para base64
2. Monta um prompt com contexto (nicho, descrição, métricas de engajamento)
3. Chama `gemini-2.0-flash` com visão multimodal
4. Extrai os seguintes campos:

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `hook_type` | enum | Como o vídeo abre (problem, transformation, curiosity, social_proof, authority, lifestyle, entertainment) |
| `visual_style` | enum | Estilo de produção (ugc_raw, testimonial, lifestyle, talking_head, broll, text_overlay, mixed) |
| `narrative_angle` | string | Problema ou desejo central abordado |
| `tone` | enum | Tom emocional do vídeo |
| `setting` | enum | Ambiente do vídeo |
| `key_visual_elements` | string[] | Elementos visuais marcantes |
| `hook_structure` | string | Como os primeiros segundos capturam atenção |
| `cta_style` | enum | Estilo do call-to-action |
| `target_avatar_signals` | string[] | Sinais sobre o avatar-alvo |
| `engagement_interpretation` | string | Interpretação das métricas de engajamento |
| `angle_inspiration` | string | Ângulo de copy sugerido para nossos anúncios |
| `what_to_replicate` | string[] | Elementos que valem replicar |
| `what_to_avoid` | string[] | Elementos fracos ou contraproducentes |

---

## Onde os dados ficam

Artefato salvo em `product_knowledge` com:
- `artifact_type`: `ugc_reference`
- `artifact_data.tiktok_video_db_id`: UUID do registro em `tiktok_videos`
- `artifact_data.insights`: objeto com todos os campos acima
- `status`: `fresh`

Automaticamente enfileirado em `embeddings` (processado pelo worker de embeddings Gemini).

---

## Como os agentes consomem

Os artefatos `ugc_reference` ficam disponíveis via busca vetorial:

```bash
npx tsx scripts/search/vector.ts \
  --query "hook de transformação para emagrecimento" \
  --product-id <uuid> \
  --limit 5
```

Agentes que se beneficiam diretamente:
- **Angle Generator** — usa `angle_inspiration` e `hook_type` de vídeos aprovados como referência real de mercado
- **Benchmark Intelligence** — usa `engagement_interpretation` e `what_to_replicate` como benchmark de conteúdo orgânico
- **Script Writer** — usa `hook_structure` e `tone` para calibrar scripts de vídeo
- **Keyframe Generator** — usa `visual_style` e `setting` para definir ambientes e estilos de cena

---

## Comportamento de supersession

Cada vídeo TikTok tem no máximo 1 artefato `ugc_reference` com status `fresh`.
Se o script for executado novamente com `--force`, o artefato anterior é marcado
como `superseded` e um novo é criado. Vídeos diferentes nunca se superscedem entre si.

---

## Trigger automático

O PATCH `/api/products/[sku]/tiktok-videos` dispara `analyze-ugc.ts` em background
toda vez que `status` é atualizado para `approved`. Não bloqueia a resposta da API.
