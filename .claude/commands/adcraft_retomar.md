Retoma pipeline interrompido $ARGUMENTS

Execute o fluxo de retomada descrito em CLAUDE.md:
1. Verifique o estado atual: `npx tsx scripts/pipeline/status.ts --pipeline-id <uuid>`
2. Identifique qual foi a última task concluída e qual a próxima pendente
3. Leia `.claude/pipelines/full-pipeline.yaml` para entender dependências antes de continuar
4. Continue de onde parou, respeitando a ordem do DAG
5. Registre a retomada em TAREFAS.md

$ARGUMENTS = pipeline_id (UUID).
