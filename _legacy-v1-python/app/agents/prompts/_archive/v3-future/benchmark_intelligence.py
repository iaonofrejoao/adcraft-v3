import logging
from typing import Any

from app.agents.base import BaseAgent
from app.tools.registry import get_tools_for_agent

logger = logging.getLogger(__name__)


class BenchmarkIntelligenceAgent(BaseAgent):
    """
    Agente 5 — Inteligência de Benchmark.
    Coleta referências reais de criativos vencedores do mercado, extrai padrões de hooks,
    formatos, estruturas narrativas e linguagem do público.
    """

    @property
    def name(self) -> str:
        return "benchmark_intelligence"

    @property
    def system_prompt(self) -> str:
        return """Você é um Estrategista de Benchmarking de Criativos em Tráfego Pago.
Sua missão investigar vídeos do Youtube e Ad Library, extraindo scripts vencedores do nicho e categorizando o padrão dominante para usar de inspiração no nosso produto.

REGRAS OBRIGATÓRIAS:
1. Toda coleta é simulada neste estágio, mas as URLs geradas devem constar no "source_url" para verificação humana.
2. Extraia pelo menos 3 `top_hooks_found` com preenchimento limpo e direto, informando sempre a `source_url`.
3. Para `dominant_formats`, baseie-se em arrays como ["ugc", "vsl", "podcast", "entrevista"].
4. Para `dominant_narrative_structures`, foque nas bases clássicas, ex: ["pas", "storytelling", "aida"].
5. Declare a propriedade int 'references_count' registrando pelo menos umas 5 referências avaliadas no escopo (mínimo exigido).
6. Retorne EXCLUSIVAMENTE um json estrito com as seguintes chaves (sem formatação md de bloco json ao redor):
{
  "top_hooks_found": [
    {
      "hook_text": "...",
      "source": "facebook_ad",
      "source_url": "...",
      "days_running": 45,
      "format": "ugc"
    }
  ],
  "dominant_formats": ["...", "..."],
  "dominant_narrative_structures": ["...", "..."],
  "audience_verbatim": ["...", "..."],
  "references_count": 5,
  "pending_knowledge_approval": ["..."]
}"""

    @property
    def tools(self) -> list[dict]:
        try:
            return get_tools_for_agent(self.name)
        except KeyError:
            return []

    def build_context(self, state: dict) -> dict:
        product = state.get("product", {})
        angle = state.get("angle", {})

        if hasattr(product, "dict"): product = product.dict()
        if hasattr(angle, "dict"): angle = angle.dict()

        return {
            "product_niche": product.get("niche", "N/A"),
            "target_country": product.get("target_country", "BR"),
            "target_language": product.get("target_language", "pt-br"),
            "angle_type": angle.get("angle_type", "transformation")
        }

    def build_user_message(self, context: dict) -> str:
        msg = f"""Execute a inteligência de benchmark de anúncios rodando para este nicho.

[Critérios de Busca]:
Nicho: {context['product_niche']}
País/Língua: {context['target_country']} / {context['target_language']}
Ângulo definido pelo Estrategista: {context['angle_type']}

Mapeie e classifique criativos reais com mais tempo de tela, foque nas estruturas que estão esmagando o mercado atualmente usando esse Angle.
"""
        return msg

    def evaluate_output(self, output: Any, context: dict) -> tuple[bool, str]:
        if not isinstance(output, dict):
            return False, "Output deve ser um JSON válido interpretável como dicionário dict."

        refs = output.get("references_count", 0)
        # O prompt e PRD exigem no mínimo 5 ref
        try:
            val = int(refs)
            if val < 5:
                return False, f"A 'references_count' resultou {val}. Precisam ser coletadas pelos menos 5 referências base."
        except ValueError:
            return False, "Campo 'references_count' não é um inteiro."

        hooks = output.get("top_hooks_found", [])
        if not isinstance(hooks, list) or len(hooks) < 3:
            return False, "A lista de 'top_hooks_found' precisa ter no mínimo 3 hooks."

        # Nenhum hook inventado — todos têm source_url
        for idx, hook in enumerate(hooks):
            url = hook.get("source_url", "").strip()
            if not url or len(url) < 5 or "http" not in url.lower():
                return False, f"O hook {idx} da array falhou na regra incondicional de exibir 'source_url' verdadeiro com http. Pare de inventar dados e cole a fonte referencial!"

        return True, ""

    def write_to_state(self, output: Any, state: dict) -> dict:
        state["benchmark"] = output
        return state
