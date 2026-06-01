Configura a persona visual e vocal do produto $ARGUMENTS

Executa o setup da persona (1× por produto) antes de gerar vídeos:
```
npx tsx scripts/video/setup-persona.ts --product-id <uuid>
```

Pré-condição: o pipeline criativo do produto deve ter o artefato `character` salvo.
Verifique antes:
```
SELECT data FROM product_knowledge WHERE product_id = '<uuid>' AND artifact_type = 'character' ORDER BY created_at DESC LIMIT 1;
```

O script vai:
1. Gerar 6 fotos via Flux 1.1 Pro (Replicate)
2. Criar avatar no HeyGen com essas fotos
3. Selecionar voz no ElevenLabs
4. Atualizar `persona_assets.status = 'ready'`

Se $ARGUMENTS for SKU:
```
SELECT id FROM products WHERE sku = '<sku>';
```

Ao concluir, registre em TAREFAS.md.
