import json
import pytest
from unittest.mock import MagicMock
from app.agents.product_analyzer import ProductAnalyzerAgent

# Utilizando Dict padrão para mockar o ExecutionState simplificado ou estrutura compatível com BaseAgent
@pytest.fixture
def sample_execution_state():
    return {
        "execution_id": "test-123",
        "product": {
            "name": "Super Produto",
            "product_url": "https://teste.com",
            "affiliate_link": "",
            "vsl_url": "https://vsl.com",
            "target_language": "pt-BR",
            "irrelevant_field": "este nao deve ir"
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

class TestProductAnalyzerAgent:

    @pytest.mark.asyncio
    async def test_complete_output_is_written_to_state(
        self, sample_execution_state, mock_gemini_client, mock_gemini_response_factory
    ):
        agent = ProductAnalyzerAgent()
        
        valid_json = json.dumps({
            "main_promise": "Descubra como transformar a vida 360",
            "offer_details": {"price": 100}
        })
        
        # O mock_gemini_client já é a instância instanciada via `conftest.py` patch 
        mock_gemini_client.models.generate_content.return_value = mock_gemini_response_factory(valid_json)

        cost_tracker = MagicMock()
        
        updated_state, metadata = await agent.run(sample_execution_state, cost_tracker)
        
        assert metadata["auto_eval_passed"] is True
        assert "product_analysis" in updated_state
        assert updated_state["product_analysis"]["main_promise"] == "Descubra como transformar a vida 360"

    @pytest.mark.asyncio
    async def test_auto_eval_rejects_generic_output(
        self, sample_execution_state, mock_gemini_client, mock_gemini_response_factory
    ):
        agent = ProductAnalyzerAgent()
        
        generic_json = json.dumps({
            "main_promise": "Este produto de qualidade muda vida",
            "offer_details": {}
        })
        
        mock_gemini_client.models.generate_content.return_value = mock_gemini_response_factory(generic_json)

        cost_tracker = MagicMock()
        
        # Como o agente tentará 3x e sempre retornará genérico nesse mock estático:
        updated_state, metadata = await agent.run(sample_execution_state, cost_tracker)
        
        assert metadata["auto_eval_passed"] is False
        assert metadata["attempts"] == agent.max_retries + 1

    def test_build_context_contains_only_needed_fields(self, sample_execution_state):
        agent = ProductAnalyzerAgent()
        context = agent.build_context(sample_execution_state)

        assert "product_name" in context
        assert "target_language" in context
        # Irrelevant fields from the overall state should not be here
        assert "irrelevant_field" not in context

    @pytest.mark.asyncio
    async def test_cost_is_tracked_correctly(
        self, sample_execution_state, mock_gemini_client, mock_gemini_response_factory
    ):
        agent = ProductAnalyzerAgent()
        
        valid_json = json.dumps({
            "main_promise": "Aprendendo teste basico em 10 dias de forma eficaz",
            "offer_details": {"price": 200}
        })
        
        # 800 inputs e 400 outputs passados
        mock_gemini_client.models.generate_content.return_value = mock_gemini_response_factory(valid_json, 800, 400)

        cost_tracker = MagicMock()
        await agent.run(sample_execution_state, cost_tracker)
        
        cost_tracker.record.assert_called()
        # O BaseAgent passa `agent_name`, `input_tokens`, `output_tokens`, `model`
        call_kwargs = cost_tracker.record.call_args[1]
        assert call_kwargs["input_tokens"] == 800
        assert call_kwargs["output_tokens"] == 400
        assert call_kwargs["agent_name"] == "product_analyzer"
