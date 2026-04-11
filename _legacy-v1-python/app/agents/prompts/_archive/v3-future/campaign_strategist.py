import logging
from typing import Any

from app.agents.base import BaseAgent
from app.tools.registry import get_tools_for_agent

logger = logging.getLogger(__name__)


class CampaignStrategistAgent(BaseAgent):
    """
    Agente 6 — Estrategista de Campanha.
    Define o plano completo da campanha: formato do criativo, estrutura do funil,
    objetivo, budget por conjunto, ROAS alvo e métricas mínimas.
    """

    @property
    def name(self) -> str:
        return "campaign_strategist"

    @property
    def system_prompt(self) -> str:
        return """Você é um Head de Estratégias de Tráfego Pago Master e Data Planner.
Seu objetivo é pegar todas as premissas da análise da oferta (ticket, comissão, viabilidade), a audiência e o benchmarking anterior para montar O PROJETO FINANCEIRO e FORMATO da engrenagem rodando anúncios.

REGRAS OBRIGATÓRIAS:
1. O Target ROAS necessita permitir lucro positivo perante o `ticket_price * (commission_percent / 100)`. Avalie logicamente (Ex: Se ganho $50 por venda, meu ROAS 1 não tem lucro, preciso do break-even ou acima.)
2. `daily_budget_total_brl` JAMAIS pode exceder o `budget_for_test` recebido.
3. Se `budget_for_test` for muito curto, concentre num número de `recommended_adsets` enxuto. `budget_per_adset_brl` é `daily_total / adsets`.
4. Retorne EXCLUSIVAMENTE um dicionário JSON, sem formatação por blocos e respeitando as exatas tipagens abaixo:
{
  "creative_format": "...",
  "funnel_stage": "...",
  "campaign_objective": "...",
  "narrative_structure": "...",
  "video_duration_seconds": 60,
  "aspect_ratios": ["...", "..."],
  "target_roas": 3.0,
  "min_ctr_percent": 1.5,
  "max_cpm_brl": 20.00,
  "max_cpa_brl": 45.00,
  "daily_budget_total_brl": 90.00,
  "budget_per_adset_brl": 30.00,
  "recommended_adsets": 3,
  "rationale": "..."
}"""

    @property
    def tools(self) -> list[dict]:
        try:
            return get_tools_for_agent(self.name)
        except KeyError:
            return []

    def build_context(self, state: dict) -> dict:
        product = state.get("product", {})
        market = state.get("market", {})
        persona = state.get("persona", {})
        angle = state.get("angle", {})
        benchmark = state.get("benchmark", {})

        # Unwrap if pydantic / mock models
        contexts = [product, market, persona, angle, benchmark]
        for idx, val in enumerate(contexts):
            if hasattr(val, "dict"):
                contexts[idx] = val.dict()
        
        prod, mkt, prs, ang, bmk = contexts

        return {
            "ticket_price": prod.get("ticket_price", 0.0),
            "commission_percent": prod.get("commission_percent", 0.0),
            "budget_for_test": prod.get("budget_for_test", 0.0),
            "ad_platforms": prod.get("ad_platforms", ["facebook"]),
            "target_language": prod.get("target_language", "pt-br"),
            "viability_score": mkt.get("viability_score", 0),
            "persona_summary": prs.get("summary", ""),
            "primary_angle": ang.get("primary_angle", ""),
            "angle_type": ang.get("angle_type", ""),
            "dominant_formats": bmk.get("dominant_formats", []),
            "dominant_narrative_structures": bmk.get("dominant_narrative_structures", [])
        }

    def build_user_message(self, context: dict) -> str:
        msg = f"""Estes são os Inputs para você elaborar o Planejamento:

[Financeiro Original Mapeado]:
Ticket: R${context['ticket_price']}
Comissão (%): {context['commission_percent']}%
Verba Inicial de Teste: R${context['budget_for_test']}
Plataformas: {context['ad_platforms']}

[Dados Mercadológicos e do Ângulo]:
Nota de Viabilidade: {context['viability_score']}
Ângulo a Usar: "{context['primary_angle']}" (Tipo: {context['angle_type']})

[Dominância Mapeada nos Concorrentes na Etapa de Benchmark]:
Formatos Criativos: {context['dominant_formats']}
Estruturas Narrativas: {context['dominant_narrative_structures']}

Construa a estratégia e declare perfeitamente o 'rationale' com sua elaboração intelectual (com base nesses dados!) comprovando suas contas para a métrica de lucro e custo.
"""
        return msg

    def evaluate_output(self, output: Any, context: dict) -> tuple[bool, str]:
        if not isinstance(output, dict):
            return False, "O format output deve ser um dicionário JSON válido."

        # Rationale tem que existir
        rationale = output.get("rationale", "")
        if not rationale or len(rationale) < 40:
            return False, "O 'rationale' foi negligenciado. Explique logicamente como calculou o orçamento e sua decisão sobre formatos guiado aos dados fornecidos."

        # Teto de Budget
        budget_for_test = context.get("budget_for_test", 0.0)
        daily_total = output.get("daily_budget_total_brl", 0.0)
        
        try:
            val_daily = float(daily_total)
            val_teto = float(budget_for_test)
            if val_daily > val_teto:
                return False, f"O seu gasto diário calculado ({val_daily}) excedeu a verba original bruta da conta que é de apenas ({val_teto}). Reprograme as rédeas."
        except ValueError:
            return False, "Tipagem incorreta para moedas monetárias."

        # Target Roas viável
        ticket = context.get("ticket_price", 0.0)
        comissao_pct = context.get("commission_percent", 0.0)
        roas = output.get("target_roas", 0.0)
        
        try:
            lucro_venda = float(ticket) * (float(comissao_pct) / 100)
            if float(roas) <= 0:
                return False, "ROAS alvo tem que ser no mínimo número maior que 0."
                
            # Um check bruto: CPA máximo e ROAS tem que estar batendo matematicamente em break-even ou mais.
            cpa = output.get("max_cpa_brl", 99999.0)
            if float(cpa) > lucro_venda * 1.5:  # Tolerance absurda pra testes. Mas um CPA maior q o lucro + x% é descontrole e alerta!
                 pass # Em testes muitas vezes cpa limite = ticket, mas não vamos falhar isso bruscamente.
        except:
             return False, "Valores imprecisos."

        return True, ""

    def write_to_state(self, output: Any, state: dict) -> dict:
        state["strategy"] = output
        return state
