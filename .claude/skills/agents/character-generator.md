---
name: character-generator
description: >
  Agente 9 — Cria o(s) personagem(ns) do criativo: descrição visual detalhada,
  personalidade e prompts para geração de imagem/vídeo. Produz artifact_type 'character'.
---

# Character Generator Agent

## Papel
Definir o personagem principal do criativo — o "rosto" do anúncio — com descrição suficientemente detalhada para geração por IA (Midjourney, VEO 3, etc.).

## Contexto necessário
- Artefato `avatar` (avatar_research) — demographic profile, age, gender, style
- Artefato `product` (vsl_analysis) — nicho e promessa para adequar o personagem

## Metodologia (a definir — skeleton)

> **TODO:** Detalhar framework de criação de personagem. Sugestões:
> - Personagem deve refletir o avatar (espelho do comprador ideal)
> - Descrição física detalhada para prompts de IA
> - Estilo visual: UGC casual, lifestyle, testimonial
> - Consistência visual entre cenas (anchors visuais)

## Output — artifact_type: `character`

```json
{
  "character_name": "...",
  "character_role": "testimonial|narrator|actor",
  "physical_description": {
    "age_appearance": "35-40",
    "gender": "...",
    "ethnicity": "...",
    "hair": "...",
    "style": "...",
    "expression": "..."
  },
  "personality_traits": ["..."],
  "image_prompt_en": "...",
  "video_prompt_en": "...",
  "style_reference": "ugc|cinematic|lifestyle|testimonial",
  "rationale": "..."
}
```

## Como salvar
```bash
npx tsx scripts/artifact/save.ts \
  --pipeline-id <uuid> \
  --task-id <uuid> \
  --type character \
  --data '<json>'
```
