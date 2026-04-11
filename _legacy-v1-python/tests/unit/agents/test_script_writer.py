import json
import pytest
from unittest.mock import MagicMock
from app.agents.script_writer import ScriptWriterAgent

@pytest.fixture
def sample_script_state():
    return {
        "execution_id": "test-123",
        "product": {
            "target_language": "pt-br"
        },
        "product_analysis": {
            "main_promise": "Dobre as suas vendas via funil imersivo"
        },
        "persona": {
            "summary": "Persona resumo x",
            "psychographic": {
                "primary_pain": "Lead não clica"
            },
            "verbatim_expressions": ["não consigo leads"]
        },
        "angle": {
            "primary_angle": "Estrategia curiosidade",
            "hooks": [
               {"hook_text": "Porque ninguem acha sua pagina", "hook_type": "question", "variant_id": "A"}
            ]
        },
        "strategy": {
            "creative_format": "vsl",
            "narrative_structure": "aida",
            "video_duration_seconds": 60
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

class TestScriptWriterAgent:

    @pytest.mark.asyncio
    async def test_script_success(
        self, sample_script_state, mock_gemini_client, mock_gemini_response_factory
    ):
        agent = ScriptWriterAgent()
        
        valid_json = json.dumps({
            "scripts": [
                {
                    "script_id": "uuid-001",
                    "variant_id": "A",
                    "hook_text": "Porque ninguem acha sua pagina",
                    "full_script": "Porque ninguem acha sua pagina? Isso doí ne. Você pensa em parar. Mas esse lead não clica porque... Solucao inovadora clique no link.",
                    "scene_breakdown": [
                        {
                            "scene_number": 1,
                            "duration_seconds": 3,
                            "description": "Homem sério olhando pra camera",
                            "dialogue": "Porque ninguem acha sua pagina?",
                            "visual_direction": "Zoom na expressao de dor"
                        },
                        {
                            "scene_number": 2,
                            "duration_seconds": 58,
                            "description": "Explicação e depoimentos",
                            "dialogue": "Muitos caras perdem dinheiro por conta do problema x... Solucao inovadora clique no link.",
                            "visual_direction": "Takes dinamicos"
                        }
                    ],
                    "total_duration_seconds": 61, # 61 is within 10% of 60 (54 to 66)
                    "word_count": 120
                }
            ],
            "selected_script_id": "uuid-001"
        })
        
        mock_gemini_client.models.generate_content.return_value = mock_gemini_response_factory(valid_json)
        cost_tracker = MagicMock()
        
        updated_state, metadata = await agent.run(sample_script_state, cost_tracker)
        
        assert metadata["auto_eval_passed"] is True
        assert "scripts" in updated_state
        assert updated_state["scripts"]["selected_script_id"] == "uuid-001"

    @pytest.mark.asyncio
    async def test_script_eval_rejects_exceeding_duration(
        self, sample_script_state, mock_gemini_client, mock_gemini_response_factory
    ):
        agent = ScriptWriterAgent()
        
        invalid_json = json.dumps({
            "scripts": [
                {
                    "script_id": "uuid-001",
                    "variant_id": "A",
                    "full_script": "Clique do cta ta aqui mas a duracao quebrou.",
                    "scene_breakdown": [{"scene_number": 1, "duration_seconds": 3}],
                    "total_duration_seconds": 100, # 100 exceeds 10% tolerance from 60.
                }
            ],
            "selected_script_id": "uuid-001"
        })
        
        mock_gemini_client.models.generate_content.return_value = mock_gemini_response_factory(invalid_json)
        cost_tracker = MagicMock()
        
        _, metadata = await agent.run(sample_script_state, cost_tracker)
        assert metadata["auto_eval_passed"] is False

    @pytest.mark.asyncio
    async def test_script_eval_rejects_slow_hook(
        self, sample_script_state, mock_gemini_client, mock_gemini_response_factory
    ):
        agent = ScriptWriterAgent()
        
        invalid_json = json.dumps({
            "scripts": [
                {
                    "script_id": "uuid-001",
                    "variant_id": "A",
                    "full_script": "Cta link aqui.",
                    "scene_breakdown": [
                        {"scene_number": 1, "duration_seconds": 10} # 10s > 5s treshold de slow hook
                    ],
                    "total_duration_seconds": 60,
                }
            ],
            "selected_script_id": "uuid-001"
        })
        
        mock_gemini_client.models.generate_content.return_value = mock_gemini_response_factory(invalid_json)
        cost_tracker = MagicMock()
        
        _, metadata = await agent.run(sample_script_state, cost_tracker)
        assert metadata["auto_eval_passed"] is False

    @pytest.mark.asyncio
    async def test_script_eval_rejects_missing_cta(
        self, sample_script_state, mock_gemini_client, mock_gemini_response_factory
    ):
        agent = ScriptWriterAgent()
        
        invalid_json = json.dumps({
            "scripts": [
                {
                    "script_id": "uuid-001",
                    "variant_id": "A",
                    "full_script": "Vejam só que legal eu uso. Funciona. Fim.", # No CTA keyword in script
                    "scene_breakdown": [{"scene_number": 1, "duration_seconds": 3}],
                    "total_duration_seconds": 60,
                }
            ],
            "selected_script_id": "uuid-001"
        })
        
        mock_gemini_client.models.generate_content.return_value = mock_gemini_response_factory(invalid_json)
        cost_tracker = MagicMock()
        
        _, metadata = await agent.run(sample_script_state, cost_tracker)
        assert metadata["auto_eval_passed"] is False

    def test_script_build_context_fields(self, sample_script_state):
        agent = ScriptWriterAgent()
        context = agent.build_context(sample_script_state)
        
        assert "hooks" in context
        assert "video_duration_seconds" in context
        assert "creative_format" in context
        assert context["creative_format"] == "vsl"
