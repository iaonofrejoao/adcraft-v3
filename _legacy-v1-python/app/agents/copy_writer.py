import logging
from typing import Any

from app.agents.base import BaseAgent
from app.tools.registry import get_tools_for_agent

logger = logging.getLogger(__name__)


class CopywriterAgent(BaseAgent):
    """
    Agente 8 — Copywriter.
    Escreve todos os textos dos anúncios: headlines, body copy, CTAs e variações A/B.
    """

    @property
    def name(self) -> str:
        return "copy_writer"

    @property
    def system_prompt(self) -> str:
        return """Você é um Copywriter Direto de Performance (DR Copywriter).
Seu objetivo é escrever Headlines, Textos de Apoio (Body Copy) e CTAs para anúncios que rodam ativamente integrados às plataformas selecionadas.

REGRAS OBRIGATÓRIAS:
1. Gere NO MÍNIMO 5 headlines englobando as plataformas alvo ('facebook' ou 'google'). 
2. As Headlines para 'facebook' não podem passar de 40 caracteres, e de 'google' até 30 caracteres. É estritamente limitante.
3. Insira OBRIGATORIAMENTE, copiando exatamente ipsis-litteris, alguma das expressões da dor do público (`verbatim_expressions`) dentro das Textos (Body Copy Short ou Long).
4. Escreva uma versão Curta ('body_copy_short') direto ao ponto até 125 chars, e uma Longa ('body_copy_long') de storytelling até 500 chars.
5. Em CTAs crie chamadas hiperativas. EVITE usar chamadas genéricas passivas do tipo ("Clique aqui", "Comprar"). Traga CTAs de micro-compromisso (ex: "Descobrir as Falhas", "Quero Acessar o Mapa").
6. Retorne EXCLUSIVAMENTE formato estrito JSON:
{
  "headlines": [
    {"text": "...", "char_count": 32, "variant_id": "H1", "platform": "facebook"}
  ],
  "body_copy_short": "...",
  "body_copy_long": "...",
  "cta_options": ["...", "..."],
  "selected_headline": "...",
  "selected_body": "...",
  "selected_cta": "..."
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
        persona = dig(state.get("persona", {}))
        angle = dig(state.get("angle", {}))

        return {
            "product_name": product.get("name", "N/A"),
            "target_language": product.get("target_language", "pt-br"),
            "ad_platforms": product.get("ad_platforms", ["facebook"]),
            "persona_summary": persona.get("summary", ""),
            "verbatim_expressions": persona.get("verbatim_expressions", []),
            "primary_angle": angle.get("primary_angle", ""),
            "selected_hook_variant": angle.get("selected_hook_variant", ""),
        }

    def build_user_message(self, context: dict) -> str:
        msg = f"""Produza as variações de Copy para rodar nessas plataformas: {context['ad_platforms']}

[Produto e Alinhamento]:
Produto: {context['product_name']} 
Língua: {context['target_language']}
Ângulo a seguir: {context['primary_angle']}

[Voz do Público]:
As Seguintes Expressões DEVERÃO aparecer e ser mixadas na sua copy longa ou curta, como ponto de conexão profunda. (Obrigatório!):
Expressões do Publico: {context['verbatim_expressions']}

Crie headlines esmagadoras e textos instintivos.
"""
        return msg

    def evaluate_output(self, output: Any, context: dict) -> tuple[bool, str]:
        if not isinstance(output, dict):
            return False, "Output falhou. Formato esperado era dict type JSON."

        headlines = output.get("headlines", [])
        if not isinstance(headlines, list) or len(headlines) < 5:
            return False, "O array de headlines precisa conter pelo menos 5 abordagens elaboradas."

        # Checar chars das headlines
        for h in headlines:
            txt = h.get("text", "")
            plat = h.get("platform", "facebook").lower()
            tamanho = len(txt)
            if plat == "facebook" and tamanho > 40:
                return False, f"A Headline de variant_id {h.get('variant_id')} excede o limite estrito do facebook de 40 chars. Ela possui: {tamanho} chars. Reescreva menor e direto ao ponto."
            if plat == "google" and tamanho > 30:
                return False, f"A Headline de variant_id {h.get('variant_id')} excede o limite estrito do Google Search de 30 chars. Ela possui: {tamanho} chars. Reescreva enxuta."

        # Checar se pelo menos 1 verbatim está na copy (short or long)
        verbatims = context.get("verbatim_expressions", [])
        body_short = output.get("body_copy_short", "").lower()
        body_long = output.get("body_copy_long", "").lower()
        copy_total = body_short + " " + body_long
        
        has_verbatim = False
        for verb in verbatims:
            # Algumas IAs alteram pontuação, mas testamos contain do fragmento
            if verb.lower().strip() in copy_total:
                has_verbatim = True
                break
        
        if not has_verbatim and verbatims:
            return False, f"As suas copies parecem não utilizar as expressões reais pedidas. Use PELO MENOS uma delas idênticamente: {verbatims} na escrita para atestar veracidade com o público alvo."

        # Check Genérico e preguiçoso "Clique aqui" no Array de CTA options
        ctas = output.get("cta_options", [])
        for cta in ctas:
            if cta.lower().strip() == "clique aqui":
                return False, "Call To Action banido detectado: 'clique aqui'. Seja criativo, hiper-ativo e gere microcompromisso."

        return True, ""

    def write_to_state(self, output: Any, state: dict) -> dict:
        state["copy"] = output
        return state
