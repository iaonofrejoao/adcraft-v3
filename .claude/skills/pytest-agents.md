---
name: pytest-agents
description: >
  Write and run tests for Python AI agent systems using Pytest, including mocking
  Claude API calls, testing shared state management, validating tool outputs, testing
  Celery tasks, and ensuring agent auto-evaluation logic works correctly. Use this skill
  whenever writing tests for AI agents, mocking LLM responses, testing orchestration
  logic, or validating any backend component of an agent-based system. Triggers on:
  pytest, unit tests, agent tests, mock Claude, mock LLM, test agents, test tools,
  test Celery, or any request to write or run tests for AI system components.
---

# Pytest — Testes para Agentes de IA

Skill para escrever testes robustos para sistemas de agentes baseados em Claude,
cobrindo mock de chamadas à API, validação de shared state e testes de ferramentas.

---

## Estrutura de Testes

```
backend/
└── tests/
    ├── conftest.py              # Fixtures compartilhadas
    ├── unit/
    │   ├── agents/
    │   │   ├── test_product_analyzer.py
    │   │   ├── test_persona_builder.py
    │   │   ├── test_script_writer.py
    │   │   └── test_compliance_checker.py
    │   ├── tools/
    │   │   ├── test_web_search.py
    │   │   ├── test_facebook_ads.py
    │   │   └── test_asset_saver.py
    │   └── orchestration/
    │       ├── test_context_builder.py
    │       ├── test_rate_limiter.py
    │       └── test_cost_tracker.py
    ├── integration/
    │   ├── test_execution_flow.py   # Fluxo ponta a ponta (sem API real)
    │   └── test_state_persistence.py
    └── fixtures/
        ├── sample_vsl_transcript.txt
        ├── sample_execution_state.json
        └── mock_api_responses/
            ├── claude_persona_response.json
            └── facebook_create_campaign.json
```

---

## conftest.py — Fixtures Globais

```python
# tests/conftest.py
import pytest
import json
from pathlib import Path
from unittest.mock import MagicMock, AsyncMock, patch
from app.models.state import ExecutionState, ProductInfo

FIXTURES_DIR = Path(__file__).parent / "fixtures"


@pytest.fixture
def sample_execution_state() -> ExecutionState:
    """Estado de execução populado com dados de teste realistas."""
    return ExecutionState(
        execution_id="test-exec-123",
        project_id="test-proj-456",
        product=ProductInfo(
            name="Suplemento Detox Pro",
            niche="emagrecimento",
            platform="hotmart",
            product_url="https://example.com/produto",
            affiliate_link="https://go.hotmart.com/abc123",
            commission_percent=40.0,
            ticket_price=197.0,
            target_country="BR",
            target_language="pt-BR",
            budget_for_test=300.0,
            ad_platforms=["facebook"],
        )
    )


@pytest.fixture
def mock_anthropic_client():
    """Mock do cliente Anthropic que retorna respostas controladas."""
    with patch("anthropic.Anthropic") as mock_class:
        mock_instance = MagicMock()
        mock_class.return_value = mock_instance
        yield mock_instance


@pytest.fixture
def mock_claude_response():
    """Fábrica de respostas mockadas do Claude."""
    def _make_response(text: str, input_tokens: int = 500, output_tokens: int = 300):
        response = MagicMock()
        response.content = [MagicMock(type="text", text=text)]
        response.usage.input_tokens = input_tokens
        response.usage.output_tokens = output_tokens
        response.stop_reason = "end_turn"
        return response
    return _make_response


@pytest.fixture
def mock_supabase():
    """Mock do cliente Supabase."""
    with patch("app.database.get_supabase") as mock:
        client = MagicMock()
        mock.return_value = client
        yield client


@pytest.fixture
def mock_r2_upload():
    """Mock do upload para Cloudflare R2."""
    with patch("app.storage.upload_file", new_callable=AsyncMock) as mock:
        mock.return_value = "https://pub-test.r2.dev/test-file.mp4"
        yield mock
```

---

## Testando um Agente

```python
# tests/unit/agents/test_persona_builder.py
import pytest
import json
from unittest.mock import MagicMock
from app.agents.persona_builder import PersonaBuilderAgent
from app.models.state import ExecutionState


MOCK_PERSONA_RESPONSE = json.dumps({
    "summary": "Mulher 38 anos, sobrepeso, tentou várias dietas sem sucesso",
    "full_profile": {
        "name": "Ana",
        "age_range": "35-45",
        "gender": "feminino",
        "location": "São Paulo",
        "income_level": "classe média",
        "education": "superior",
        "occupation": "professora"
    },
    "psychographic": {
        "primary_pain": "gordura teimosa que não sai mesmo fazendo dieta",
        "secondary_pains": [
            "se sente envergonhada com o corpo",
            "cansada de roupas que não servem"
        ],
        "primary_desire": "caber no vestido do casamento da filha",
        "secondary_desires": ["ter mais energia", "se sentir atraente novamente"],
        "tried_before": ["dieta low carb", "academia", "shake"],
        "objections": ["mais um produto que não vai funcionar", "é caro"],
        "language_style": "informal e emocional"
    },
    "verbatim_expressions": [
        "gordura teimosa",
        "tentei de tudo",
        "meu metabolismo é lento"
    ]
})


class TestPersonaBuilderAgent:

    def test_builds_persona_from_product_analysis(
        self,
        sample_execution_state: ExecutionState,
        mock_anthropic_client,
        mock_claude_response
    ):
        """Agente de persona deve produzir perfil completo com todos os campos."""
        # Arrange
        mock_anthropic_client.messages.create.return_value = \
            mock_claude_response(MOCK_PERSONA_RESPONSE)

        agent = PersonaBuilderAgent()

        # Act
        import asyncio
        cost_tracker = MagicMock()
        updated_state, metadata = asyncio.run(
            agent.run(sample_execution_state, cost_tracker)
        )

        # Assert — persona foi escrita no estado
        assert updated_state.persona is not None
        assert updated_state.persona.summary != ""
        assert len(updated_state.persona.psychographic.tried_before) > 0
        assert len(updated_state.persona.verbatim_expressions) > 0

    def test_auto_evaluation_rejects_generic_persona(
        self,
        sample_execution_state,
        mock_anthropic_client,
        mock_claude_response
    ):
        """Persona genérica demais deve ser rejeitada pela auto-avaliação."""
        # Resposta propositalmente genérica
        generic_persona = json.dumps({
            "summary": "Pessoa que quer emagrecer",
            "full_profile": {"name": "Usuário", "age_range": "20-60"},
            "psychographic": {
                "primary_pain": "estar acima do peso",
                "verbatim_expressions": []
            }
        })

        mock_anthropic_client.messages.create.return_value = \
            mock_claude_response(generic_persona)

        agent = PersonaBuilderAgent()
        output = {"summary": "Pessoa que quer emagrecer", "verbatim_expressions": []}
        context = {"niche": "emagrecimento"}

        passed, reason = agent.evaluate_output(output, context)

        assert passed is False
        assert "verbatim" in reason.lower() or "específ" in reason.lower()

    def test_context_contains_only_needed_fields(
        self,
        sample_execution_state
    ):
        """Contexto enviado ao agente não deve conter campos desnecessários."""
        agent = PersonaBuilderAgent()
        context = agent.build_context(sample_execution_state)

        # Deve ter
        assert "product_name" in context
        assert "main_promise" in context or "product_analysis" in context

        # NÃO deve ter (campos de outros agentes)
        assert "campaign_objective" not in context
        assert "daily_budget" not in context
        assert "facebook_campaign_id" not in context

    def test_cost_is_tracked_per_run(
        self,
        sample_execution_state,
        mock_anthropic_client,
        mock_claude_response
    ):
        """Custo de tokens deve ser registrado no cost tracker."""
        mock_anthropic_client.messages.create.return_value = \
            mock_claude_response(MOCK_PERSONA_RESPONSE, input_tokens=800, output_tokens=400)

        cost_tracker = MagicMock()
        agent = PersonaBuilderAgent()

        import asyncio
        asyncio.run(agent.run(sample_execution_state, cost_tracker))

        cost_tracker.record.assert_called_once()
        call_kwargs = cost_tracker.record.call_args[1]
        assert call_kwargs["input_tokens"] == 800
        assert call_kwargs["output_tokens"] == 400
        assert call_kwargs["agent_name"] == "persona_builder"
```

---

## Testando Ferramentas

```python
# tests/unit/tools/test_asset_saver.py
import pytest
from unittest.mock import AsyncMock, MagicMock, patch, call
from app.orchestration.asset_saver import save_asset_atomically


class TestAssetSaverAtomicity:

    @pytest.mark.asyncio
    async def test_saves_to_both_r2_and_supabase(self, mock_supabase, mock_r2_upload):
        """Deve salvar no R2 e no Supabase na mesma operação."""
        mock_supabase.table.return_value.insert.return_value.execute.return_value = \
            MagicMock(data=[{"id": "asset-123", "file_url": "https://r2.dev/test.mp4"}])

        result = await save_asset_atomically(
            file_content=b"fake video bytes",
            file_extension="mp4",
            content_type="video/mp4",
            asset_metadata={"asset_type": "final_video"},
            execution_id="exec-123",
            project_id="proj-456",
            user_id="user-789"
        )

        # Ambos devem ter sido chamados
        mock_r2_upload.assert_called_once()
        mock_supabase.table.assert_called_with("assets")

        assert result["id"] == "asset-123"

    @pytest.mark.asyncio
    async def test_retries_if_supabase_fails_first_time(self, mock_supabase, mock_r2_upload):
        """Se o Supabase falhar na primeira tentativa, deve tentar novamente."""
        # Falha na primeira, sucesso na segunda
        mock_supabase.table.return_value.insert.return_value.execute.side_effect = [
            Exception("Supabase timeout"),
            MagicMock(data=[{"id": "asset-123"}])
        ]

        result = await save_asset_atomically(
            file_content=b"bytes",
            file_extension="mp4",
            content_type="video/mp4",
            asset_metadata={},
            execution_id="exec-123",
            project_id="proj-456",
            user_id="user-789",
            max_retries=3
        )

        assert result["id"] == "asset-123"
        assert mock_supabase.table.return_value.insert.return_value.execute.call_count == 2

    @pytest.mark.asyncio
    async def test_never_returns_partial_state(self, mock_supabase, mock_r2_upload):
        """Se todas as tentativas falharem, deve lançar exceção — nunca retornar parcial."""
        mock_supabase.table.return_value.insert.return_value.execute.side_effect = \
            Exception("Supabase indisponível")

        with pytest.raises(RuntimeError, match="Failed to save asset"):
            await save_asset_atomically(
                file_content=b"bytes",
                file_extension="mp4",
                content_type="video/mp4",
                asset_metadata={},
                execution_id="exec-123",
                project_id="proj-456",
                user_id="user-789",
                max_retries=2
            )
```

---

## Testando o Rate Limiter

```python
# tests/unit/orchestration/test_rate_limiter.py
import pytest
import asyncio
from datetime import UTC, datetime, timezone
from app.orchestration.rate_limiter import RateLimiter


class TestRateLimiter:

    def test_different_apis_dont_compete(self):
        """Chamadas para APIs diferentes não devem competir por cota."""
        limiter = RateLimiter()

        # Esgota a cota do YouTube
        for _ in range(100):
            limiter.usage["youtube_data"].append({"timestamp": datetime.now(UTC), "cost": 100})

        # Facebook ainda deve ter cota disponível
        assert limiter._can_proceed("facebook_ads", 1) is True
        assert limiter._can_proceed("youtube_data", 100) is False

    def test_queue_status_returned_correctly(self):
        """Status da fila deve retornar informações corretas para o tooltip."""
        limiter = RateLimiter()
        status = limiter.get_status("facebook_ads")

        assert "api" in status
        assert "used" in status
        assert "limit" in status
        assert status["api"] == "facebook_ads"
```

---

## Testando Contexto — Nenhum Campo Extra

```python
# tests/unit/orchestration/test_context_builder.py
import pytest
from app.orchestration.context_builder import ContextBuilder


HEAVY_FIELDS = [
    "campaign.facebook_campaign_id",
    "campaign.google_campaign_id",
    "creative_assets.video_clips",
    "performance.metrics",
    "execution_meta",
]


class TestContextBuilder:

    def test_script_writer_context_is_minimal(self, sample_execution_state):
        """Contexto do roteirista não deve incluir dados de campanha ou performance."""
        builder = ContextBuilder()
        context = builder.for_script_writer(sample_execution_state)

        context_str = str(context).lower()

        # Campos que NÃO devem estar presentes
        assert "facebook_campaign_id" not in context_str
        assert "google_campaign_id" not in context_str
        assert "roas" not in context_str

        # Campos que DEVEM estar presentes
        assert "persona" in context_str or "summary" in context_str
        assert "hook" in context_str or "angle" in context_str
```

---

## Executando os Testes

```bash
# Todos os testes
pytest tests/ -v

# Apenas testes unitários
pytest tests/unit/ -v

# Apenas testes de um agente específico
pytest tests/unit/agents/test_persona_builder.py -v

# Com cobertura de código
pytest tests/ --cov=app --cov-report=html

# Testes rápidos (sem integração)
pytest tests/unit/ -v --tb=short

# Parallel (mais rápido)
pytest tests/ -n auto
```

---

## pytest.ini

```ini
[pytest]
testpaths = tests
python_files = test_*.py
python_classes = Test*
python_functions = test_*
asyncio_mode = auto
markers =
    slow: testes que fazem chamadas reais a APIs externas
    integration: testes de integração completa
```
