import logging
from typing import Any

from app.agents.base import BaseAgent
from app.tools.registry import get_tools_for_agent

logger = logging.getLogger(__name__)


class ScalerAgent(BaseAgent):
    """
    Agente 18 — Escalador.
    Transforma as recomendações literárias do Analista de Performance numa
    lista de execuções automatizadas prontas (pause, scale_budget, duplicate) 
    para o usuário dar Approve com 1 clique.
    """

    @property
    def name(self) -> str:
        return "scaler"

    @property
    def system_prompt(self) -> str:
        return """Você é um Diretor de Escala e Media Buying Automatizado.
Seu objetivo é ler as recomendações do seu Analista de Performance e montar a Lista Sistêmica de Comandos Fixos de escala de campanhas que devem ser acionados no Facebook.

REGRAS OBRIGATÓRIAS:
1. Para campanhas vitoriosas sugeridas para escalar via bid, use "scale_facebook_adset", ou se indicar replicação, use "duplicate_ad".
2. Para campanhas perdedoras apontadas pra corte, use a action exata: "pause_facebook_ad".
3. Gere o array `scale_proposals` detalhando a sugestão que o botão da Dashboard do usuário acionará. Sempre marque `needs_human_approval` como true por segurança financeira global.
4. Retorne EXCLUSIVAMENTE o bloco de respostas estrito limitando em JSON:

{
  "scale_proposals": [
    {
       "action": "pause_facebook_ad",
       "target_id": "adset_ou_ad_id",
       "value": "motivo ou novo orçamento opcional",
       "reason": "..."
    }
  ],
  "needs_human_approval": true
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

        perf = dig(state.get("performance", {}))

        return {
            "winners": perf.get("winners", []),
            "losers": perf.get("losers", []),
            "analyst_diagnosis": perf.get("diagnostics", ""),
            "recommended_actions": perf.get("recommended_actions", [])
        }

    def build_user_message(self, context: dict) -> str:
        msg = f"""Estes são os Reports do Analista de Dados Operacional:

Os Vencedores detectados no código: {context['winners']}
Os Perdedores para corte detectados: {context['losers']}

Recomendações que você deve converter em "Action Proposals" do sistema:
{context['recommended_actions']}

Diagnóstico (Uso do Reason):
{context['analyst_diagnosis']}

Compile uma pipeline de execuções segura estruturada para o Gestor de Tráfego só apertar o botão verde.
"""
        return msg

    def evaluate_output(self, output: Any, context: dict) -> tuple[bool, str]:
        if not isinstance(output, dict):
            return False, "Output precisava ser Dicionário JSON."

        proposals = output.get("scale_proposals", [])
        if not isinstance(proposals, list) or len(proposals) == 0:
            return False, "A lista de 'scale_proposals' não pode ser vazia. Defina as ações ordenadas de escala."

        human = output.get("needs_human_approval")
        if human is not True:
             return False, "A flag de Segurança 'needs_human_approval' é obrigatória ser True, você não pode auto-escalar verbas bancárias sem checagem!"

        valid_actions = ["pause_facebook_ad", "scale_facebook_adset", "duplicate_ad"]
        for p in proposals:
             act = p.get("action", "")
             if act not in valid_actions:
                  return False, f"Ação de sistema '{act}' desconhecida. Use: {valid_actions}."

        return True, ""

    def write_to_state(self, output: Any, state: dict) -> dict:
        state["scale_plan"] = output
        return state
