import json
import pytest
from unittest.mock import MagicMock
from app.agents.benchmark_intelligence import BenchmarkIntelligenceAgent

@pytest.fixture
def sample_benchmark_state():
    return {
        "execution_id": "test-123",
        "product": {
            "niche": "Produtividade Pessoal",
            "target_country": "BR",
            "target_language": "pt-BR",
            "ignora_isso": 100
        },
        "angle": {
            "angle_type": "betrayed_authority",
            "primary_angle": "Os métodos que as big techs aplicam secretamente",
            "ignora_tambem": "lixo"
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

class TestBenchmarkIntelligenceAgent:

    @pytest.mark.asyncio
    async def test_benchmark_success(
        self, sample_benchmark_state, mock_gemini_client, mock_gemini_response_factory
    ):
        agent = BenchmarkIntelligenceAgent()
        
        valid_json = json.dumps({
            "top_hooks_found": [
                {
                  "hook_text": "Cansada de métodos balela?",
                  "source": "youtube_video",
                  "source_url": "https://www.youtube.com/watch?v=123",
                  "days_running": 45,
                  "format": "vsl"
                },
                {
                  "hook_text": "Me disseram pra usar Trello, mas perdi anos",
                  "source": "facebook_ad",
                  "source_url": "https://facebook.com/ads/library/456",
                  "days_running": 60,
                  "format": "ugc"
                },
                {
                  "hook_text": "Médicos do trabalho esmagam a farsa da produtividade",
                  "source": "facebook_ad",
                  "source_url": "https://facebook.com/ads/library/789",
                  "days_running": 90,
                  "format": "vsl"
                }
            ],
            "dominant_formats": ["vsl", "ugc"],
            "dominant_narrative_structures": ["pas", "betrayed_discovery"],
            "audience_verbatim": ["eu trabalho 12h e pareço não andar pra frente", "é sempre papinho de coach"],
            "references_count": 8,
            "pending_knowledge_approval": ["uuid1", "uuid2"]
        })
        
        mock_gemini_client.models.generate_content.return_value = mock_gemini_response_factory(valid_json, 1200, 600)
        cost_tracker = MagicMock()
        
        updated_state, metadata = await agent.run(sample_benchmark_state, cost_tracker)
        
        assert metadata["auto_eval_passed"] is True
        assert "benchmark" in updated_state
        assert updated_state["benchmark"]["references_count"] == 8
        assert len(updated_state["benchmark"]["top_hooks_found"]) == 3

    @pytest.mark.asyncio
    async def test_benchmark_eval_rejects_missing_url(
        self, sample_benchmark_state, mock_gemini_client, mock_gemini_response_factory
    ):
        agent = BenchmarkIntelligenceAgent()
        
        invalid_json = json.dumps({
            "top_hooks_found": [
                {"hook_text": "AAA", "source_url": "https://valida.com"},
                {"hook_text": "BBB", "source_url": "https://valida2.com"},
                {"hook_text": "CCC", "source_url": "falhou sem link legitimo"} # erro
            ],
            "dominant_formats": ["ugc"],
            "dominant_narrative_structures": ["aida"],
            "audience_verbatim": [],
            "references_count": 6,
            "pending_knowledge_approval": []
        })
        
        mock_gemini_client.models.generate_content.return_value = mock_gemini_response_factory(invalid_json)
        cost_tracker = MagicMock()
        
        _, metadata = await agent.run(sample_benchmark_state, cost_tracker)
        assert metadata["auto_eval_passed"] is False

    @pytest.mark.asyncio
    async def test_benchmark_eval_rejects_low_ref_count(
        self, sample_benchmark_state, mock_gemini_client, mock_gemini_response_factory
    ):
        agent = BenchmarkIntelligenceAgent()
        
        invalid_json = json.dumps({
            "top_hooks_found": [
                {"hook_text": "AAA", "source_url": "https://valida.com"},
                {"hook_text": "BBB", "source_url": "https://valida2.com"},
                {"hook_text": "CCC", "source_url": "https://valida3.com"} 
            ],
            "dominant_formats": ["ugc"],
            "dominant_narrative_structures": ["aida"],
            "audience_verbatim": [],
            "references_count": 3, # Falha, PRD diz pelo menos 5
            "pending_knowledge_approval": []
        })
        
        mock_gemini_client.models.generate_content.return_value = mock_gemini_response_factory(invalid_json)
        cost_tracker = MagicMock()
        
        _, metadata = await agent.run(sample_benchmark_state, cost_tracker)
        assert metadata["auto_eval_passed"] is False
        assert metadata["attempts"] == agent.max_retries + 1

    def test_benchmark_build_context_fields(self, sample_benchmark_state):
        agent = BenchmarkIntelligenceAgent()
        context = agent.build_context(sample_benchmark_state)

        assert "product_niche" in context
        assert "target_country" in context
        assert "angle_type" in context
        assert "ignora_isso" not in context
        assert "ignora_tambem" not in context
        assert context["angle_type"] == "betrayed_authority"
