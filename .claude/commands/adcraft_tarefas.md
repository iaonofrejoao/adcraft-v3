Gerencia o arquivo TAREFAS.md $ARGUMENTS

Leia o arquivo TAREFAS.md na raiz do projeto e execute a ação indicada em $ARGUMENTS:

- Se $ARGUMENTS estiver vazio: exiba todas as pendências ativas com seus IDs e status
- Se $ARGUMENTS = `concluir <ID>`: marque a tarefa como ✅ CONCLUÍDO e adicione a data
- Se $ARGUMENTS = `add <descrição>`: adicione nova pendência na seção correta (identifique a área pelo conteúdo)
- Se $ARGUMENTS = `log <descrição>`: adicione entrada na seção "Atividades realizadas" com a data de hoje
- Se $ARGUMENTS = `tudo`: exiba o arquivo completo

Sempre salve as alterações de volta no arquivo TAREFAS.md após qualquer modificação.
