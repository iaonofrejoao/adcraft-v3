import json
import pytest
from unittest.mock import MagicMock
from app.agents.persona_builder import PersonaBuilderAgent

@pytest.fixture
def sample_persona_state():
    return {
        "execution_id": "test-123",
        "product": {
            "name": "Super Produto 3",
            "niche": "Renda Extra",
            "target_country": "BR",
            "target_language": "pt-BR",
            "irrelevant_data": "ignorar_neste"
        },
        "product_analysis": {
            "main_promise": "Ganhe até 5 mil extras trabalhando em casa",
            "pain_points_identified": ["Falta de dinheiro constante", "Odeia o chefe"],
            "avatar_description": "Mães ou jovens buscando grana."
        },
        "market": {
            "competition_level": "high",
            "viability_score": 90
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

class TestPersonaBuilderAgent:

    @pytest.mark.asyncio
    async def test_persona_builder_success(
        self, sample_persona_state, mock_gemini_client, mock_gemini_response_factory
    ):
        agent = PersonaBuilderAgent()
        
        valid_json = json.dumps({
            "summary": "Ana é uma mãe de 35 anos que trabalha fora e ganha pouco. Ela quer mudar de vida sem sair de perto dos filhos pois se sente culpada pela ausência. A renda extra daria respiro na família.",
            "full_profile": {
                "fictional_name": "Ana",
                "age_range": "35-45",
                "gender": "Feminino",
                "location": "Brasil afora",
                "income_level": "Baixa renda",
                "education": "Médio Completo",
                "occupation": "Atendente"
            },
            "psychographic": {
                "primary_pain": "Sinto que não sou uma boa mãe porque trabalho muito e o dinheiro nunca dura até o final do mês",
                "secondary_pains": ["Dívidas de cartão de crédito", "Cansaço extremo"],
                "primary_desire": "Poder comprar mistura e um presente para os filhos sem culpa",
                "secondary_desires": ["Tempo livre"],
                "tried_before": ["Marketing multinível no passado"],
                "objections": ["É um golpe ou esquema de pirâmide", "Não tenho tempo pra estudar"],
                "language_style": "Informal e cansado"
            },
            "verbatim_expressions": [
                "meu dinheiro não dá",
                "queria trabalhar perto dos meninos",
                "estou cansada de correr atrás e não ver retorno nenhum"
            ],
            "data_sources": ["Facebook Grupos de Renda", "Reclame Aqui - Home Office"]
        })
        
        mock_gemini_client.models.generate_content.return_value = mock_gemini_response_factory(valid_json)
        cost_tracker = MagicMock()
        
        updated_state, metadata = await agent.run(sample_persona_state, cost_tracker)
        
        assert metadata["auto_eval_passed"] is True
        assert "persona" in updated_state
        assert updated_state["persona"]["summary"].startswith("Ana é uma mãe")

    @pytest.mark.asyncio
    async def test_persona_eval_rejects_few_verbatims(
        self, sample_persona_state, mock_gemini_client, mock_gemini_response_factory
    ):
        agent = PersonaBuilderAgent()
        
        invalid_json = json.dumps({
            "summary": "O summary atende preenchendo as sentenças requisitadas com pontuacao adequadamente ok para passar e blablabla sem ser invalidado.",
            "psychographic": {"primary_pain": "Dor discursiva muito boa, ok."},
            "data_sources": ["Fonte qualquer"],
            "verbatim_expressions": ["expressão 1 só"] # Vai falhar pois deviam ser no mínimo 3
        })
        
        mock_gemini_client.models.generate_content.return_value = mock_gemini_response_factory(invalid_json)
        cost_tracker = MagicMock()
        
        _, metadata = await agent.run(sample_persona_state, cost_tracker)
        assert metadata["auto_eval_passed"] is False
        assert metadata["attempts"] == agent.max_retries + 1

    @pytest.mark.asyncio
    async def test_persona_eval_rejects_technical_pain(
        self, sample_persona_state, mock_gemini_client, mock_gemini_response_factory
    ):
        agent = PersonaBuilderAgent()
        
        invalid_json = json.dumps({
            "summary": "O summary atende preenchendo as sentenças requisitadas com pontuacao adequadamente ok para passar e blablabla sem ser invalidado.",
            "psychographic": {"primary_pain": "RendaBaixa"}, # Erro: Dor em uma palavra técnica seca, sem frase
            "data_sources": ["Fonte"],
            "verbatim_expressions": ["Exp1", "Exp2", "Exp3"]
        })
        
        mock_gemini_client.models.generate_content.return_value = mock_gemini_response_factory(invalid_json)
        cost_tracker = MagicMock()
        
        _, metadata = await agent.run(sample_persona_state, cost_tracker)
        assert metadata["auto_eval_passed"] is False

    @pytest.mark.asyncio
    async def test_persona_eval_rejects_short_summary(
        self, sample_persona_state, mock_gemini_client, mock_gemini_response_factory
    ):
        agent = PersonaBuilderAgent()
        
        invalid_json = json.dumps({
            "summary": "Apenas uma frasezinha", # Erro aqui
            "psychographic": {"primary_pain": "Sinto que mereco mais e o sol"},
            "data_sources": ["Fonte"],
            "verbatim_expressions": ["Exp1", "Exp2", "Exp3"]
        })
        
        mock_gemini_client.models.generate_content.return_value = mock_gemini_response_factory(invalid_json)
        cost_tracker = MagicMock()
        
        _, metadata = await agent.run(sample_persona_state, cost_tracker)
        assert metadata["auto_eval_passed"] is False

    def test_persona_build_context_isolates_data(self, sample_persona_state):
        agent = PersonaBuilderAgent()
        context = agent.build_context(sample_persona_state)

        assert "product_name" in context
        assert "competition_level" in context
        assert context["target_language"] == "pt-BR"
        assert "irrelevant_data" not in context
        assert "viability_score" not in context  # Apenas nivel competicao importa do mercado, não a nota toda
