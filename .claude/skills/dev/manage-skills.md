---
name: manage-skills
description: >
  Add, remove, edit, or update skills in the AdCraft project. Use this skill
  whenever creating a new construction skill for Claude Code to follow, modifying
  an existing skill's instructions or patterns, removing an outdated skill,
  or updating the CLAUDE.md to reference new skills. Triggers on: add skill,
  new skill, create skill, remove skill, edit skill, modify skill, update skill,
  update CLAUDE.md, skill instructions, skill reference.
---

# Gerenciamento de Skills — AdCraft

Skill para adicionar, remover e editar skills de construção do projeto AdCraft.
Skills de construção são documentos Markdown que ensinam o Claude Code como
implementar partes específicas da plataforma seguindo os padrões do projeto.

---

## O que é uma skill de construção

Uma skill de construção é um arquivo `.md` em `.claude/skills/` que o Claude Code
lê antes de implementar algo. Ela contém:

- Padrões de código específicos para aquela camada
- Exemplos concretos de implementação
- Regras obrigatórias que nunca devem ser violadas
- Checklist de validação

**Diferença entre skill de construção e skill de execução:**
- **Construção** (`.claude/skills/`) — usada pelo Claude Code para escrever código
- **Execução** — usada pelos agentes de IA dentro da plataforma em produção (implementada futuramente)

---

## Estrutura de uma skill de construção

```
.claude/skills/
├── backend-python-agents.md   ← como construir o backend
├── database-schema.md         ← como criar o banco
├── nextjs-reactflow.md        ← como construir o frontend
├── api-integration.md         ← como integrar APIs externas
├── frontend-adcraft.md        ← design system e componentes
├── websocket-realtime.md      ← como implementar tempo real
├── ffmpeg-video.md            ← como processar vídeos
├── docker-deployment.md       ← como configurar o ambiente
├── pytest-agents.md           ← como escrever testes
├── manage-agents.md           ← como gerenciar agentes
├── manage-tools.md            ← como gerenciar tools
└── manage-skills.md           ← este arquivo
```

---

## Adicionar uma nova skill

### Quando criar uma nova skill

Crie uma nova skill quando:
- Uma nova camada técnica for adicionada ao projeto (ex: nova plataforma de anúncio)
- Um padrão repetitivo surgir que o Claude Code precisa seguir consistentemente
- Uma tecnologia nova for integrada que tem convenções próprias
- Um domínio específico do negócio precisar de regras documentadas

### Passo 1 — Criar o arquivo da skill

```bash
touch .claude/skills/nome-da-skill.md
```

### Passo 2 — Estrutura obrigatória do arquivo

Todo arquivo de skill começa com um frontmatter YAML:

```markdown
---
name: nome-da-skill
description: >
  Descrição clara do que esta skill ensina e quando deve ser usada.
  Importante: seja específico sobre os triggers — o Claude Code usa
  esta descrição para decidir quando consultar a skill.
  Triggers on: palavra-chave-1, palavra-chave-2, palavra-chave-3.
---

# Título da Skill

Parágrafo curto explicando o propósito desta skill.

---

## Seção principal

Conteúdo com exemplos concretos de código, padrões e regras.

---

## Checklist de validação

- [ ] Item 1
- [ ] Item 2
```

### Passo 3 — Regras para escrever uma boa skill

**Seja específico, nunca vague.** "Crie a tabela corretamente" é ruim. "Use UUID como primary key, adicione comentário em todas as colunas, habilite RLS" é bom.

**Inclua exemplos de código reais.** O Claude Code aprende por exemplos. Um bloco de código vale mais que um parágrafo de texto.

**Documente o que NÃO fazer.** Anti-patterns explícitos evitam erros comuns.

**Mantenha foco.** Uma skill por domínio. Não misture instruções de banco com instruções de frontend na mesma skill.

**Inclua checklist.** Toda skill termina com um checklist de validação que o Claude Code pode usar para verificar se implementou corretamente.

### Passo 4 — Registrar no CLAUDE.md

Abrir `/adcraft/CLAUDE.md` e adicionar a nova skill na tabela de referências:

```markdown
## Skills de construção disponíveis

| Tarefa | Skill |
|---|---|
| ... skills existentes ... |
| Nova funcionalidade | @.claude/skills/nome-da-skill.md |
```

E se a skill for obrigatória para uma fase específica, adicionar na seção de ordem de implementação do `CLAUDE.md`.

### Passo 5 — Validar que o Claude Code lê a skill

Testar com um prompt simples:

```
Leia @.claude/skills/nome-da-skill.md e me explique
os principais padrões que devo seguir para [contexto da skill]
```

Se o Claude Code resumir os pontos principais corretamente, a skill está bem escrita.

---

## Editar uma skill existente

### Quando editar

- Um padrão do projeto mudou (ex: nova versão de biblioteca com API diferente)
- Um anti-pattern foi descoberto na prática e precisa ser documentado
- Um exemplo de código estava incorreto ou incompleto
- Uma nova regra obrigatória foi definida

### Como editar

Abrir o arquivo em `.claude/skills/nome-da-skill.md` e modificar diretamente.

**Atenção para estas seções críticas:**

**O frontmatter YAML** — o campo `description` é o que o Claude Code usa para decidir quando consultar a skill. Mantenha os triggers atualizados com as palavras-chave corretas.

**Exemplos de código** — sempre que uma biblioteca for atualizada, verificar se os exemplos ainda são válidos com a nova versão.

**Checklists** — adicionar novos itens quando novos requisitos surgirem. Nunca remover itens sem verificar se eles ainda são necessários.

### Versionamento de mudanças

Adicionar um comentário no topo do arquivo quando fizer mudanças significativas:

```markdown
---
name: nome-da-skill
description: >
  ...
---

<!-- Última atualização: [data] — [motivo da mudança] -->

# Título da Skill
```

---

## Remover uma skill

### Quando remover

- A tecnologia que a skill cobre foi removida do projeto
- Duas skills foram consolidadas em uma
- A skill está completamente desatualizada e não tem mais uso

### Passo 1 — Verificar dependências

Verificar se o `CLAUDE.md` referencia a skill:

```bash
grep -r "nome-da-skill" .claude/
```

### Passo 2 — Remover a referência do CLAUDE.md

Abrir `CLAUDE.md` e remover a linha da tabela de skills.

### Passo 3 — Arquivar o arquivo

```bash
mkdir -p .claude/skills/_archived/
mv .claude/skills/nome-da-skill.md .claude/skills/_archived/
```

Nunca deletar permanentemente — manter arquivado por pelo menos 30 dias.

---

## Estrutura do CLAUDE.md — referência completa

O `CLAUDE.md` é o ponto de entrada que o Claude Code lê automaticamente.
Ele deve sempre conter:

```markdown
# AdCraft — Instruções para o Claude Code

## Contexto do projeto
[descrição do projeto]

## Documento principal
@PRD.md

## Skills de construção disponíveis
| Tarefa | Skill |
|---|---|
| [tarefa] | @.claude/skills/[skill].md |

## Regras obrigatórias
[lista de regras que nunca podem ser violadas]

## Stack técnica
[tecnologias e versões]

## Ordem de implementação recomendada
[fases e sequência]
```

Quando adicionar uma nova skill, sempre atualizar a tabela de skills.
Quando remover uma skill, sempre remover a linha correspondente da tabela.

---

## Checklist de validação após qualquer mudança

- [ ] Frontmatter YAML válido (sem aspas duplas nos valores do description)
- [ ] Campo `description` tem triggers específicos e relevantes
- [ ] Exemplos de código são corretos e seguem os padrões do projeto
- [ ] Checklist de validação presente ao final da skill
- [ ] CLAUDE.md atualizado com a referência à nova skill
- [ ] Claude Code consegue resumir os pontos principais da skill ao ser questionado
