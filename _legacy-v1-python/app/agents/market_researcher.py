import logging
from typing import Any

from app.agents.base import BaseAgent
from app.tools.registry import get_tools_for_agent

logger = logging.getLogger(__name__)


class MarketResearcherAgent(BaseAgent):
    """
    Agente 2 — Analisador de Viabilidade.
    Avalia se o produto é viável para venda via tráfego pago, considerando concorrência,
    tendência, margem e prova de mercado.
    """

    @property
    def name(self) -> str:
        return "market_researcher"

    @property
    def system_prompt(self) -> str:
        return """Você é um Analisador de Viabilidade de Mercado Especialista em Marketing Direto.
Seu papel é avaliar imparcialmente as métricas do produto dentro do mercado, verificando tendências, a margem de lucro sugerida e os anúncios da concorrência.

REGRAS:
1. Toda afirmação factual requer origem listada na propriedade "data_sources".
2. Seus resultados devem refletir pesquisas reais usando as ferramentas. Não crie informações de tendências sem dados que sustentem (caso não encontre, escreva "data_unavailable").
3. A nota "viability_score" deve ir de 0 a 100. Baseie a nota na margem calculada (ticket * comissão/100) e na força da concorrência.
4. O veredito "viability_verdict" deve ser restrito às strings exatas: "viable" ou "not_viable".
5. A "viability_justification" deve ser um texto embasado e discursivo explicando os motivos do score e por que deu aquele veredito.
6. O output deve ser APENAS um dict JSON válido com as exatas chaves:
   "viability_score", "viability_verdict", "viability_justification", "competition_level", "ads_running_count", "trend_direction", "trend_source", "estimated_margin_brl", "estimated_margin_usd", "market_warnings", "data_sources".
7. Não inclua Markdown tags nem ```json no seu output.
"""

    @property
    def tools(self) -> list[dict]:
        try:
            return get_tools_for_agent(self.name)
        except KeyError:
            return []

    def build_context(self, state: dict) -> dict:
        product = state.get("product", {})
        product_analysis = state.get("product_analysis", {})
        
        if hasattr(product, "dict"):
            product = product.dict()
        if hasattr(product_analysis, "dict"):
            product_analysis = product_analysis.dict()

        return {
            "product_name": product.get("name", "Desconhecido"),
            "product_niche": product.get("niche", ""),
            "ticket_price": product.get("ticket_price", 0.0),
            "commission_percent": product.get("commission_percent", 0.0),
            "target_country": product.get("target_country", "BR"),
            "main_promise": product_analysis.get("main_promise", "Promessa não identificada")
        }

    def build_user_message(self, context: dict) -> str:
        msg = f"""Faça a pesquisa de mercado para este produto e gere o laudo de viabilidade.
Produto: {context['product_name']}
Nicho Principal: {context['product_niche']}
Target Geo (País alvo): {context['target_country']}
Ticket de Venda Estimado: R${context['ticket_price']}
Porcentagem de Comissão ao vender: {context['commission_percent']}%
Promessa Principal identificada antes: "{context['main_promise']}"

Por favor, calcule a margem e busque o volume de concorrências se possível. Se a margem for baixa (ex: menor que R$50) ou a concorrência esmagadora sem diferencial, considere not_viable. Redija a justificativa e os resultados na formatação JSON requerida.
"""
        return msg

    def evaluate_output(self, output: Any, context: dict) -> tuple[bool, str]:
        if not isinstance(output, dict):
            return False, f"O output esperado era um dict (JSON válido), recebido: {type(output).__name__}."
        
        sources = output.get("data_sources", [])
        if not sources or not isinstance(sources, list) or len(sources) == 0:
            return False, "O campo 'data_sources' deve existir e não pode estar vazio para comprovar validade real dos dados."
            
        justification = output.get("viability_justification", "")
        if not justification or len(justification) < 100:
            return False, "A 'viability_justification' deve ter mais de 100 caracteres embasando o veredito seriamente."
        
        verdict = output.get("viability_verdict", "")
        if verdict not in ["viable", "not_viable"]:
            return False, "O 'viability_verdict' deve ser estritamente 'viable' ou 'not_viable'."
            
        return True, ""

    def write_to_state(self, output: Any, state: dict) -> dict:
        state["market"] = output
        return state
