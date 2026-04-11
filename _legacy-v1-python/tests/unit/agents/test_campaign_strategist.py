import json
import pytest
from unittest.mock import MagicMock
from app.agents.campaign_strategist import CampaignStrategistAgent

@pytest.fixture
def sample_campaign_state():
    return {
        "execution_id": "test-123",
        "product": {
            "ticket_price": 200.00,
            "commission_percent": 50.0,
            "budget_for_test": 300.00,
            "ad_platforms": ["facebook"],
            "target_language": "pt-br"
        },
        "market": {
            "viability_score": 85
        },
        "persona": {
            "summary": "Persona resumo 123"
        },
        "angle": {
            "primary_angle": "Estrategia secreta",
            "angle_type": "novelty"
        },
        "benchmark": {
            "dominant_formats": ["ugc", "vsl"],
            "dominant_narrative_structures": ["pas"]
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

class TestCampaignStrategistAgent:

    @pytest.mark.asyncio
    async def test_campaign_success(
        self, sample_campaign_state, mock_gemini_client, mock_gemini_response_factory
    ):
        agent = CampaignStrategistAgent()
        
        valid_json = json.dumps({
            "creative_format": "ugc",
            "funnel_stage": "conversion",
            "campaign_objective": "conversions",
            "narrative_structure": "pas",
            "video_duration_seconds": 60,
            "aspect_ratios": ["9x16", "1x1"],
            "target_roas": 2.5,
            "min_ctr_percent": 1.5,
            "max_cpm_brl": 25.00,
            "max_cpa_brl": 50.00,
            "daily_budget_total_brl": 150.00,  # <= 300 do context
            "budget_per_adset_brl": 50.00,
            "recommended_adsets": 3,
            "rationale": "Baseado na forte dominância de formatos como ugc constatados no Bench e num funil de convesão direto, o limite de cpa garante break even pra lucro de 100 com margem."
        })
        
        mock_gemini_client.models.generate_content.return_value = mock_gemini_response_factory(valid_json)
        cost_tracker = MagicMock()
        
        updated_state, metadata = await agent.run(sample_campaign_state, cost_tracker)
        
        assert metadata["auto_eval_passed"] is True
        assert "strategy" in updated_state
        assert updated_state["strategy"]["daily_budget_total_brl"] == 150.0

    @pytest.mark.asyncio
    async def test_campaign_eval_rejects_exceeded_budget(
        self, sample_campaign_state, mock_gemini_client, mock_gemini_response_factory
    ):
        agent = CampaignStrategistAgent()
        
        invalid_json = json.dumps({
            "creative_format": "vsl",
            "target_roas": 3.0,
            "daily_budget_total_brl": 500.00, # ERROR: 500 > budget_for_test (300)
            "rationale": "Justificativa perfeita mas errada no math de budget superando a verba teste o que levaria o cliente a quebrar."
        })
        
        mock_gemini_client.models.generate_content.return_value = mock_gemini_response_factory(invalid_json)
        cost_tracker = MagicMock()
        
        _, metadata = await agent.run(sample_campaign_state, cost_tracker)
        assert metadata["auto_eval_passed"] is False
        assert metadata["attempts"] == agent.max_retries + 1

    @pytest.mark.asyncio
    async def test_campaign_eval_rejects_empty_rationale(
        self, sample_campaign_state, mock_gemini_client, mock_gemini_response_factory
    ):
        agent = CampaignStrategistAgent()
        
        invalid_json = json.dumps({
            "creative_format": "vsl",
            "target_roas": 3.0,
            "daily_budget_total_brl": 100.0,
            "rationale": "curto" # ERRO: ratio precisa ter >= 40 length
        })
        
        mock_gemini_client.models.generate_content.return_value = mock_gemini_response_factory(invalid_json)
        cost_tracker = MagicMock()
        
        _, metadata = await agent.run(sample_campaign_state, cost_tracker)
        assert metadata["auto_eval_passed"] is False

    def test_campaign_build_context_fields(self, sample_campaign_state):
        agent = CampaignStrategistAgent()
        context = agent.build_context(sample_campaign_state)

        assert "ticket_price" in context
        assert "budget_for_test" in context
        assert "dominant_formats" in context
        assert context["budget_for_test"] == 300.0
