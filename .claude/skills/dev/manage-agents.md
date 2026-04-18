---
name: manage-agents
description: >
  Add, remove, edit, or rename AI agents in the AdCraft platform. Use this skill
  whenever adding a new agent to the flow, modifying an existing agent's behavior,
  updating an agent's tools or evaluation criteria, removing a deprecated agent,
  or changing the order of agents in the orchestration sequence. Triggers on:
  add agent, new agent, remove agent, edit agent, modify agent, update agent,
  change agent behavior, agent prompt, agent tools, agent evaluation.
---

# Gerenciamento de Agentes — AdCraft

Skill para adicionar, remover e editar agentes no sistema AdCraft.
Todo agente herda de `BaseAgent` e segue o padrão definido em `backend-python-agents.md`.

---

## Estrutura de um agente

Cada agente vive em um único arquivo em `/backend/app/agents/`:

```
backend/app/agents/
├── base.py                    ← nunca modificar diretamente
├── product_analyzer.py        ← Agente 1
├── market_researcher.py       ← Agente 2
├── persona_builder.py         ← Agente 3
└── ...
```

Todo agente implementa obrigatoriamente 6 elementos:

```python
class MeuAgenteAgent(BaseAgent):

    @property
    def name(self) -> str:
        # Identificador único snake_case — usado em logs e no state
        return "meu_agente"

    @property
    def system_prompt(self) -> str:
        # Papel, expertise e regras de comportamento do agente
        # Inclui: regra de não alucinar, regra de sinalizar hipóteses
        return "..."

    @property
    def tools(self) -> list[dict]:
        # Lista de definições de tools que este agente pode usar
        # Obtida via: get_tools_for_agent(self.name)
        from app.tools.registry import get_tools_for_agent
        return get_tools_for_agent(self.name)

    def build_context(self, state: ExecutionState) -> dict:
        # Extrai APENAS os campos que este agente precisa do shared state
        # NUNCA passar o state completo
        return {
            "campo_necessario": state.secao.campo,
        }

    def evaluate_output(self, output: Any, context: dict) -> tuple[bool, str]:
        # Valida se o output atende os critérios de qualidade
        # Retorna (True, "") se aprovado
        # Retorna (False, "motivo") se reprovado
        if not output.get("campo_obrigatorio"):
            return False, "campo_obrigatorio está vazio"
        return True, ""

    def write_to_state(self, output: Any, state: ExecutionState) -> ExecutionState:
        # Escreve o output nos campos corretos do shared state
        # NUNCA sobrescrever campos de outros agentes
        state.minha_secao = MinhaSeccao(**output)
        return state
```

---

## Adicionar um novo agente

### Passo 1 — Criar o arquivo do agente

```bash
# Criar o arquivo em /backend/app/agents/
touch backend/app/agents/nome_do_agente.py
```

### Passo 2 — Implementar o agente

Copiar o template abaixo e preencher cada seção:

```python
# backend/app/agents/nome_do_agente.py
from typing import Any
from app.agents.base import BaseAgent
from app.models.state import ExecutionState


class NomeDoAgenteAgent(BaseAgent):

    @property
    def name(self) -> str:
        return "nome_do_agente"  # snake_case, único no sistema

    @property
    def system_prompt(self) -> str:
        return """Você é um especialista em [área de atuação].

Sua responsabilidade é [o que o agente faz].

REGRAS OBRIGATÓRIAS:
- Toda afirmação factual requer uma fonte. Se não encontrou dados, retorne data_unavailable: true
- Hipóteses são sinalizadas com confidence: "hypothesis" e hypothesis_rationale explicando
- Nunca invente informações — se não souber, diga que não sabe
- Escreva sempre em [idioma do produto — usar state.product.target_language]
"""

    @property
    def tools(self) -> list[dict]:
        from app.tools.registry import get_tools_for_agent
        return get_tools_for_agent(self.name)

    def build_context(self, state: ExecutionState) -> dict:
        # Listar APENAS os campos necessários — consultar PRD.md seção 4
        return {
            "product_name": state.product.name,
            # adicionar outros campos necessários
        }

    def build_user_message(self, context: dict) -> str:
        return f"""Com base nas seguintes informações:

{context}

Execute a seguinte tarefa: [descrever a tarefa com precisão]

Retorne um JSON com a seguinte estrutura:
{{
    "campo_resultado": "string",
    "confidence": "high | medium | low | hypothesis",
    "data_sources": ["url ou descrição da fonte"]
}}
"""

    def evaluate_output(self, output: Any, context: dict) -> tuple[bool, str]:
        # Critério 1
        if not output.get("campo_resultado"):
            return False, "campo_resultado está vazio"

        # Critério 2 — exemplo: não pode ser genérico
        if len(output.get("campo_resultado", "")) < 20:
            return False, "campo_resultado é muito curto — deve ser específico"

        # Critério 3 — fontes obrigatórias
        if not output.get("data_sources"):
            return False, "data_sources está vazio — toda conclusão requer fonte"

        return True, ""

    def write_to_state(self, output: Any, state: ExecutionState) -> ExecutionState:
        from app.models.state import MinhaSecao
        state.minha_secao = MinhaSecao(**output)
        return state
```

### Passo 3 — Adicionar as tools ao registry

Em `/backend/app/tools/registry.py`, adicionar o agente no `AGENT_TOOL_MAP`:

```python
AGENT_TOOL_MAP = {
    # ... agentes existentes ...
    "nome_do_agente": [
        "search_web",       # tools que este agente pode usar
        "read_page",
    ],
}
```

### Passo 4 — Adicionar os campos de output ao shared state

Em `/backend/app/models/state.py`, criar o modelo Pydantic do output:

```python
class MinhaSecao(BaseModel):
    campo_resultado: str
    confidence: str
    data_sources: list[str] = []
```

E adicionar o campo na classe `ExecutionState`:

```python
class ExecutionState(BaseModel):
    # ... campos existentes ...
    minha_secao: Optional[MinhaSecao] = None
```

### Passo 5 — Registrar no orquestrador

Em `/backend/app/orchestration/executor.py`, importar e registrar o agente:

```python
from app.agents.nome_do_agente import NomeDoAgenteAgent

AGENT_REGISTRY = {
    # ... agentes existentes ...
    "nome_do_agente": NomeDoAgenteAgent,
}
```

### Passo 6 — Adicionar o nó no template do React Flow

Na tabela `templates` do Supabase, atualizar o `flow_schema` adicionando o novo nó:

```json
{
  "id": "nome_do_agente",
  "type": "agent",
  "position": { "x": 800, "y": 200 },
  "data": {
    "label": "Nome do Agente",
    "agent_name": "nome_do_agente",
    "status": "idle",
    "approval_required": true,
    "model": "claude-sonnet-4-6",
    "quantity": 1,
    "active": true
  }
}
```

### Passo 7 — Criar os testes

```bash
touch backend/tests/unit/agents/test_nome_do_agente.py
```

Seguir o padrão de `pytest-agents.md`:
- Testar output completo com mock do Claude
- Testar auto-avaliação rejeitando output inválido
- Testar que contexto não contém campos desnecessários
- Testar que custo é registrado corretamente

### Passo 8 — Executar os testes

```bash
pytest backend/tests/unit/agents/test_nome_do_agente.py -v
```

---

## Editar um agente existente

### Editar o system_prompt

Abrir `/backend/app/agents/nome_do_agente.py` e modificar o método `system_prompt`.

**Atenção:** mudanças no system_prompt afetam todas as execuções futuras. Execuções em andamento não são afetadas.

### Editar os critérios de auto-avaliação

Modificar o método `evaluate_output`. Lembrar que:
- Critérios muito rígidos causam loops de retentativa
- Máximo de 2 retentativas automáticas
- Critérios devem ser objetivos e mensuráveis

### Editar o contexto recebido

Modificar `build_context`. Sempre consultar o PRD.md seção 4 para verificar quais campos aquele agente deve receber — nunca adicionar campos que não estão documentados.

### Editar o modelo de IA

O modelo padrão é configurado na propriedade da classe:

```python
def __init__(self):
    super().__init__(model="claude-sonnet-4-6")
```

Mas pode ser sobrescrito por execução via `node_config` sem mudar o código.

### Editar as tools disponíveis

Modificar o `AGENT_TOOL_MAP` em `registry.py` para o agente em questão.

---

## Remover um agente

### Passo 1 — Remover do template do React Flow

Atualizar o `flow_schema` no Supabase removendo o nó correspondente e os edges conectados a ele.

### Passo 2 — Remover do AGENT_REGISTRY

Em `executor.py`, remover o import e a entrada no `AGENT_REGISTRY`.

### Passo 3 — Remover do AGENT_TOOL_MAP

Em `registry.py`, remover a entrada do agente.

### Passo 4 — Remover os campos do shared state (opcional)

Se os campos que o agente escrevia não são mais necessários, removê-los de `state.py`. **Cuidado:** verificar se outros agentes leem esses campos antes de remover.

### Passo 5 — Arquivar o arquivo (não deletar)

```bash
mkdir -p backend/app/agents/_archived/
mv backend/app/agents/nome_do_agente.py backend/app/agents/_archived/
```

Manter o arquivo arquivado por pelo menos um mês antes de deletar permanentemente.

### Passo 6 — Remover os testes

```bash
mv backend/tests/unit/agents/test_nome_do_agente.py backend/tests/_archived/
```

---

## Checklist de validação após qualquer mudança

- [ ] Testes do agente modificado passando
- [ ] Testes de integração da sequência de agentes passando
- [ ] `build_context` não passa campos desnecessários
- [ ] `evaluate_output` tem critérios objetivos e alcançáveis
- [ ] `write_to_state` não sobrescreve campos de outros agentes
- [ ] AGENT_TOOL_MAP atualizado no registry
- [ ] Shared state atualizado em state.py se necessário
- [ ] Template do React Flow atualizado se o nó foi adicionado/removido
