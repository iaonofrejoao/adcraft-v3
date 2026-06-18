Processa scripts na fila para o produto $ARGUMENTS

Execute o fluxo de processamento da fila de scripts descrito em CLAUDE.md (Fase 2):
1. Rode `npx tsx scripts/creative/generate-scripts-for-combination.ts --product-id <uuid>` para ver o contexto e combinações na fila
2. Para cada combinação com `script_status: queued`, spawne em sequência:
   - `.claude/skills/agents/script-writer.md` → salvar artefato `script` com `copy_combination_id`
   - `.claude/skills/agents/character-generator.md` → salvar artefato `character`
   - `.claude/skills/agents/viral-expert.md` → salvar artefato `viral_brief` com `copy_combination_id`
   - `.claude/skills/agents/keyframe-generator.md` → salvar artefato `keyframes`
     - Cada keyframe deve ter `scene_type: "persona" | "scene"`, `personas_prompt` (para cenas persona) e `veo3_prompt_en` com `Speaking in [lang]: "..."` embutido
   - `.claude/skills/agents/video-maker.md` → salvar artefato `video_assets`
     - Output: lista de cenas com `scene_type`, `personas_prompt`, `veo3_prompt_en`, `drive_filename`
3. Ao final de cada combinação, marque `script_status = 'ready'` via SQL
4. Registre a atividade em TAREFAS.md

Se $ARGUMENTS for um SKU, busque o product_id primeiro:
```
SELECT id, name FROM products WHERE sku = '<sku>';
```

Lembre de passar `--combination-id <uuid>` no save.ts de cada artefato.
