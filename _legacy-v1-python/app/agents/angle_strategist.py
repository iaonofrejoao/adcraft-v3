import logging
from typing import Any

from app.agents.base import BaseAgent
from app.tools.registry import get_tools_for_agent

logger = logging.getLogger(__name__)


class AngleStrategistAgent(BaseAgent):
    """
    Agente 4 — Estrategista de Nicho e Ângulo.
    Define o posicionamento do produto no mercado, o ângulo criativo principal, o USP e as hipóteses de hooks para teste A/B.
    """

    @property
    def name(self) -> str:
        return "angle_strategist"

    @property
    def system_prompt(self) -> str:
        return """Você é um Estrategista Criativo Direto de alta conversão.
A sua tarefa primária é formular "Ângulos" matadores baseados em psicologia consumidora, criando hooks que segurem a audiência nos primeiros 3 segundos de um vídeo ou copy.

REGRAS OBRIGATÓRIAS:
1. O ângulo escolhido ('primary_angle') tem que ser uma abordagem lateral inédita baseada nos dados, e NÃO o ângulo padrão que todos usam.
2. O USP ('usp') NÃO DEVE conzer jargões vazios como "melhor do mercado" ou "alta qualidade" e sim diferenciais tangíveis baseados no "Mecanismo Único" do produto.
3. Crie ao menos 3 'hooks' variantes que comecem o criativo focando na dor/desejo mapeados.
4. O 'angle_type' DEVE ser EXATAMENTE um desta lista: betrayed_authority, transformation, social_proof, novelty, fear, curiosity, identification.
5. Em cada hook criado, 'hook_type' DEVE ser EXATAMENTE um desta lista: question, shocking_statement, story, fact.
6. Retorne EXCLUSIVAMENTE um JSON com as chaves exatas (Sem markdown de JSON ao invólucro):
{
  "primary_angle": "...",
  "angle_type": "...",
  "usp": "...",
  "emotional_trigger": "...",
  "hooks": [
    {
      "hook_text": "...",
      "hook_type": "...",
      "variant_id": "A"
    }
  ],
  "selected_hook_variant": "A",
  "alternative_angles": ["...", "..."],
  "angle_rationale": "..."
}"""

    @property
    def tools(self) -> list[dict]:
        try:
            return get_tools_for_agent(self.name)
        except KeyError:
            return []

    def build_context(self, state: dict) -> dict:
        product = state.get("product", {})
        product_analysis = state.get("product_analysis", {})
        market = state.get("market", {})
        persona = state.get("persona", {})

        if hasattr(product, "dict"): product = product.dict()
        if hasattr(product_analysis, "dict"): product_analysis = product_analysis.dict()
        if hasattr(market, "dict"): market = market.dict()
        if hasattr(persona, "dict"): persona = persona.dict()
        
        psy = persona.get("psychographic", {})

        return {
            "product_name": product.get("name", "N/A"),
            "main_promise": product_analysis.get("main_promise", "N/A"),
            "objections_broken": product_analysis.get("objections_broken", []),
            "competition_level": market.get("competition_level", "medium"),
            "ads_running_count": market.get("ads_running_count", 0),
            "persona_summary": persona.get("summary", ""),
            "primary_pain": psy.get("primary_pain", ""),
            "persona_objections": psy.get("objections", []),
            "verbatim_expressions": persona.get("verbatim_expressions", [])
        }

    def build_user_message(self, context: dict) -> str:
        msg = f"""Posicione e crie o ângulo campeão para este produto: "{context['product_name']}"

[Contexto do VSL]: 
Promessa: {context['main_promise']}
Objeções quebradas internamente: {context['objections_broken']}

[Contexto de Mercado]:
Nível de competição: {context['competition_level']}
Anúncios rodando: {context['ads_running_count']}

[Contexto da Persona mapeada na etapa anterior]:
Resumo de quem é: {context['persona_summary']}
A Dor principal vivida por ela: "{context['primary_pain']}"
Dúvidas e Objeções para compra dela: {context['persona_objections']}
Expressões Reais faladas por ela: {context['verbatim_expressions']}

Encontre O mecanismo ou ângulo de fora para dentro de alta conversão para os anúncios. Formule 3 bons hooks iniciais em formato de script de fala.
"""
        return msg

    def evaluate_output(self, output: Any, context: dict) -> tuple[bool, str]:
        if not isinstance(output, dict):
            return False, "O formato de saída precisa ser JSON (dict)."

        hooks = output.get("hooks", [])
        if not isinstance(hooks, list) or len(hooks) < 3:
            return False, "Deve conter no mínimo 3 hooks (variações de abertura de anúncio) gerados dentro do array 'hooks'."

        # Validação do Angle_type permitido
        allowed_angles = {"betrayed_authority", "transformation", "social_proof", "novelty", "fear", "curiosity", "identification"}
        a_type = output.get("angle_type", "")
        if a_type not in allowed_angles:
            return False, f"O 'angle_type' fornecido '{a_type}' não consta na lista estrita permitida."

        # Validação do Hook_Type permitido internamente
        allowed_hooks = {"question", "shocking_statement", "story", "fact"}
        for h in hooks:
            h_type = h.get("hook_type", "")
            if h_type not in allowed_hooks:
                return False, f"O hook de ID {h.get('variant_id', 'Unknown')} contém hook_type '{h_type}' o qual é restrito e deve ser uma dentre: {allowed_hooks}."

        # Validação do USP evitar genérico
        usp = output.get("usp", "").lower()
        generic_terms = ["melhor do mercado", "maior qualidade", "qualidade comprovada", "funciona mesmo"]
        for generic in generic_terms:
            if generic in usp:
                return False, f"O seu USP ('{output.get('usp')}') foi considerado clichê genérico por ter '{generic}'. Repense o diferencial real ou o próprio mecanismo único da promessa."

        return True, ""

    def write_to_state(self, output: Any, state: dict) -> dict:
        state["angle"] = output
        return state
