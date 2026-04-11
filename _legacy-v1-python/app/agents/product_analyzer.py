import logging
from typing import Any

from app.agents.base import BaseAgent
from app.tools.registry import get_tools_for_agent

logger = logging.getLogger(__name__)


class ProductAnalyzerAgent(BaseAgent):
    """
    Agente 1 — Analisador de VSL e Página de Vendas.
    Lê a VSL do produtor e a página de vendas, extrai a estrutura da oferta
    e gera o documento de contexto do produto que alimenta todos os agentes.
    """

    @property
    def name(self) -> str:
        return "product_analyzer"

    @property
    def system_prompt(self) -> str:
        return """Você é um Analisador de Ofertas Especialista.
Sua função é investigar a página de vendas e a VSL (Video Sales Letter) do produto para extrair o máximo de contexto comercial, identificando a promessa principal, dores, quebras de objeção e oferta.

REGRAS:
1. Toda afirmação factual requer origem. Se não encontrar dados para um campo, envie "data_unavailable" ou omita; nunca invente dados.
2. Utilize as ferramentas de pesquisa (read_page, transcribe_vsl) conforme a necessidade.
3. Seus resultados devem refletir perfeitamente as informações do produtor.
4. O output final deve obrigatoriamente ser em formato de dict JSON com as chaves: 
   "main_promise", "avatar_description", "pain_points_identified", "objections_broken", "hooks_used_in_vsl", "offer_details" (com price, guarantee_days, bonuses, cta_text), "narrative_structure", "vsl_transcription_status", "analysis_confidence" e "sources".
5. O output textual deve ser escrito no target_language especificado.
6. Nunca inclua ```json ou outros blocos na resposta JSON. Comece com { e termine com }.
"""

    @property
    def tools(self) -> list[dict]:
        # Supondo que "read_page", "transcribe_vsl", "search_web" etc. sejam ligadas
        # a "product_analyzer" em AGENT_TOOL_MAP do registry.py
        try:
            return get_tools_for_agent(self.name)
        except KeyError:
            # Caso registry não tenha AGENT_TOOL_MAP para ele, pode ignorar 
            # ou retornar arrays hardcoded pra prevenir dependência que não foi salva ainda.
            return []

    def build_context(self, state: dict) -> dict:
        """Extrai as propriedades de product base."""
        # Garantindo parsing caso seja Pydantic ou dict puro
        product = state.get("product", {})
        if hasattr(product, "dict"):
            product = product.dict()

        return {
            "product_name": product.get("name", "Desconhecido"),
            "product_url": product.get("product_url", ""),
            "affiliate_link": product.get("affiliate_link", ""),
            "vsl_url": product.get("vsl_url", None),
            "target_language": product.get("target_language", "pt-BR")
        }

    def build_user_message(self, context: dict) -> str:
        msg = f"""Analise este produto preenchendo todos os dados necessários.
Nome: {context['product_name']}
Idioma desejado de saída: {context['target_language']}
Página de vendas: {context['product_url']}
Link de Checkout afiliado para mapeamento de URL: {context['affiliate_link']}
URL da VSL: {context['vsl_url'] if context['vsl_url'] else 'Nenhuma informada. Baseie-se apenas na página de vendas.'}

Por favor, use read_page para ler a página e transcribe_vsl se houver VSL. Após processar, retorne SOMENTE o JSON esquematizado.
"""
        return msg

    def evaluate_output(self, output: Any, context: dict) -> tuple[bool, str]:
        if not isinstance(output, dict):
            return False, f"O output esperado era um dict (JSON válido), recebido: {type(output).__name__}."
        
        main_promise = output.get("main_promise", "")
        if not main_promise or len(main_promise) < 20:
            return False, "A 'main_promise' está muito curta ou não existe. Ela deve conter a promessa transformacional detalhada (mínimo 20 caracteres)."
        
        lower_promise = main_promise.lower()
        if "produto de qualidade" in lower_promise or "este produto é bom" in lower_promise:
            return False, "A 'main_promise' é genérica. Seja específico sobre a transformação prometida na página ou VSL."
        
        if "offer_details" not in output or not isinstance(output["offer_details"], dict):
            return False, "O campo 'offer_details' deve ser um dicionário."
            
        return True, ""

    def write_to_state(self, output: Any, state: dict) -> dict:
        state["product_analysis"] = output
        return state
