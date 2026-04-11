import json
import pytest
from unittest.mock import MagicMock
from app.agents.compliance_checker import ComplianceCheckerAgent

@pytest.fixture
def sample_compliance_state():
    return {
        "execution_id": "test-123",
        "product": {
            "niche": "Renda Extra Perigosa",
            "ad_platforms": ["facebook", "google"]
        },
        "product_analysis": {
            "main_promise": "Dobre sua renda sem fazer nada"
        },
        "copy": {
            "selected_headline": "Faça $1000 hoje em 5 minutos",
            "selected_body": "Sem precisar trabalhar.",
            "selected_cta": "Garantir grana fácil"
        },
        "final_creatives": {
            "creatives": [{"id": 1}]
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

class TestComplianceCheckerAgent:

    @pytest.mark.asyncio
    async def test_compliance_success_clean(
        self, sample_compliance_state, mock_gemini_client, mock_gemini_response_factory
    ):
        agent = ComplianceCheckerAgent()
        
        valid_json = json.dumps({
            "facebook_approved": True,
            "google_approved": True,
            "issues": [
                {
                   "severity": "warning", 
                   "element": "headline", 
                   "description": "Essa promessa soa alta mas viável", 
                   "suggestion": "Melhorar a credencial"
                }
            ],
            "overall_approved": True   # Sem "critical" pode passar true.
        })
        
        mock_gemini_client.models.generate_content.return_value = mock_gemini_response_factory(valid_json)
        cost_tracker = MagicMock()
        
        updated_state, metadata = await agent.run(sample_compliance_state, cost_tracker)
        
        assert metadata["auto_eval_passed"] is True
        assert "compliance" in updated_state
        assert updated_state["compliance"]["overall_approved"] is True

    @pytest.mark.asyncio
    async def test_compliance_success_blocked(
        self, sample_compliance_state, mock_gemini_client, mock_gemini_response_factory
    ):
        agent = ComplianceCheckerAgent()
        
        valid_json = json.dumps({
            "facebook_approved": False,
            "google_approved": False,
            "issues": [
                {
                   "severity": "critical", 
                   "element": "headline", 
                   "description": "Claim absurda quebrando lei de MLM", 
                   "suggestion": "Deletar urgente e reformular oferta"
                }
            ],
            "overall_approved": False   # Resposta lógica da IA
        })
        
        mock_gemini_client.models.generate_content.return_value = mock_gemini_response_factory(valid_json)
        cost_tracker = MagicMock()
        
        updated_state, metadata = await agent.run(sample_compliance_state, cost_tracker)
        
        assert metadata["auto_eval_passed"] is True
        assert "compliance" in updated_state
        assert updated_state["compliance"]["overall_approved"] is False

    @pytest.mark.asyncio
    async def test_compliance_eval_rejects_contradiction(
        self, sample_compliance_state, mock_gemini_client, mock_gemini_response_factory
    ):
        agent = ComplianceCheckerAgent()
        
        invalid_json = json.dumps({
            "facebook_approved": True,
            "google_approved": True,
            "issues": [
                {
                   "severity": "critical", 
                   "element": "body", 
                   "description": "Esquema em pirâmide claro", 
                   "suggestion": "Apagar"
                }
            ],
            "overall_approved": True   # ERRO: Falha se colocar critical mas aprovar a peça no logico
        })
        
        mock_gemini_client.models.generate_content.return_value = mock_gemini_response_factory(invalid_json)
        cost_tracker = MagicMock()
        
        _, metadata = await agent.run(sample_compliance_state, cost_tracker)
        assert metadata["auto_eval_passed"] is False
        assert metadata["attempts"] == agent.max_retries + 1

    @pytest.mark.asyncio
    async def test_compliance_eval_rejects_invalid_severity(
        self, sample_compliance_state, mock_gemini_client, mock_gemini_response_factory
    ):
        agent = ComplianceCheckerAgent()
        
        invalid_json = json.dumps({
            "facebook_approved": True,
            "google_approved": True,
            "issues": [
                {
                   "severity": "mild", # ERRO: Nivel inventado
                   "element": "body", 
                   "description": "Blabla", 
                   "suggestion": "Apagar"
                }
            ],
            "overall_approved": True
        })
        
        mock_gemini_client.models.generate_content.return_value = mock_gemini_response_factory(invalid_json)
        cost_tracker = MagicMock()
        
        _, metadata = await agent.run(sample_compliance_state, cost_tracker)
        assert metadata["auto_eval_passed"] is False

    def test_compliance_build_context_fields(self, sample_compliance_state):
        agent = ComplianceCheckerAgent()
        context = agent.build_context(sample_compliance_state)
        
        assert "main_promise" in context
        assert "creatives_count" in context
        assert context["creatives_count"] == 1
