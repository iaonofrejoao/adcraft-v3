import json
import pytest
from unittest.mock import MagicMock
from app.agents.scaler import ScalerAgent

@pytest.fixture
def sample_scaler_state():
    return {
        "execution_id": "test-123",
        "performance": {
            "winners": ["adset1"],
            "losers": ["adset2"],
            "diagnostics": "Adset 1 deu lucro de roi 3.",
            "recommended_actions": ["Aumentar verba no 1", "Pausar o 2"]
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

class TestScalerAgent:

    @pytest.mark.asyncio
    async def test_scaler_success(
        self, sample_scaler_state, mock_gemini_client, mock_gemini_response_factory
    ):
        agent = ScalerAgent()
        
        valid_json = json.dumps({
            "scale_proposals": [
                {
                   "action": "scale_facebook_adset",
                   "target_id": "adset1",
                   "value": "+20%",
                   "reason": "Dando lucro roi 3"
                },
                {
                   "action": "pause_facebook_ad",
                   "target_id": "adset2",
                   "value": "pause",
                   "reason": "Perdedor"
                }
            ],
            "needs_human_approval": True
        })
        
        mock_gemini_client.models.generate_content.return_value = mock_gemini_response_factory(valid_json)
        cost_tracker = MagicMock()
        
        updated_state, metadata = await agent.run(sample_scaler_state, cost_tracker)
        
        assert metadata["auto_eval_passed"] is True
        assert "scale_plan" in updated_state
        assert updated_state["scale_plan"]["needs_human_approval"] is True

    @pytest.mark.asyncio
    async def test_scaler_eval_rejects_auto_activation(
        self, sample_scaler_state, mock_gemini_client, mock_gemini_response_factory
    ):
        agent = ScalerAgent()
        
        invalid_json = json.dumps({
            "scale_proposals": [
                {"action": "pause_facebook_ad", "target_id": "adset2", "value": "x", "reason": "y"}
            ],
            "needs_human_approval": False # ERROR: O robô não tem permissão de fazer auto-click na grana da conta do FB
        })
        
        mock_gemini_client.models.generate_content.return_value = mock_gemini_response_factory(invalid_json)
        cost_tracker = MagicMock()
        
        _, metadata = await agent.run(sample_scaler_state, cost_tracker)
        assert metadata["auto_eval_passed"] is False

    @pytest.mark.asyncio
    async def test_scaler_eval_rejects_invalid_action(
        self, sample_scaler_state, mock_gemini_client, mock_gemini_response_factory
    ):
        agent = ScalerAgent()
        
        invalid_json = json.dumps({
            "scale_proposals": [
                {"action": "deletar_campanha", "target_id": "x", "value": "x", "reason": "y"} # ERRO: acao deletar n existe
            ],
            "needs_human_approval": True
        })
        
        mock_gemini_client.models.generate_content.return_value = mock_gemini_response_factory(invalid_json)
        cost_tracker = MagicMock()
        
        _, metadata = await agent.run(sample_scaler_state, cost_tracker)
        assert metadata["auto_eval_passed"] is False
        assert metadata["attempts"] == agent.max_retries + 1

    def test_scaler_build_context_fields(self, sample_scaler_state):
        agent = ScalerAgent()
        context = agent.build_context(sample_scaler_state)
        
        assert "winners" in context
        assert "recommended_actions" in context
        assert "adset1" in context["winners"]
