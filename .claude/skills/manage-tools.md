---
name: manage-tools
description: >
  Add, remove, edit, or rename tools in the AdCraft platform. Use this skill
  whenever adding a new tool for agents to use, modifying an existing tool's
  behavior or parameters, removing a deprecated tool, changing which agents
  have access to a tool, or updating rate limiting configuration for a tool.
  Triggers on: add tool, new tool, remove tool, edit tool, modify tool,
  update tool, tool definition, tool parameters, tool rate limit, agent tool access.
---

# Gerenciamento de Tools — AdCraft

Skill para adicionar, remover e editar tools no sistema AdCraft.
Tools são funções stateless que executam ações concretas no mundo real.
Agentes declaram quais tools podem usar — as tools em si não sabem quem as chama.

---

## Estrutura de uma tool

Cada tool vive em um arquivo próprio em `/backend/app/tools/`:

```
backend/app/tools/
├── registry.py           ← registro central de todas as tools
├── web_search.py         ← tool de busca na web
├── read_page.py          ← tool de leitura de página
├── search_ad_library.py  ← tool da Meta Ad Library
└── ...
```

Toda tool tem dois componentes:

**1. Definição para o Claude** — o JSON que o Claude usa para entender o que a tool faz e como chamá-la:

```python
NOME_DA_TOOL_TOOL = {
    "name": "nome_da_tool",
    "description": "O que esta tool faz em uma frase objetiva.",
    "input_schema": {
        "type": "object",
        "properties": {
            "parametro": {
                "type": "string",
                "description": "Descrição clara do que este parâmetro representa."
            }
        },
        "required": ["parametro"]
    }
}
```

**2. Função executora** — o Python que realmente faz a ação:

```python
async def execute_nome_da_tool(parametro: str) -> dict:
    # implementação
    return {"resultado": "..."}
```

---

## Adicionar uma nova tool

### Passo 1 — Criar o arquivo da tool

```bash
touch backend/app/tools/nome_da_tool.py
```

### Passo 2 — Implementar a tool

```python
# backend/app/tools/nome_da_tool.py
from app.orchestration.rate_limiter import RateLimiter

# Definição para o Claude tool_use
NOME_DA_TOOL_TOOL = {
    "name": "nome_da_tool",
    "description": "Descrição objetiva do que a tool faz. Uma frase.",
    "input_schema": {
        "type": "object",
        "properties": {
            "parametro_obrigatorio": {
                "type": "string",
                "description": "O que este parâmetro representa."
            },
            "parametro_opcional": {
                "type": "integer",
                "description": "O que este parâmetro representa.",
                "default": 10
            }
        },
        "required": ["parametro_obrigatorio"]
    }
}


async def execute_nome_da_tool(
    parametro_obrigatorio: str,
    parametro_opcional: int = 10
) -> dict:
    """
    Executa a ação da tool e retorna resultado estruturado.

    Se a credencial for placeholder, retorna dados mockados realistas
    em vez de fazer a chamada real à API externa.
    """
    import os

    # Verificar se credencial é real ou placeholder
    api_key = os.environ.get("NOME_DA_API_KEY", "")
    if not api_key or api_key == "placeholder":
        # Retornar mock realista para desenvolvimento
        return {
            "resultado": "dado mockado para desenvolvimento",
            "source": "mock",
            "mock": True
        }

    # Aplicar rate limiting se chamar API externa
    rate_limiter = RateLimiter()
    await rate_limiter.acquire("nome_da_api", cost=1)

    try:
        # Implementação real da chamada à API
        # ...
        return {"resultado": "...", "source": "api_real"}

    except Exception as e:
        # Nunca deixar exceção não tratada chegar ao agente
        # O agente recebe um erro estruturado e decide o que fazer
        raise ToolExecutionError(f"nome_da_tool falhou: {str(e)}")
```

### Passo 3 — Registrar no registry

Em `/backend/app/tools/registry.py`:

```python
# Importar a nova tool
from app.tools.nome_da_tool import NOME_DA_TOOL_TOOL, execute_nome_da_tool

# Adicionar ao TOOL_DEFINITIONS
TOOL_DEFINITIONS = {
    # ... tools existentes ...
    "nome_da_tool": (NOME_DA_TOOL_TOOL, execute_nome_da_tool),
}
```

### Passo 4 — Conceder acesso aos agentes

Em `/backend/app/tools/registry.py`, adicionar a tool no `AGENT_TOOL_MAP` para cada agente que deve ter acesso:

```python
AGENT_TOOL_MAP = {
    "nome_do_agente": [
        # ... tools existentes do agente ...
        "nome_da_tool",  # adicionar aqui
    ],
}
```

### Passo 5 — Configurar rate limiting se necessário

Em `/backend/app/orchestration/rate_limiter.py`, adicionar os limites da API:

```python
self.limits = {
    # ... limites existentes ...
    "nome_da_api": {
        "requests_per_hour": 100,  # ou requests_per_day, units_per_day, etc.
    },
}
```

### Passo 6 — Criar os testes

```bash
touch backend/tests/unit/tools/test_nome_da_tool.py
```

```python
# Testar comportamento com credencial real (mockada)
# Testar comportamento com credencial placeholder (deve retornar mock)
# Testar comportamento em caso de erro da API
# Testar que rate limiter é chamado corretamente
```

### Passo 7 — Executar os testes

```bash
pytest backend/tests/unit/tools/test_nome_da_tool.py -v
```

---

## Editar uma tool existente

### Editar a descrição (afeta como o Claude usa a tool)

Modificar o campo `"description"` no dict de definição da tool. Uma descrição clara e objetiva faz o Claude chamar a tool corretamente e com os parâmetros certos.

### Editar os parâmetros

Modificar o `"input_schema"` e a assinatura da função `execute_`. **Atenção:** se remover um parâmetro obrigatório ou mudar seu tipo, verificar se todos os agentes que usam essa tool ainda funcionam corretamente.

### Editar o comportamento

Modificar a função `execute_`. Manter sempre:
- Mock quando credencial é placeholder
- Rate limiting para APIs externas
- Exceção estruturada em caso de erro — nunca deixar exceção bruta chegar ao agente

### Editar o rate limit

Modificar os valores em `rate_limiter.py` para a chave da API correspondente.

---

## Remover uma tool

### Passo 1 — Verificar dependências

Antes de remover, verificar quais agentes usam a tool:

```bash
grep -r "nome_da_tool" backend/app/agents/
```

Se algum agente usa, remover a tool do `AGENT_TOOL_MAP` desse agente primeiro e verificar se o agente ainda funciona sem ela.

### Passo 2 — Remover do AGENT_TOOL_MAP

Em `registry.py`, remover `"nome_da_tool"` de todos os agentes no `AGENT_TOOL_MAP`.

### Passo 3 — Remover do TOOL_DEFINITIONS

Em `registry.py`, remover a entrada de `TOOL_DEFINITIONS` e o import correspondente.

### Passo 4 — Arquivar o arquivo

```bash
mkdir -p backend/app/tools/_archived/
mv backend/app/tools/nome_da_tool.py backend/app/tools/_archived/
mv backend/tests/unit/tools/test_nome_da_tool.py backend/tests/_archived/
```

### Passo 5 — Remover rate limit se exclusivo dessa tool

Se a chave de rate limit era usada apenas por essa tool e por nenhuma outra, remover de `rate_limiter.py`.

---

## Regras obrigatórias para todas as tools

**Stateless:** tools não guardam estado entre chamadas. Toda informação necessária vem nos parâmetros. Toda informação produzida é retornada no resultado.

**Mock quando placeholder:** se a credencial da API for `"placeholder"` ou vazia, a tool retorna dados mockados realistas em vez de falhar. Isso permite desenvolvimento e testes sem credenciais reais.

**Rate limiting obrigatório para APIs externas:** toda tool que chama uma API externa passa pelo `RateLimiter` com a chave correta antes de fazer a chamada.

**Erro estruturado:** nunca deixar uma exceção genérica chegar ao agente. Capturar, logar e relançar como `ToolExecutionError` com mensagem clara.

**Nunca salvar estado no banco:** tools não acessam o banco de dados diretamente. Quem salva no banco é o agente, após receber o resultado da tool. A única exceção é `upload_asset` que usa `save_asset_atomically`.

---

## Checklist de validação após qualquer mudança

- [ ] Testes da tool passando (com mock e sem credencial)
- [ ] Mock retorna dados com a mesma estrutura que a API real
- [ ] Rate limiter configurado para APIs externas
- [ ] TOOL_DEFINITIONS atualizado no registry
- [ ] AGENT_TOOL_MAP atualizado para todos os agentes afetados
- [ ] Testes de integração dos agentes que usam a tool ainda passando
