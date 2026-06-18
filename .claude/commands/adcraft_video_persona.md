Configura o character board (Nano Banana) do produto $ARGUMENTS

Executa o setup do character board (1× por produto) antes de gerar vídeos:
```
npx tsx scripts/video/setup-character-board.ts --product-id <uuid>
```

Pré-condição: o pipeline criativo do produto deve ter o artefato `character` salvo.
Verifique antes:
```
SELECT data FROM product_knowledge WHERE product_id = '<uuid>' AND artifact_type = 'character' ORDER BY created_at DESC LIMIT 1;
```

O script vai:
1. Extrair o `image_prompt_en` do artefato `character`
2. Gerar o character board via Nano Banana (4 imagens de referência do personagem)
3. Fazer upload das imagens para Supabase Storage (bucket `video-clips`)
4. Salvar URLs em `persona_assets.nano_banana_character_board`
5. Atualizar `persona_assets.status = 'ready'`

O character board é reutilizado em todas as cenas com persona do mesmo vídeo.

Se $ARGUMENTS for SKU:
```
SELECT id FROM products WHERE sku = '<sku>';
```

Flags opcionais:
- `--dry-run` → gera o board localmente mas não salva no banco
- `--force`   → regenera mesmo que já exista um board válido

Ao concluir, registre em TAREFAS.md.
