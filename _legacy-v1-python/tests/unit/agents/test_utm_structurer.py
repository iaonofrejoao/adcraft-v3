import json
import pytest
from unittest.mock import MagicMock
from app.agents.utm_structurer import UtmStructurerAgent

@pytest.fixture
def sample_tracking_state():
    return {
        "execution_id": "test-tracking123",
        "product": {
            "name": "Super Produto Tracking",
            "affiliate_link": "https://kiwi.com/pay/qwe",
            "ad_platforms": ["facebook"]
        },
        "angle": {
            "angle_type": "padrao-top"
        },
        "strategy": {
            "creative_format": "vsl-top"
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

class TestUtmStructurerAgent:

    @pytest.mark.asyncio
    async def test_utm_success(
        self, sample_tracking_state, mock_gemini_client, mock_gemini_response_factory
    ):
        agent = UtmStructurerAgent()
        
        valid_json = json.dumps({
            "utm_parameters": {
                "utm_source": "facebook",
                "utm_medium": "cpc",
                "utm_campaign": "super-produto-tracking-vsl-top",
                "utm_content": "padrao-top"
            },
            "final_affiliate_url": "https://kiwi.com/pay/qwe?utm_source=facebook&utm_medium=cpc&utm_campaign=super-produto-tracking-vsl-top&utm_content=padrao-top"
        })
        
        mock_gemini_client.models.generate_content.return_value = mock_gemini_response_factory(valid_json)
        cost_tracker = MagicMock()
        
        updated_state, metadata = await agent.run(sample_tracking_state, cost_tracker)
        
        assert metadata["auto_eval_passed"] is True
        assert "tracking" in updated_state
        assert "utm_source=facebook" in updated_state["tracking"]["final_affiliate_url"]

    @pytest.mark.asyncio
    async def test_utm_eval_rejects_missing_required_key(
        self, sample_tracking_state, mock_gemini_client, mock_gemini_response_factory
    ):
        agent = UtmStructurerAgent()
        
        invalid_json = json.dumps({
            "utm_parameters": {
                "utm_source": "facebook",
                "utm_campaign": "x",
                "utm_content": "y"
            }, # ERRO: faltando utm_medium
            "final_affiliate_url": "https://kiwi.com/pay/qwe?utm_source=facebook&utm_campaign=x"
        })
        
        mock_gemini_client.models.generate_content.return_value = mock_gemini_response_factory(invalid_json)
        cost_tracker = MagicMock()
        
        _, metadata = await agent.run(sample_tracking_state, cost_tracker)
        assert metadata["auto_eval_passed"] is False
        assert metadata["attempts"] == agent.max_retries + 1

    @pytest.mark.asyncio
    async def test_utm_eval_rejects_url_mismatch(
        self, sample_tracking_state, mock_gemini_client, mock_gemini_response_factory
    ):
        agent = UtmStructurerAgent()
        
        invalid_json = json.dumps({
            "utm_parameters": {
                "utm_source": "facebook",
                "utm_medium": "cpc",
                "utm_campaign": "promo",
                "utm_content": "v1"
            },
            # ERRO: A url nao reflete os valores colocados nas chaves e faltou o cpc medium
            "final_affiliate_url": "https://kiwi.com/pay/qwe?utm_source=facebook&utm_campaign=diferente"
        })
        
        mock_gemini_client.models.generate_content.return_value = mock_gemini_response_factory(invalid_json)
        cost_tracker = MagicMock()
        
        _, metadata = await agent.run(sample_tracking_state, cost_tracker)
        assert metadata["auto_eval_passed"] is False

    @pytest.mark.asyncio
    async def test_utm_eval_rejects_whitespaces(
        self, sample_tracking_state, mock_gemini_client, mock_gemini_response_factory
    ):
        agent = UtmStructurerAgent()
        
        invalid_json = json.dumps({
            "utm_parameters": {
                "utm_source": "facebook",
                "utm_medium": "cpc",
                "utm_campaign": "nome com espaço", 
                "utm_content": "v1"
            },
            # ERRO: URL Nao pode ter espaço real. Quebra o link.
            "final_affiliate_url": "https://kiwi.com/pay/qwe?utm_source=facebook&utm_medium=cpc&utm_campaign=nome com espaço&utm_content=v1"
        })
        
        mock_gemini_client.models.generate_content.return_value = mock_gemini_response_factory(invalid_json)
        cost_tracker = MagicMock()
        
        _, metadata = await agent.run(sample_tracking_state, cost_tracker)
        assert metadata["auto_eval_passed"] is False

    def test_utm_build_context_fields(self, sample_tracking_state):
        agent = UtmStructurerAgent()
        context = agent.build_context(sample_tracking_state)
        
        assert "affiliate_link" in context
        assert "ad_platforms" in context
        assert "creative_format" in context
        assert "angle_type" in context
        assert context["creative_format"] == "vsl-top"
