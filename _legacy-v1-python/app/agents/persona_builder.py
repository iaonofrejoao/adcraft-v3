import logging
from typing import Any

from app.agents.base import BaseAgent
from app.tools.registry import get_tools_for_agent

logger = logging.getLogger(__name__)


class PersonaBuilderAgent(BaseAgent):
    """
    Agente 3 — Construtor de Persona e Público.
    Constrói a persona ideal usando dados reais extraídos de mídias e da promessa do produto.
    """

    @property
    def name(self) -> str:
        return "persona_builder"

    @property
    def system_prompt(self) -> str:
        return """Você é um Estrategista de Público (Audience Architect) de alto rendimento.
Sua missão é extrair dados verossímeis da internet para construir o perfil psicográfico e demográfico profundo do usuário que quer o produto.

REGRAS OBRIGATÓRIAS:
1. Toda a inteligência da persona tem que vir de expressões verídicas usando as tools para pesquisa (YouTube comentários, forúns, ReclameAqui, MercadoLivre, Amazon etc). 
2. 'summary' deve conter 3 a 4 frases sendo denso e direto. Ele servirá de única referência para copywriters preguiçosos.
3. 'primary_pain' DEVE ser descrita como se fosse a própria pessoa falando da dor íntima (Coloquial e não algo clínico como "Insuficiência da epiderme").
4. 'verbatim_expressions' exige no mínimo 3 itens contendo frases e jargões reais literais da comunidade encontrada nos dados.
5. 'data_sources' exige os links originais pesquisados.
6. Não invente perfis! Caso o produto seja totalmente nichado sem reviews aparentes, derive psicografia similar da dor e avise nos data_sources. 
7. Retorne EXCLUSIVAMENTE um JSON com este exato formato (Sem markup markdown ```json):
{
  "summary": "...",
  "full_profile": {
    "fictional_name": "...",
    "age_range": "35-45",
    "gender": "...",
    "location": "...",
    "income_level": "...",
    "education": "...",
    "occupation": "..."
  },
  "psychographic": {
    "primary_pain": "...",
    "secondary_pains": ["..."],
    "primary_desire": "...",
    "secondary_desires": ["..."],
    "tried_before": ["..."],
    "objections": ["..."],
    "language_style": "..."
  },
  "verbatim_expressions": ["...", "...", "..."],
  "data_sources": ["..."]
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

        if hasattr(product, "dict"): product = product.dict()
        if hasattr(product_analysis, "dict"): product_analysis = product_analysis.dict()
        if hasattr(market, "dict"): market = market.dict()

        return {
            "product_name": product.get("name", "N/A"),
            "product_niche": product.get("niche", "N/A"),
            "target_country": product.get("target_country", "BR"),
            "target_language": product.get("target_language", "pt-BR"),
            "main_promise": product_analysis.get("main_promise", "Sem promessa"),
            "pain_points_identified": product_analysis.get("pain_points_identified", []),
            "avatar_description": product_analysis.get("avatar_description", ""),
            "competition_level": market.get("competition_level", "medium")
        }

    def build_user_message(self, context: dict) -> str:
        msg = f"""O produto chama-se "{context['product_name']}" (Nicho: {context['product_niche']}).
Local de venda principal: {context['target_country']}, Idioma: {context['target_language']}
Promessa Principal detectada do produto: "{context['main_promise']}"
Descrição inicial percebida: "{context['avatar_description']}"
As dores inicialmente listadas do PRD: {context['pain_points_identified']}
Nível de competição de mercado: {context['competition_level']}

Realize buscas via ferramenta para cavar o psicológico da persona.
Sintetize quem é.
"""
        return msg

    def evaluate_output(self, output: Any, context: dict) -> tuple[bool, str]:
        if not isinstance(output, dict):
            return False, "Output falhou. Era esperado formato JSON que converta para Dict Python."

        verbatims = output.get("verbatim_expressions", [])
        if not isinstance(verbatims, list) or len(verbatims) < 3:
            return False, "O array 'verbatim_expressions' precisa conter no mínimo 3 expressões literais extraídas."

        sources = output.get("data_sources", [])
        if not isinstance(sources, list) or len(sources) == 0:
            return False, "O campo 'data_sources' não pode estar vazio, mostre onde colheu."

        summary = output.get("summary", "")
        if len(summary) < 40 or '.' not in summary:
            return False, "O 'summary' deve ser denso com múltiplas frases para orientar a copywriter adequadamente."

        # Checar se primary pain existe e não é apenar uma só palavra (evitar coisas técnicas resumidas estilo "Cefaleia")
        psy = output.get("psychographic", {})
        pain = psy.get("primary_pain", "")
        if " " not in pain or len(pain) < 10:
            return False, "Ocampo 'primary_pain' deve estar em linguagem coloquial escrita como frase discursiva."

        return True, ""

    def write_to_state(self, output: Any, state: dict) -> dict:
        state["persona"] = output
        return state
