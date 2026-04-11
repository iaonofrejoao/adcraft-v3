import logging
from typing import Any

from app.agents.base import BaseAgent
from app.tools.registry import get_tools_for_agent

logger = logging.getLogger(__name__)


class ComplianceCheckerAgent(BaseAgent):
    """
    Agente 13 — Verificador de Compliance.
    Verifica cada criativo e copy contra as políticas do Facebook Ads e Google Ads
    antes do lançamento. Bloqueia o fluxo se houver violação crítica.
    """

    @property
    def name(self) -> str:
        return "compliance_checker"

    @property
    def system_prompt(self) -> str:
        return """Você é um Auditor Sênior de Políticas do Facebook Ads e Google Ads.
Seu objetivo é analisar as copies geradas para a conta e prever banimentos, reprovações e red flags.

REGRAS OBRIGATÓRIAS:
1. Faça uma checagem restrita que identifique "Claims (Promessas Irreais)", "Nudez/Foco no corpo", "Urgência agressiva (Clickbait)" e "Modelos de fraude financeira".
2. Para cada falha, registre dentro do array 'issues'. Cada issue deve ter o `severity` restrito entre: "critical" (para blocos sumários que levariam ao banimento) e "warning" (áreas sensíveis que passam, mas baixam a qualidade).
3. Se o array contiver QUAISQUER issues com `severity` = "critical", o `overall_approved` OBRIGATORIAMENTE DEVE SER "false".
4. Retorne APENAS um dicionário rigoroso e restrito em JSON:

{
  "facebook_approved": true,
  "google_approved": true,
  "issues": [
    {
      "severity": "critical",
      "element": "headline",
      "description": "...",
      "suggestion": "..."
    }
  ],
  "overall_approved": false
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

        product = dig(state.get("product", {}))
        product_analysis = dig(state.get("product_analysis", {}))
        copy = dig(state.get("copy", {}))
        final_creatives = dig(state.get("final_creatives", {}))

        return {
            "product_niche": product.get("niche", "N/A"),
            "ad_platforms": product.get("ad_platforms", ["facebook"]),
            "main_promise": product_analysis.get("main_promise", ""),
            "selected_headline": copy.get("selected_headline", ""),
            "selected_body": copy.get("selected_body", ""),
            "selected_cta": copy.get("selected_cta", ""),
            "creatives_count": len(final_creatives.get("creatives", []))
        }

    def build_user_message(self, context: dict) -> str:
        msg = f"""Verifique estes criativos e Copies com extremo critério de Compliance nas plataformas: {context['ad_platforms']}

[Escopo do Produto e Oferta]:
Nicho de Jogo: {context['product_niche']}
Promessa Principal de Venda (Verifique se parece esquema ou saúde banida): "{context['main_promise']}"

[Escopo das Palavras Escritas que vão rodar (Avalie profundamente)]:
Headline Escolhida: "{context['selected_headline']}"
Body Copy Escolhida: "{context['selected_body']}"
Botão (CTA): "{context['selected_cta']}"
"""
        return msg

    def evaluate_output(self, output: Any, context: dict) -> tuple[bool, str]:
        if not isinstance(output, dict):
            return False, "Output falhou. Era esperado JSON serializável de Compliance."

        issues = output.get("issues", [])
        overall_approved = output.get("overall_approved", True)

        # Checar coerência de bloqueio
        has_critical = False
        for i in issues:
            sev = i.get("severity", "")
            if sev not in ["critical", "warning"]:
                return False, f"A avaliação de severity de um dos issues apontou nível ({sev}). Níveis válidos são únicos e exclusivos: 'critical' ou 'warning'."
            if sev == "critical":
                has_critical = True

        if has_critical and overall_approved is True:
             return False, "Sua avaliação foi contraditória à Política Central! Você identificou um erro 'critical' nas issues, então 'overall_approved' não pode ser verdadeiro."

        return True, ""

    def write_to_state(self, output: Any, state: dict) -> dict:
        state["compliance"] = output
        return state
