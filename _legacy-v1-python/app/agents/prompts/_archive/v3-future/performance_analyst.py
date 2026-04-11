import logging
from typing import Any

from app.agents.base import BaseAgent
from app.tools.registry import get_tools_for_agent

logger = logging.getLogger(__name__)


class PerformanceAnalystAgent(BaseAgent):
    """
    Agente 17 — Analista de Performance.
    Lê métricas ativas e compara com as metas (ROAS alvo, max cpa, min CTR).
    Identifica vencedores, perdedores e fornece o diagnóstico descritivo.
    """

    @property
    def name(self) -> str:
        return "performance_analyst"

    @property
    def system_prompt(self) -> str:
        return """Você é um Data Analyst Sênior de Tráfego Pago Operacional.
Sua missão é pegar o histórico de desempenho real e comparar contra as metas financeiras estabelecidas pelo Agente Estrategista, dizendo exatamente o que matou ou enriqueceu a operação.

REGRAS OBRIGATÓRIAS:
1. Em "diagnostics", escreva um breve bloco destrinchando o comportamento da campanha frente às metas. Seja analítico (ex: Abaixo da meta de ROAS).
2. Nos arrays "winners" e "losers", coloque IDs de Adsets fictícios para testes ou use os identificados.
3. Sugira "recommended_actions" num formato objetivo. 
4. Retorne APENAS um dicionário rigoroso em JSON contendo:

{
  "winners": ["..."],
  "losers": ["..."],
  "diagnostics": "...",
  "recommended_actions": ["..."]
}"""

    @property
    def tools(self) -> list[dict]:
        try:
            return get_tools_for_agent(self.name)
        except KeyError:
            return []

    def build_context(self, state: dict) -> dict:
        def dig(d):
            return d.dict() if hasattr(d, "dict") else d

        strategy = dig(state.get("strategy", {}))
        fb_camp = dig(state.get("facebook_campaign", {}))
        google_camp = dig(state.get("google_campaign", {}))

        return {
            "target_roas": strategy.get("target_roas", 2.0),
            "min_ctr_percent": strategy.get("min_ctr_percent", 1.0),
            "max_cpa_brl": strategy.get("max_cpa_brl", 50.0),
            "facebook_status": fb_camp.get("status", "unknown"),
            "google_status": google_camp.get("status", "unknown"),
            "adset_ids": fb_camp.get("adset_ids", [])
        }

    def build_user_message(self, context: dict) -> str:
        msg = f"""Estes são os Indicadores Mínimos Vitais da Operação. Compare o cenário que irei te apresentar:

[Nossas Metas Originais]:
ROAS Alvo (Que da lucro real): {context['target_roas']}
CTR Mínimo aceitável: {context['min_ctr_percent']}%
CPA Máximo de tolerância: R$ {context['max_cpa_brl']}

[Ativos Atualmente Listados na Conta Facebook/Google]:
IDs de Conjuntos rodando: {context['adset_ids']}
Status Facebook: {context['facebook_status']}

Gere a análise informando quais perdem e ganham, usando seus IDs para identificar nos arrays de "winners" e "losers".
"""
        return msg

    def evaluate_output(self, output: Any, context: dict) -> tuple[bool, str]:
        if not isinstance(output, dict):
            return False, "Output falhou. Formato esperado era dict type JSON."

        actions = output.get("recommended_actions", [])
        if not isinstance(actions, list) or len(actions) == 0:
            return False, "O array de 'recommended_actions' está vazio. O Analista tem que propor ao Escalador pelo menos uma ação de pause ou scale."

        diagnostics = output.get("diagnostics", "")
        if not diagnostics or len(diagnostics) < 15:
            return False, "O campo 'diagnostics' está muito genérico. É exigida uma justificativa densa dos números."

        # Checar coerência se listou arrays
        wins = output.get("winners", [])
        loss = output.get("losers", [])
        if not isinstance(wins, list) or not isinstance(loss, list):
             return False, "As chaves winners e losers devem ser listadas via Array."

        return True, ""

    def write_to_state(self, output: Any, state: dict) -> dict:
        state["performance"] = output
        return state
