import logging
from typing import Any
from urllib.parse import urlparse, parse_qs

from app.agents.base import BaseAgent
from app.tools.registry import get_tools_for_agent

logger = logging.getLogger(__name__)


class UtmStructurerAgent(BaseAgent):
    """
    Agente 14 — Estruturador de UTM e Link.
    Gera o link de afiliado com parâmetros UTM estruturados para rastreamento
    completo de cada criativo e campanha.
    """

    @property
    def name(self) -> str:
        return "utm_structurer"

    @property
    def system_prompt(self) -> str:
        return """Você é um Especialista de Tracking de Tráfego e Analista de Dados.
Seu objetivo é pegar o link base fornecido para venda/produto e criar as parametrizações padronizadas de UTM tracking.

REGRAS OBRIGATÓRIAS:
1. Sempre derive a utm_source da Plataforma que rodará o anúncio.
2. Formate utm_campaign utilizando o Nome base do Produto e o Formato Criativo ("meuproduto-ugc").
3. Construa a string url em "final_affiliate_url" exatamente concatenando a query. Se o link original já tiver ?, use & pra prender o primeiro UTM, ou ? se não possuir, mas retorne a URL completa testável!
4. Retorne as chaves do dicionário de tracking sem erros, obrigatoriamente neste exato schema JSON rigoroso:
{
  "utm_parameters": {
    "utm_source": "facebook",
    "utm_medium": "cpc",
    "utm_campaign": "detox-pro-ugc",
    "utm_content": "hook-autoridade-v1"
  },
  "final_affiliate_url": "http://seulinkbase.com?utm_source=xxx..."
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
        angle = dig(state.get("angle", {}))
        strategy = dig(state.get("strategy", {}))

        return {
            "affiliate_link": product.get("affiliate_link", "https://kiwify.com.br/generico123"),
            "product_name": product.get("name", "N/A"),
            "ad_platforms": product.get("ad_platforms", ["facebook"]),
            "angle_type": angle.get("angle_type", "padrao"),
            "creative_format": strategy.get("creative_format", "vsl")
        }

    def build_user_message(self, context: dict) -> str:
        msg = f"""Estruture os UTMs lógicos partindo dos seguintes insumos recebidos do funil:

[Dados de Rastreamento a Injetar]:
Link do Afiliado Original: {context['affiliate_link']}
Nome do Produto para a Tag Campaign: {context['product_name']}
Fontes das Plataformas que rodam os Ads: {context['ad_platforms']} (Basear utm_source nelas)
Ângulo pra usar na Tag Content: {context['angle_type']}
Formato de Vídeo pra Tracking: {context['creative_format']}

Analise o link raiz pra injetar perfeitamente os parâmetros via syntaxe HTML/URL.
"""
        return msg

    def evaluate_output(self, output: Any, context: dict) -> tuple[bool, str]:
        if not isinstance(output, dict):
            return False, "O Output falhou na tipagem! Retorne o bloco de chaves em dicionário JSON."

        params = output.get("utm_parameters", {})
        if not isinstance(params, dict):
            return False, "As utm_parameters não foram devolvidas numa chave de dicionário aninhada."

        required_utms = ["utm_source", "utm_medium", "utm_campaign", "utm_content"]
        for key in required_utms:
            if key not in params:
                 return False, f"Faltando a definição da tag obrigatória: {key} dentro do JSON de parâmetros."

        final_url = output.get("final_affiliate_url", "")
        if "http" not in final_url:
            return False, "A URL final falhou no construtor. Não aparenta iniciar com protocolo HTTP/HTTPS."
            
        # Validador de URL mal concatenada
        # Não pode ter espacos (A IA as vezes faz encode errado pro usuário final testar)
        if " " in final_url:
            return False, "A sua string de URL 'final_affiliate_url' contém espaços em branco. Como analista técnico, use slugs usando tracinhos (-)."

        # Teste brutal se tem as utms no texto final da string
        for _, val in params.items():
            if val not in final_url:
                return False, f"A URL gerada '{final_url}' falha grave: ela não incluiu visivelmente o valor da utm gerada ({val})."

        return True, ""

    def write_to_state(self, output: Any, state: dict) -> dict:
        state["tracking"] = output
        return state
