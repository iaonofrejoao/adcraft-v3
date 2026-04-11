import pytest
import json
from unittest.mock import MagicMock
from copy import deepcopy

from app.agents.product_analyzer import ProductAnalyzerAgent
from app.agents.market_researcher import MarketResearcherAgent
from app.agents.persona_builder import PersonaBuilderAgent
from app.agents.angle_strategist import AngleStrategistAgent
from app.agents.campaign_strategist import CampaignStrategistAgent
from app.agents.script_writer import ScriptWriterAgent
from app.agents.copy_writer import CopywriterAgent
from app.agents.compliance_checker import ComplianceCheckerAgent
from app.agents.utm_structurer import UtmStructurerAgent

@pytest.fixture
def initial_integration_state():
    return {
        "execution_id": "integration-test-001",
        "product": {
            "name": "Academia de Pandas",
            "niche": "educacao",
            "ad_platforms": ["facebook", "google"],
            "target_language": "pt-br",
            "ticket_price": 100.0,
            "budget_for_test": 1000.0,
            "affiliate_link": "https://hotmart.com/panda"
        }
    }

@pytest.fixture
def mock_gemini_integration_factory():
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

class TestAgentSequenceIntegration:

    @pytest.mark.asyncio
    async def test_full_pipeline_sequence(self, initial_integration_state, mock_gemini_client, mock_gemini_integration_factory):
        """
        Testa o fluxo ponta a ponta dos geradores de Copy e Estratégia
        1 -> 2 -> 3 -> 4 -> 6 -> 7 -> 8 -> 13 -> 14
        """
        
        # Mocks para cada etapa:
        mocks_by_agent = {
            "product_analyzer": json.dumps({
                "main_promise": "Ensinar pandas a lutar v1",
                "offer_details": {"price": 100.0, "cta_text": "Lute"}
            }),
            "market_researcher": json.dumps({
                "viability_score": 85,
                "viability_verdict": "viable",
                "market_sophistication": "level_2",
                "data_sources": ["Facebook Ads Base", "Semrush"],
                "viability_justification": "Este nicho é ótimo e os pandas pagariam caro. A justificativa tem mais de cem caracteres pra simular as exigencias da engine que recusa respostas sem base profunda de conteudo textual. Fim"
            }),
            "persona_builder": json.dumps({
                "summary": "Mestre experiente do dojo procurando novos alunos desesperadamente para preencher as turmas vagas. Ele tenta varias taticas. Este sumário é longo para ser devidamente avaliado com sucesso.",
                "verbatim_expressions": ["nao tem aluno", "ninguem quer aula", "pandemia quebrou o dojo"],
                "data_sources": ["youtube comments", "reddit"],
                "psychographic": {
                    "primary_pain": "estou cansado de dar aula vazia todo dia"
                }
            }),
            "angle_strategist": json.dumps({
                "primary_angle": "Treino rapido",
                "angle_type": "curiosity",
                "selected_hook_variant": "A",
                "usp": "método chinês focado apenas em resultados visíveis na primeira semana atrelado aos treinos pesados",
                "hooks": [
                    {"hook_text": "Você também quer lutar?", "hook_type": "question", "variant_id": "A"},
                    {"hook_text": "Era uma vez um panda solitário no dojo", "hook_type": "story", "variant_id": "B"},
                    {"hook_text": "Panda que não treina perde 10% da força por ano", "hook_type": "fact", "variant_id": "C"}
                ]
            }),
            "campaign_strategist": json.dumps({
                "budget_distribution": [{"adset": "abc", "amount": 100}],
                "target_roas": 2.5,
                "max_cpa_brl": 40.0,
                "video_duration_seconds": 15,
                "aspect_ratios": ["9x16"],
                "rationale": "Calculado baseado no CPA ideal com uma folga para testes iniciais justificando os recursos."
            }),
            "script_writer": json.dumps({
                "scene_breakdown": [
                   {"scene_number": 1, "duration_seconds": 5, "description": "hook inicial forte", "dialogue": "olha ai panda saiba mais", "visual_prompt": "x"},
                   {"scene_number": 2, "duration_seconds": 10, "description": "resolução", "dialogue": "a solucao e treinar", "visual_prompt": "z"}
                ],
                "total_duration_seconds": 15,
                "estimated_words": 50
            }),
            "copy_writer": json.dumps({
                "headlines": [
                   {"text": "Panda mestre H1", "char_count": 14, "variant_id": "H1", "platform": "facebook"},
                   {"text": "H2 panda m", "char_count": 10, "variant_id": "H2", "platform": "facebook"},
                   {"text": "H3 panda master", "char_count": 15, "variant_id": "H3", "platform": "facebook"},
                   {"text": "Panda search H4", "char_count": 15, "variant_id": "H4", "platform": "google"},
                   {"text": "Panda v H5", "char_count": 10, "variant_id": "H5", "platform": "google"}
                ],
                "body_copy_short": "se ta nao tem aluno acesse metodologia",
                "body_copy_long": "Isso bla",
                "cta_options": ["Bora"],
                "selected_headline": "Panda mestre H1",
                "selected_cta": "Bora"
            }),
            "compliance_checker": json.dumps({
                "facebook_approved": True,
                "google_approved": True,
                "issues": [],
                "overall_approved": True
            }),
            "utm_structurer": json.dumps({
                "utm_parameters": {
                    "utm_source": "facebook", "utm_medium": "cpc",
                    "utm_campaign": "panda-teste", "utm_content": "A"
                },
                "final_affiliate_url": "https://hotmart.com/panda?utm_source=facebook&utm_medium=cpc&utm_campaign=panda-teste&utm_content=A"
            })
        }
        
        sequence = [
            ProductAnalyzerAgent(),   # 1
            MarketResearcherAgent(),  # 2
            PersonaBuilderAgent(),    # 3
            AngleStrategistAgent(),   # 4
            CampaignStrategistAgent(),# 6
            ScriptWriterAgent(),      # 7
            CopywriterAgent(),        # 8
            ComplianceCheckerAgent(), # 13
            UtmStructurerAgent()      # 14
        ]
        
        state = deepcopy(initial_integration_state)
        cost_tracker = MagicMock()
        
        for agent in sequence:
            agent_name = agent.name
            
            # Setup mock dinamico pro retorno deste iterador
            resp_str = mocks_by_agent[agent_name]
            mock_gemini_client.models.generate_content.return_value = mock_gemini_integration_factory(resp_str)
            
            # Executa
            state, metadata = await agent.run(state, cost_tracker)
            assert metadata["auto_eval_passed"] is True, f"Agente '{agent_name}' falhou de integrar o estado."
            
            # Verificação de Minimal Context Build (cada context só leva o que precisa, nao a "caçamba toda")
            # Pra provar, a gente faz build de novo
            ctx = agent.build_context(state)
            ctx_keys = ctx.keys()
            
            # Teste rapido geral pro build_context para confirmar campos curtos e chaves puras
            if agent_name == "script_writer":
                 assert "max_cpa_brl" not in ctx_keys # Script não tem de ver finanças!
                 assert "video_duration_seconds" in ctx_keys
                 
            if agent_name == "compliance_checker":
                 assert "budget_for_test" not in ctx_keys
                 # Ele so devia se preocupar com promises
                 assert "main_promise" in ctx_keys
                 
        # Ao final do pipeline o state ta robusto (Shared_State todo populado)
        assert "product_analysis" in state
        assert "market" in state
        assert "persona" in state
        assert "angle" in state
        assert "strategy" in state
        assert "scripts" in state
        assert "copy" in state
        assert "compliance" in state
        assert "tracking" in state
        
        assert state["tracking"]["final_affiliate_url"] == "https://hotmart.com/panda?utm_source=facebook&utm_medium=cpc&utm_campaign=panda-teste&utm_content=A"
