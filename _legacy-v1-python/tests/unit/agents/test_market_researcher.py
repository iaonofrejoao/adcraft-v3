import json
import pytest
from unittest.mock import MagicMock
from app.agents.market_researcher import MarketResearcherAgent

@pytest.fixture
def sample_market_state():
    return {
        "execution_id": "test-123",
        "product": {
            "name": "Super Produto 2",
            "niche": "Emagrecimento",
            "ticket_price": 200.0,
            "commission_percent": 50.0,
            "target_country": "BR",
            "irrelevant_market": "ignorar"
        },
        "product_analysis": {
            "main_promise": "Emagreça 10kg de forma eficiente"
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

class TestMarketResearcherAgent:

    @pytest.mark.asyncio
    async def test_market_researcher_success(
        self, sample_market_state, mock_gemini_client, mock_gemini_response_factory
    ):
        agent = MarketResearcherAgent()
        
        valid_json = json.dumps({
            "viability_score": 85,
            "viability_verdict": "viable",
            "viability_justification": "Com margem estimada de aproximadamente 100 reais, há espaço de lucro. A concorrência não está tão esmagadora neste ângulo exato no Brasil. Assim, considero totalmente viável continuar a captação para estes criativos.",
            "competition_level": "medium",
            "ads_running_count": 15,
            "trend_direction": "stable",
            "trend_source": "Google Trends",
            "estimated_margin_brl": 100.0,
            "estimated_margin_usd": None,
            "market_warnings": [],
            "data_sources": ["Facebook Ads API", "Google Trends local search"]
        })
        
        mock_gemini_client.models.generate_content.return_value = mock_gemini_response_factory(valid_json)
        cost_tracker = MagicMock()
        
        updated_state, metadata = await agent.run(sample_market_state, cost_tracker)
        
        assert metadata["auto_eval_passed"] is True
        assert "market" in updated_state
        assert updated_state["market"]["viability_score"] == 85
        assert updated_state["market"]["viability_verdict"] == "viable"

    @pytest.mark.asyncio
    async def test_market_auto_eval_rejects_missing_sources(
        self, sample_market_state, mock_gemini_client, mock_gemini_response_factory
    ):
        agent = MarketResearcherAgent()
        
        invalid_json = json.dumps({
            "viability_score": 50,
            "viability_verdict": "viable",
            "viability_justification": "Justificativa válida estendida para mais de cem caracteres como exigido pela checagem porem vai falhar sem as fontes. Justificativa válida estendida para mais de cem caracteres como exigido pela checagem porem vai falhar sem as fontes.",
            "data_sources": []
        })
        
        mock_gemini_client.models.generate_content.return_value = mock_gemini_response_factory(invalid_json)
        cost_tracker = MagicMock()
        
        updated_state, metadata = await agent.run(sample_market_state, cost_tracker)
        
        assert metadata["auto_eval_passed"] is False
        assert metadata["attempts"] == agent.max_retries + 1

    @pytest.mark.asyncio
    async def test_market_auto_eval_rejects_short_justification(
        self, sample_market_state, mock_gemini_client, mock_gemini_response_factory
    ):
        agent = MarketResearcherAgent()
        
        invalid_json = json.dumps({
            "viability_score": 10,
            "viability_verdict": "not_viable",
            "viability_justification": "Curto.",
            "data_sources": ["Suposicao"]
        })
        
        mock_gemini_client.models.generate_content.return_value = mock_gemini_response_factory(invalid_json)
        cost_tracker = MagicMock()
        
        updated_state, metadata = await agent.run(sample_market_state, cost_tracker)
        
        assert metadata["auto_eval_passed"] is False

    def test_market_build_context(self, sample_market_state):
        agent = MarketResearcherAgent()
        context = agent.build_context(sample_market_state)

        assert "product_name" in context
        assert "ticket_price" in context
        assert context["ticket_price"] == 200.0
        assert context["commission_percent"] == 50.0
        assert "irrelevant_market" not in context
