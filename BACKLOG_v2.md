Funcionalidade bloqueante pra uso real:

Configurar credencial real de search_web (Serper/Tavily/Brave). Agentes geram output em cima de mock. Arquivo: workers/lib/tools/web-search.ts

Schema / migrations pendentes:

Adicionar products.description (text nullable) + incluir no embedding de classificação de nicho. Melhora qualidade do match. Fix pós-migration é 1 linha em products/route.ts:158
Revisar threshold de niche_classification conforme catálogo crescer (0.65 ok pra 12 nichos, reavaliar com 30+)

Jarvis / fluxo do usuário:

detectForceRefresh: "de novo", "novamente", "forçar" ainda são ambíguos (mantidos mas monitorar)
Pipeline cancellation via chat (não existe intent cancel_pipeline — user tem que clicar "Cancelar" no card)
Deleção de conversa (não existe UI — sidebar cresce infinitamente)

Observabilidade:

llm_calls.error não existe (gap de feature — se chamada Gemini falha, erro fica só em tasks.error, sem log por chamada)
Nenhum tracking de erros (Sentry ou similar) — produção seria cega
Worker loga version/commit ✅ mas não loga duração por task individual

Testes (dívida de qualidade):

Zero testes automatizados. Toda validação foi manual
Testes do circuit breaker (budget_usd exceeded)
Testes do trigger SQL de copy_combinations (bloqueio com componente rejeitado)
Avaliar Playwright quando regressões manuais ficarem frequentes

qa-runner melhorias:

Cleanup agressivo de resíduos (tasks órfãs, pipelines com budget <= 0)
FAIL #4 label errado (products.product_version vs pipelines.product_version)
Teste 30 Unicode falso positivo (transporte PowerShell → curl)
Horário ideal: madrugada Brasil (menos 503 do Gemini)

Documentação (Grupo D — próximo):

Atualizar CLAUDE.md com estado real pós-estabilização
Atualizar PRD.md com estado real (fluxos, schema, agentes)
Consolidar DESIGN.md na raiz (hoje são 7 individuais em stitch/)

Limpeza de código:

Duplicação frontend/lib/tagging.ts vs workers/lib/tagging.ts — intencional, comentários alinhados, monitorar drift
useJarvisChat embutido em app/page.tsx — extrair pra hooks/useJarvisChat.ts
Padronizar data fetching (alguns componentes fetch direto, outros usam hooks)
Erro cast pré-existente em niche-curator.ts:73 — ✅ resolvido

Infraestrutura / git:

git filter-repo pra limpar credenciais antigas do histórico (opcional — já invalidadas e rotacionadas)
Avaliar se projeto precisa de CI (GitHub Actions) pra type-check automatizado

Ideias v3 (não priorizar):

Autenticação multi-usuário
Integração Meta Ad Library, YouTube Data API, Amazon
Agentes arquivados: scaler, performance_analyst, utm_structurer, campaign_strategist, media_buyer
Dashboard de ROI: CAC/LTV por criativo
Modo colaborativo (review de copies em equipe)
/reformular como intent real (regenerar plano antes de aprovar)