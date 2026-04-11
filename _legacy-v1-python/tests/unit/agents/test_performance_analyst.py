import json
import pytest
from unittest.mock import MagicMock
from app.agents.performance_analyst import PerformanceAnalystAgent

@pytest.fixture
def sample_performance_state():
    return {
        "execution_id": "test-123",
        "strategy": {
            "target_roas": 2.5,
            "min_ctr_percent": 1.2,
            "max_cpa_brl": 60.0
        },
        "facebook_campaign": {
            "status": "active",
            "adset_ids": ["adset1", "adset2"]
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

class TestPerformanceAnalystAgent:

    @pytest.mark.asyncio
    async def test_performance_success(
        self, sample_performance_state, mock_gemini_client, mock_gemini_response_factory
    ):
        agent = PerformanceAnalystAgent()
        
        valid_json = json.dumps({
            "winners": ["adset1"],
            "losers": ["adset2"],
            "diagnostics": "A campanha adset2 ficou com CPA de 80, violando a regra de máximo 60. O adset1 obteve roas 3, batendo nossa meta de 2.5 de lucro exigida.",
            "recommended_actions": ["Desligar adset2", "Escalar adset1 via budget 20%"]
        })
        
        mock_gemini_client.models.generate_content.return_value = mock_gemini_response_factory(valid_json)
        cost_tracker = MagicMock()
        
        updated_state, metadata = await agent.run(sample_performance_state, cost_tracker)
        
        assert metadata["auto_eval_passed"] is True
        assert "performance" in updated_state
        assert "adset1" in updated_state["performance"]["winners"]

    @pytest.mark.asyncio
    async def test_performance_eval_rejects_empty_actions(
        self, sample_performance_state, mock_gemini_client, mock_gemini_response_factory
    ):
        agent = PerformanceAnalystAgent()
        
        invalid_json = json.dumps({
            "winners": ["adset1"],
            "losers": ["adset2"],
            "diagnostics": "A campanha adset2 ficou horrivel. Eu identifiquei o numero muito alto de cpc.",
            "recommended_actions": [] # ERROR: Analista ta mudo, não diz o que escala tem q fzr
        })
        
        mock_gemini_client.models.generate_content.return_value = mock_gemini_response_factory(invalid_json)
        cost_tracker = MagicMock()
        
        _, metadata = await agent.run(sample_performance_state, cost_tracker)
        assert metadata["auto_eval_passed"] is False

    @pytest.mark.asyncio
    async def test_performance_eval_rejects_poor_diagnostics(
        self, sample_performance_state, mock_gemini_client, mock_gemini_response_factory
    ):
        agent = PerformanceAnalystAgent()
        
        invalid_json = json.dumps({
            "winners": ["adset1"],
            "losers": ["adset2"],
            "diagnostics": "foi bom", # ERRO: mt curto, < 15
            "recommended_actions": ["pausar"]
        })
        
        mock_gemini_client.models.generate_content.return_value = mock_gemini_response_factory(invalid_json)
        cost_tracker = MagicMock()
        
        _, metadata = await agent.run(sample_performance_state, cost_tracker)
        assert metadata["auto_eval_passed"] is False

    def test_performance_build_context_fields(self, sample_performance_state):
        agent = PerformanceAnalystAgent()
        context = agent.build_context(sample_performance_state)
        
        assert "target_roas" in context
        assert "adset_ids" in context
        assert context["target_roas"] == 2.5
