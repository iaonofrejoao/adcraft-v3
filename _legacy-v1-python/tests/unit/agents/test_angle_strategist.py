import json
import pytest
from unittest.mock import MagicMock
from app.agents.angle_strategist import AngleStrategistAgent

@pytest.fixture
def sample_angle_state():
    return {
        "execution_id": "test-123",
        "product": {
            "name": "Super Produto 4"
        },
        "product_analysis": {
            "main_promise": "Domine marketing em 30 dias",
            "objections_broken": ["É caro", "Não tenho nivel superior"]
        },
        "market": {
            "competition_level": "medium",
            "ads_running_count": 22
        },
        "persona": {
            "summary": "Resumo forte da persona...",
            "psychographic": {
                "primary_pain": "Sinto que fico perdendo em produtividade",
                "objections": ["Falta de Foco"]
            },
            "verbatim_expressions": ["nao dou conta do recado"]
        }
    }

@pytest.fixture
def mock_gemini_response_factory():
    class MockUsageMetadata:
        def __init__(self, p, c):
            self.prompt_token_count = p
            self.candidates_token_count = c
            
    class MockResponse:
        def __init__(self, text: str, input_tokens: int, output_tokens: int):
            self.text = text
            self.function_calls = []
            self.usage_metadata = MockUsageMetadata(input_tokens, output_tokens)
            
    def _make_response(text: str, input_tokens: int = 50, output_tokens: int = 20):
        return MockResponse(text, input_tokens, output_tokens)

    return _make_response


class TestAngleStrategistAgent:

    @pytest.mark.asyncio
    async def test_angle_success(
        self, sample_angle_state, mock_gemini_client, mock_gemini_response_factory
    ):
        agent = AngleStrategistAgent()
        
        valid_json = json.dumps({
            "primary_angle": "Mostrar que a medicina funcional foi silenciada",
            "angle_type": "betrayed_authority",
            "usp": "Inibe a enzima ABC-2 de forma natural, que era o alvo de fármacos suspensos",
            "emotional_trigger": "Raiva e curiosidade",
            "hooks": [
                {"hook_text": "O que os médicos te esconderam?", "hook_type": "question", "variant_id": "A"},
                {"hook_text": "Este ingrediente caseiro está banido da indústria", "hook_type": "shocking_statement", "variant_id": "B"},
                {"hook_text": "Estudos recentes apontam...", "hook_type": "fact", "variant_id": "C"}
            ],
            "selected_hook_variant": "A",
            "alternative_angles": ["Ângulo X"],
            "angle_rationale": "Baseado em x"
        })
        
        mock_gemini_client.models.generate_content.return_value = mock_gemini_response_factory(valid_json)
        cost_tracker = MagicMock()
        
        updated_state, metadata = await agent.run(sample_angle_state, cost_tracker)
        assert metadata["auto_eval_passed"] is True
        assert "angle" in updated_state
        assert updated_state["angle"]["angle_type"] == "betrayed_authority"

    @pytest.mark.asyncio
    async def test_angle_eval_rejects_missing_hooks(
        self, sample_angle_state, mock_gemini_client, mock_gemini_response_factory
    ):
        agent = AngleStrategistAgent()
        
        invalid_json = json.dumps({
            "primary_angle": "X",
            "angle_type": "fear",
            "usp": "Diferencial inovador",
            "hooks": [
                {"hook_text": "Frase A", "hook_type": "fact", "variant_id": "A"} # Apenas 1 hook
            ]
        })
        
        mock_gemini_client.models.generate_content.return_value = mock_gemini_response_factory(invalid_json)
        cost_tracker = MagicMock()
        
        _, metadata = await agent.run(sample_angle_state, cost_tracker)
        assert metadata["auto_eval_passed"] is False
        assert metadata["attempts"] == agent.max_retries + 1

    @pytest.mark.asyncio
    async def test_angle_eval_rejects_generic_usp(
        self, sample_angle_state, mock_gemini_client, mock_gemini_response_factory
    ):
        agent = AngleStrategistAgent()
        
        invalid_json = json.dumps({
            "primary_angle": "X",
            "angle_type": "fear",
            "usp": "Temos a melhor do mercado comprovada", # Erro genérico
            "hooks": [
                {"hook_text": "A", "hook_type": "question", "variant_id": "A"},
                {"hook_text": "B", "hook_type": "question", "variant_id": "B"},
                {"hook_text": "C", "hook_type": "question", "variant_id": "C"}
            ]
        })
        
        mock_gemini_client.models.generate_content.return_value = mock_gemini_response_factory(invalid_json)
        cost_tracker = MagicMock()
        
        _, metadata = await agent.run(sample_angle_state, cost_tracker)
        assert metadata["auto_eval_passed"] is False

    @pytest.mark.asyncio
    async def test_angle_eval_rejects_invalid_types_enum(
        self, sample_angle_state, mock_gemini_client, mock_gemini_response_factory
    ):
        agent = AngleStrategistAgent()
        
        invalid_json = json.dumps({
            "primary_angle": "X",
            "angle_type": "invented_type", # Inválido no PRD
            "usp": "Inovador via X-ray", 
            "hooks": [
                {"hook_text": "A", "hook_type": "question", "variant_id": "A"},
                {"hook_text": "B", "hook_type": "question", "variant_id": "B"},
                {"hook_text": "C", "hook_type": "invented_hook", "variant_id": "C"}
            ]
        })
        
        mock_gemini_client.models.generate_content.return_value = mock_gemini_response_factory(invalid_json)
        cost_tracker = MagicMock()
        
        _, metadata = await agent.run(sample_angle_state, cost_tracker)
        assert metadata["auto_eval_passed"] is False

    def test_angle_build_context_fields(self, sample_angle_state):
        agent = AngleStrategistAgent()
        context = agent.build_context(sample_angle_state)

        assert "main_promise" in context
        assert "ads_running_count" in context
        assert "persona_summary" in context
        assert context["ads_running_count"] == 22
