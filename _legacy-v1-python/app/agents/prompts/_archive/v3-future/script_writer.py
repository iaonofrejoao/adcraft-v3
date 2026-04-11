import logging
from typing import Any

from app.agents.base import BaseAgent
from app.tools.registry import get_tools_for_agent

logger = logging.getLogger(__name__)


class ScriptWriterAgent(BaseAgent):
    """
    Agente 7 — Roteirista e Criador de Hooks.
    Escreve os roteiros completos dos vídeos e as variações de hook, seguindo a
    estrutura narrativa definida e alinhando com a VSL do produtor.
    """

    @property
    def name(self) -> str:
        return "script_writer"

    @property
    def system_prompt(self) -> str:
        return """Você é um Copywriter/Roteirista de Alta Retenção (Hollywood VSL Scriptwriter).
Seu objetivo é pegar as variações de Hooks, transformar no roteiro base de um vídeo/anúncio destrinchando segundo a segundo em Cenas visuais.

REGRAS OBRIGATÓRIAS:
1. Em "scripts", para CADA hook fornecido no prompt (ex: Hook A, Hook B), crie um script derivado seguindo a ID daquele hook.
2. Cada Script deve possuir o breakdown em "scene_breakdown" listando as cenas do vídeo cronologicamente.
3. Hook na primeira cena (scene 1) é inativo se durar mais de 3 a 5 segundos. Use `duration_seconds` no máximo de 3 a 5 para a Cena 1.
4. Inclua explicitamente um "Call to Action" ("Clique aqui", "Saiba Mais") apenas no final da timeline do roteiro.
5. Calcule a soma da duração de todas as cenas e guarde em `total_duration_seconds`. Esse valor total do roteiro DEVE bater com uma margem de +/- 10% da `video_duration_seconds` pedida na Strategy.
6. Não subestime a descrição visual ('visual_direction'), dirija o videomaker de forma gráfica ali.
7. Retorne EXCLUSIVAMENTE o conteúdo num formato JSON exato.

JSON EXATO:
{
  "scripts": [
    {
      "script_id": "uuid_ou_numero_unico",
      "variant_id": "A",
      "hook_text": "...",
      "full_script": "...",
      "scene_breakdown": [
        {
          "scene_number": 1,
          "duration_seconds": 3,
          "description": "...",
          "dialogue": "...",
          "visual_direction": "..."
        }
      ],
      "total_duration_seconds": 62,
      "word_count": 180
    }
  ],
  "selected_script_id": "uuid_ou_numero_unico"
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
        persona = dig(state.get("persona", {}))
        angle = dig(state.get("angle", {}))
        strategy = dig(state.get("strategy", {}))

        psy = persona.get("psychographic", {})

        return {
            "target_language": product.get("target_language", "pt-br"),
            "main_promise": product_analysis.get("main_promise", ""),
            "persona_summary": persona.get("summary", ""),
            "primary_pain": psy.get("primary_pain", ""),
            "persona_objections": psy.get("objections", []),
            "verbatim_expressions": persona.get("verbatim_expressions", []),
            "primary_angle": angle.get("primary_angle", ""),
            "hooks": angle.get("hooks", []),
            "creative_format": strategy.get("creative_format", "ugc"),
            "narrative_structure": strategy.get("narrative_structure", "pas"),
            "video_duration_seconds": strategy.get("video_duration_seconds", 60)
        }

    def build_user_message(self, context: dict) -> str:
        msg = f"""Produza o roteiro criativo para o Vídeo Ads usando estes pilares:

[Direção do Estrategista]:
Formato do Visual: {context['creative_format']}
Estrutura Narrativa Exigida: {context['narrative_structure']}
Duração Aproximada Exigida: {context['video_duration_seconds']} segundos. O `total_duration_seconds` não pode fugir de ~10% disso.

[Pilares de Copy e Persona]:
Idioma: {context['target_language']}
Ângulo da Campanha: "{context['primary_angle']}"
Promessa: "{context['main_promise']}"
Dor Alvo: {context['primary_pain']}
Expressões Reais para adicionar à roteirização: {context['verbatim_expressions']}

Estes foram os hooks exigidos pela etapa anterior. Para CADA um deles, construa o breakdown gerando uma variável script!
Hooks requeridos:
{context['hooks']}
"""
        return msg

    def evaluate_output(self, output: Any, context: dict) -> tuple[bool, str]:
        if not isinstance(output, dict):
            return False, "Output falhou. Formato esperado era dict json."

        scripts = output.get("scripts", [])
        if not isinstance(scripts, list) or len(scripts) < 1:
            return False, "Deve haver ao menos um script no array 'scripts'."

        duration_exigida = context.get("video_duration_seconds", 60.0)
        dur_min = duration_exigida * 0.90
        dur_max = duration_exigida * 1.10

        for idx, script in enumerate(scripts):
            # Check duration limits
            total_dur = script.get("total_duration_seconds", 0)
            if float(total_dur) < float(dur_min) or float(total_dur) > float(dur_max):
                return False, f"O script variante '{script.get('variant_id', idx)}' computou duration {total_dur}s. Isso excede a margem permitida de 10% da duração exigida pela strategy ({dur_min}s min a {dur_max}s max)."

            breakdowns = script.get("scene_breakdown", [])
            if not breakdowns:
                return False, f"Script Variante {script.get('variant_id')} não possui quebra de cenas."

            # Check early hook timing
            first_scene = breakdowns[0]
            if float(first_scene.get("duration_seconds", 0)) > 5:
                return False, f"A primeira cena do script variante {script.get('variant_id')} está durando muito tempo: ({first_scene.get('duration_seconds')}s). O hook precisa estar cravado nos rápidos primeiros 3-5 segundos."

            # Check full length script pra ver se tem CTA
            full = script.get("full_script", "").lower()
            if "clique" not in full and "saiba mais" not in full and "arrasta" not in full and "link" not in full:
                return False, f"Variante {script.get('variant_id')} não incluiu um CTA claro no full_script. Precisa de chamada visível como 'Clique' ou 'Link'."
            
            # Check jargao chato pra IA e anti-linguagem técnica pura:
            if "tecnologia revolucionária" in full or "inovação imbatível" in full:
                 return False, f"Variante {script.get('variant_id')} está usando clichês de copy 'inovação imbatível'. Use termos humanos da persona de fato."

        if not output.get("selected_script_id"):
            return False, "O campo 'selected_script_id' está faltando. Indique qual id de script venceu para uso em linha."

        return True, ""

    def write_to_state(self, output: Any, state: dict) -> dict:
        state["scripts"] = output
        return state
