import json
import pytest
from unittest.mock import MagicMock
from app.agents.copy_writer import CopywriterAgent

@pytest.fixture
def sample_copy_state():
    return {
        "execution_id": "test-123",
        "product": {
            "name": "Super Produto 8",
            "ad_platforms": ["facebook", "google"],
            "target_language": "pt-br"
        },
        "persona": {
            "summary": "Persona quer rapidez e facilidade",
            "verbatim_expressions": ["não consigo leads para o negócio", "estou cansado de testar"]
        },
        "angle": {
            "primary_angle": "Mostrar que a medicina fechou as portas",
            "selected_hook_variant": "A",
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

class TestCopywriterAgent:

    @pytest.mark.asyncio
    async def test_copy_success(
        self, sample_copy_state, mock_gemini_client, mock_gemini_response_factory
    ):
        agent = CopywriterAgent()
        
        valid_json = json.dumps({
            "headlines": [
                {"text": "Aumentar suas Vendas H1", "char_count": 23, "variant_id": "H1", "platform": "facebook"},
                {"text": "Dobre seus leads", "char_count": 16, "variant_id": "H2", "platform": "facebook"},
                {"text": "Mais conversões", "char_count": 15, "variant_id": "H3", "platform": "facebook"},
                {"text": "Método de Leads", "char_count": 15, "variant_id": "H4", "platform": "google"},
                {"text": "Acha ruim?", "char_count": 10, "variant_id": "H5", "platform": "google"}
            ],
            "body_copy_short": "Sei que você diz não consigo leads para o negócio. Com o nosso metodo...",
            "body_copy_long": "Exatamente como te frustra tentar e falhar. Bla bla",
            "cta_options": ["Descobrir Falhas", "Quero Acessar"],
            "selected_headline": "Aumentar suas Vendas H1",
            "selected_body": "Sei que você diz não consigo leads para o negócio. Com o nosso metodo...",
            "selected_cta": "Quero Acessar"
        })
        
        mock_gemini_client.models.generate_content.return_value = mock_gemini_response_factory(valid_json)
        cost_tracker = MagicMock()
        
        updated_state, metadata = await agent.run(sample_copy_state, cost_tracker)
        
        assert metadata["auto_eval_passed"] is True
        assert "copy" in updated_state
        assert updated_state["copy"]["selected_headline"] == "Aumentar suas Vendas H1"

    @pytest.mark.asyncio
    async def test_copy_eval_rejects_facebook_too_long(
        self, sample_copy_state, mock_gemini_client, mock_gemini_response_factory
    ):
        agent = CopywriterAgent()
        
        invalid_json = json.dumps({
            "headlines": [
                {"text": "Esse headline e muito grande para o facebook ads sem passar dos limites tristes", "char_count": 81, "variant_id": "H1", "platform": "facebook"},
                {"text": "H2", "char_count": 2, "variant_id": "H2", "platform": "facebook"},
                {"text": "H3", "char_count": 2, "variant_id": "H3", "platform": "facebook"},
                {"text": "H4", "char_count": 2, "variant_id": "H4", "platform": "google"},
                {"text": "H5", "char_count": 2, "variant_id": "H5", "platform": "google"}
            ],
            "body_copy_short": "Tenho verbatim: não consigo leads para o negócio.",
            "body_copy_long": "Isso",
            "cta_options": ["Testar"]
        })
        
        mock_gemini_client.models.generate_content.return_value = mock_gemini_response_factory(invalid_json)
        cost_tracker = MagicMock()
        
        _, metadata = await agent.run(sample_copy_state, cost_tracker)
        assert metadata["auto_eval_passed"] is False

    @pytest.mark.asyncio
    async def test_copy_eval_rejects_google_too_long(
        self, sample_copy_state, mock_gemini_client, mock_gemini_response_factory
    ):
        agent = CopywriterAgent()
        
        invalid_json = json.dumps({
            "headlines": [
                {"text": "A", "char_count": 1, "variant_id": "H1", "platform": "facebook"},
                {"text": "B", "char_count": 1, "variant_id": "H2", "platform": "facebook"},
                {"text": "C", "char_count": 1, "variant_id": "H3", "platform": "facebook"},
                {"text": "Essa headline g é muito grande google pass", "char_count": 42, "variant_id": "H4", "platform": "google"},
                {"text": "D", "char_count": 1, "variant_id": "H5", "platform": "google"}
            ],
            "body_copy_short": "Tenho verbatim: não consigo leads para o negócio.",
            "body_copy_long": "Isso",
            "cta_options": ["Testar"]
        })
        
        mock_gemini_client.models.generate_content.return_value = mock_gemini_response_factory(invalid_json)
        cost_tracker = MagicMock()
        
        _, metadata = await agent.run(sample_copy_state, cost_tracker)
        assert metadata["auto_eval_passed"] is False

    @pytest.mark.asyncio
    async def test_copy_eval_rejects_missing_verbatim(
        self, sample_copy_state, mock_gemini_client, mock_gemini_response_factory
    ):
        agent = CopywriterAgent()
        
        invalid_json = json.dumps({
            "headlines": [
                {"text": "A", "char_count": 1, "variant_id": "H1", "platform": "facebook"},
                {"text": "B", "char_count": 1, "variant_id": "H2", "platform": "facebook"},
                {"text": "C", "char_count": 1, "variant_id": "H3", "platform": "facebook"},
                {"text": "G", "char_count": 1, "variant_id": "H4", "platform": "google"},
                {"text": "H", "char_count": 1, "variant_id": "H5", "platform": "google"}
            ],
            "body_copy_short": "Esse copy nao tem nada literal da fala da dor do usuario. Apenas termos blablbal.",
            "body_copy_long": "Nadinha tb.",
            "cta_options": ["Testar"]
        })
        
        mock_gemini_client.models.generate_content.return_value = mock_gemini_response_factory(invalid_json)
        cost_tracker = MagicMock()
        
        _, metadata = await agent.run(sample_copy_state, cost_tracker)
        assert metadata["auto_eval_passed"] is False

    @pytest.mark.asyncio
    async def test_copy_eval_rejects_lazy_cta(
        self, sample_copy_state, mock_gemini_client, mock_gemini_response_factory
    ):
        agent = CopywriterAgent()
        
        invalid_json = json.dumps({
            "headlines": [
                {"text": "A", "char_count": 1, "variant_id": "H1", "platform": "facebook"},
                {"text": "B", "char_count": 1, "variant_id": "H2", "platform": "facebook"},
                {"text": "C", "char_count": 1, "variant_id": "H3", "platform": "facebook"},
                {"text": "G", "char_count": 1, "variant_id": "H4", "platform": "google"},
                {"text": "H", "char_count": 1, "variant_id": "H5", "platform": "google"}
            ],
            "body_copy_short": "Tenho verbatim: não consigo leads para o negócio.",
            "body_copy_long": "Texto",
            "cta_options": ["Clique aqui"] # ERRO ESTA AQUI
        })
        
        mock_gemini_client.models.generate_content.return_value = mock_gemini_response_factory(invalid_json)
        cost_tracker = MagicMock()
        
        _, metadata = await agent.run(sample_copy_state, cost_tracker)
        assert metadata["auto_eval_passed"] is False

    def test_copy_build_context_fields(self, sample_copy_state):
        agent = CopywriterAgent()
        context = agent.build_context(sample_copy_state)
        
        assert "verbatim_expressions" in context
        assert "ad_platforms" in context
        assert len(context["verbatim_expressions"]) == 2
