"""
BaseAgent — classe abstrata que todos os agentes herdam.

Implementa o loop de execução com:
  - Chamada ao Claude com tool_use (loop agêntico completo)
  - Auto-avaliação do output com até max_retries tentativas
  - Injeção de feedback humano na primeira tentativa de reexecução
  - Compressão do histórico de tentativas anteriores (Regra 5 do PRD seção 4)
  - Registro de custo de tokens em USD via CostTracker
  - Rate limiting da API Anthropic via RateLimiter
  - Escrita do output no shared_state via StateManager

Regras globais de todos os agentes (PRD seção 4):
  1. Toda afirmação factual requer origem — nunca inventa dados.
  2. Hipóteses são sinalizadas com confidence: hypothesis.
  3. Auto-avaliação obrigatória. Máximo 2 retentativas automáticas.
  4. Contexto mínimo via ContextBuilder — nunca o estado completo.
  5. Histórico comprimido em retentativas — nunca o output completo anterior.
  6. Idioma do produto — outputs no idioma de state.product.target_language.
"""

from __future__ import annotations

import json
import logging
from abc import ABC, abstractmethod
from typing import Any

from google import genai
from google.genai import types

from app.orchestration.cost_tracker import CostTracker
from app.orchestration.rate_limiter import RateLimiter

logger = logging.getLogger(__name__)


class BaseAgent(ABC):
    """
    Classe base para todos os agentes de IA da plataforma AdCraft.

    Subclasses DEVEM implementar:
        - name (property)            — identificador único do agente
        - system_prompt (property)   — prompt de sistema com papel e regras
        - tools (property)           — definições de ferramentas disponíveis
        - build_context(state)       — extrai campos mínimos do shared_state
        - build_user_message(context)— constrói a mensagem do usuário para a tarefa
        - evaluate_output(output, context) — valida critérios de qualidade
        - write_to_state(output, state)    — escreve output no shared_state

    Subclasses PODEM sobrescrever:
        - max_retries (default: 2)   — máximo de retentativas automáticas
        - max_tokens (default: 4096) — tokens máximos na resposta
        - _parse_response(response)  — extrai output estruturado da resposta

    Uso:
        class PersonaBuilderAgent(BaseAgent):
            @property
            def name(self) -> str:
                return "persona_builder"
            ...

        agent = PersonaBuilderAgent(model="claude-opus-4-6")
        updated_state, metadata = await agent.run(state, cost_tracker, rate_limiter)
    """

    #: Máximo de tentativas automáticas (PRD seção 4, Regra 3: "Máximo 2 retentativas")
    max_retries: int = 2

    #: Tokens máximos na resposta do Claude
    max_tokens: int = 4096

    def __init__(self, model: str = "gemini-3.1-pro-preview") -> None:
        """
        Args:
            model: ID do modelo Gemini a ser usado. Default: gemini-3.1-pro-preview.
                   Use gemini-3.1-pro-preview para agentes que exigem raciocínio complexo.
                   Use gemini-3-flash-preview para tarefas simples de baixo custo.
        """
        from app.config import get_settings
        self.model = model
        self._client = genai.Client(api_key=get_settings().gemini_api_key)

    # ------------------------------------------------------------------
    # Propriedades e métodos abstratos — implementar em cada subclasse
    # ------------------------------------------------------------------

    @property
    @abstractmethod
    def name(self) -> str:
        """
        Identificador único do agente.
        Usado em logs, CostTracker e campo _STATE_FIELD_OWNERS do StateManager.
        Exemplo: "persona_builder", "script_writer", "compliance_checker"
        """

    @property
    @abstractmethod
    def system_prompt(self) -> str:
        """
        Prompt de sistema descrevendo o papel e as regras do agente.
        Deve incluir:
          - Papel e responsabilidade
          - Regras de qualidade específicas
          - Instrução de idioma (usar state.product.target_language)
          - Instrução de formato de output esperado (JSON)
        """

    @property
    @abstractmethod
    def tools(self) -> list[dict]:
        """
        Lista de definições de ferramentas disponíveis para este agente.
        Formato Anthropic tool_use. Retornar [] se o agente não usa ferramentas.
        """

    @abstractmethod
    def build_context(self, state: dict) -> dict:
        """
        Extrai apenas os campos que este agente precisa do shared_state.
        NÃO passe o state completo — use ContextBuilder.for_{agent_name}(state).

        Args:
            state: Shared state completo da execução (dict do banco).

        Returns:
            Dict com apenas os campos que este agente consome.
        """

    @abstractmethod
    def build_user_message(self, context: dict) -> str:
        """
        Constrói a mensagem do usuário com a tarefa do agente.
        O contexto já foi extraído por build_context().

        Args:
            context: Dict retornado por build_context().

        Returns:
            String com a mensagem completa para o Claude.
        """

    @abstractmethod
    def evaluate_output(self, output: Any, context: dict) -> tuple[bool, str]:
        """
        Avalia se o output atende aos critérios de qualidade (PRD seção 4, Regra 3).
        Chamado após cada tentativa. Se False, o agente retenta.

        Args:
            output: Output parseado de _parse_response().
            context: Contexto usado nessa rodada.

        Returns:
            (passed, failure_reason) — se passed=False, failure_reason explica o motivo.
        """

    @abstractmethod
    def write_to_state(self, output: Any, state: dict) -> dict:
        """
        Escreve o output deste agente no subcampo exclusivo do shared_state.
        Ex: state["persona"] = output  (apenas o campo deste agente).

        Args:
            output: Output parseado de _parse_response().
            state:  Shared state completo.

        Returns:
            State atualizado com o output deste agente escrito.
        """

    # ------------------------------------------------------------------
    # Loop principal de execução — não sobrescrever normalmente
    # ------------------------------------------------------------------

    async def run(
        self,
        state: dict,
        cost_tracker: CostTracker,
        rate_limiter: RateLimiter | None = None,
        human_feedback: str | None = None,
        node_id: str = "",
        execution_id: str = "",
    ) -> tuple[dict, dict]:
        """
        Loop de execução com auto-avaliação e retentativa automática.

        Fluxo por tentativa:
          1. Constrói mensagem (com feedback humano na primeira, histórico nas seguintes)
          2. Chama o Claude com tool_use (loop agêntico completo)
          3. Registra custo no CostTracker
          4. Parseia e avalia o output
          5. Se aprovado: escreve no state e retorna
          6. Se reprovado: comprime histórico e retenta
          7. Se esgotou max_retries: escreve o melhor output com quality_warning

        Args:
            state:          Shared state completo da execução.
            cost_tracker:   Instância do CostTracker da execução.
            rate_limiter:   RateLimiter — se None, cria um local (sem queue events).
            human_feedback: Feedback do usuário de uma reprovação manual anterior.
            node_id:        ID do nó no React Flow (para CostTracker e eventos WS).
            execution_id:   ID da execução (para eventos WebSocket via RateLimiter).

        Returns:
            (updated_state, run_metadata) onde run_metadata contém:
              attempts, auto_eval_passed, attempt_history, total_cost_usd
        """
        if rate_limiter is None:
            rate_limiter = RateLimiter()

        context = self.build_context(state)
        attempt_history: list[dict] = []
        last_output: Any = None
        last_failure: str = ""

        for attempt in range(self.max_retries + 1):
            logger.info(
                "Agente '%s' iniciando tentativa %d/%d (nó: %s, execução: %s)",
                self.name, attempt + 1, self.max_retries + 1, node_id, execution_id,
            )

            # ----------------------------------------------------------------
            # Monta a mensagem com contexto de tentativas anteriores
            # ----------------------------------------------------------------
            user_message = self.build_user_message(context)

            if human_feedback and attempt == 0:
                # Feedback humano de reprovação manual — injeta antes da tarefa
                user_message = (
                    f"Feedback humano sobre a tentativa anterior:\n{human_feedback}\n\n"
                    f"{user_message}"
                )

            if attempt_history:
                # Comprime histórico de falhas automáticas — Regra 5 do PRD
                history_summary = self._compress_attempt_history(attempt_history)
                user_message = f"{history_summary}\n\n{user_message}"

            # ----------------------------------------------------------------
            # Executa o loop agêntico com tool_use
            # ----------------------------------------------------------------
            try:
                output, call_cost = await self._run_agentic_loop(
                    user_message=user_message,
                    rate_limiter=rate_limiter,
                    cost_tracker=cost_tracker,
                    node_id=node_id,
                    execution_id=execution_id,
                    attempt=attempt + 1,
                )
            except Exception as exc:
                logger.error(
                    "Agente '%s' falhou na tentativa %d: %s",
                    self.name, attempt + 1, str(exc),
                )
                attempt_history.append({
                    "attempt": attempt + 1,
                    "output_summary": "",
                    "passed": False,
                    "failure_reason": f"Erro de execução: {exc}",
                })
                last_failure = str(exc)
                continue

            last_output = output

            # ----------------------------------------------------------------
            # Auto-avaliação do output (Regra 3 do PRD)
            # ----------------------------------------------------------------
            passed, failure_reason = self.evaluate_output(output, context)
            last_failure = failure_reason

            attempt_history.append({
                "attempt": attempt + 1,
                "output_summary": self._summarize_output(output),
                "passed": passed,
                "failure_reason": failure_reason if not passed else None,
            })

            if passed:
                state = self.write_to_state(output, state)
                logger.info(
                    "Agente '%s' concluiu com sucesso na tentativa %d.",
                    self.name, attempt + 1,
                )
                return state, {
                    "attempts": len(attempt_history),
                    "auto_eval_passed": True,
                    "attempt_history": attempt_history,
                    "total_cost_usd": cost_tracker.node_cost(node_id or self.name),
                }

            logger.warning(
                "Agente '%s' tentativa %d reprovada na auto-avaliação: %s",
                self.name, attempt + 1, failure_reason,
            )

        # ----------------------------------------------------------------
        # Esgotou max_retries — escreve o melhor output com quality_warning
        # (PRD seção 4, Regra 3: "entrega o melhor resultado com auto_eval_passed: false")
        # ----------------------------------------------------------------
        logger.error(
            "Agente '%s' esgotou %d tentativas. Escrevendo melhor output com flag de qualidade.",
            self.name, self.max_retries + 1,
        )

        if last_output is not None:
            state = self.write_to_state(last_output, state)

        # Registra aviso de qualidade no execution_meta
        if "execution_meta" not in state:
            state["execution_meta"] = {}
        if "quality_warnings" not in state["execution_meta"]:
            state["execution_meta"]["quality_warnings"] = []

        state["execution_meta"]["quality_warnings"].append({
            "agent": self.name,
            "message": f"Max retries ({self.max_retries}) atingido. Última falha: {last_failure}",
        })

        return state, {
            "attempts": len(attempt_history),
            "auto_eval_passed": False,
            "attempt_history": attempt_history,
            "total_cost_usd": cost_tracker.node_cost(node_id or self.name),
        }

    # ------------------------------------------------------------------
    # Loop agêntico com tool_use — gerencia múltiplas rodadas de ferramentas
    # ------------------------------------------------------------------

    async def _run_agentic_loop(
        self,
        user_message: str,
        rate_limiter: RateLimiter,
        cost_tracker: CostTracker,
        node_id: str,
        execution_id: str,
        attempt: int,
    ) -> tuple[Any, float]:
        """
        Executa o loop agêntico completo:
          1. Envia mensagem ao Gemini
          2. Se houver function_calls: executa as ferramentas e envia resultados
          3. Repete até retornar texto final (sem functions)
          4. Retorna o output final parseado

        Args:
            user_message:  Mensagem inicial do usuário.
            rate_limiter:  RateLimiter para a API Gemini.
            cost_tracker:  CostTracker da execução.
            node_id:       ID do nó para rastreamento.
            execution_id:  ID da execução para eventos WS.
            attempt:       Número da tentativa (para CostTracker).

        Returns:
            (output_parsed, total_call_cost_usd)
        """
        messages: list[types.Content] = [
            types.Content(role="user", parts=[types.Part.from_text(text=user_message)])
        ]
        total_cost = 0.0

        # Prepara config de chamada
        config_kwargs: dict[str, Any] = {
            "system_instruction": self.system_prompt,
            "temperature": 0.2, # Controlar alucinação (valor padrão conservador)
        }
        if self.tools:
            # Assuma que registry já montou de tool Anthropic para format_tool_for_gemini
            # como dict compatível com FunctionDeclaration properties.
            config_kwargs["tools"] = [{"function_declarations": self.tools}]

        call_config = types.GenerateContentConfig(**config_kwargs)
        
        while True:
            # Aguarda quota da API Gemini 
            await rate_limiter.acquire(
                "gemini",
                cost=1,
                execution_id=execution_id,
                node_id=node_id,
            )

            response = self._client.models.generate_content(
                model=self.model,
                contents=messages,
                config=call_config
            )

            # Registra custo desta chamada
            usage = response.usage_metadata
            input_tokens = usage.prompt_token_count if usage else 0
            output_tokens = usage.candidates_token_count if usage else 0
            call_cost = cost_tracker.record(
                agent_name=self.name,
                input_tokens=input_tokens,
                output_tokens=output_tokens,
                model=self.model,
                node_id=node_id or self.name,
                attempt=attempt,
            )
            total_cost += call_cost

            # Verifica se há tool_use (function calls no core SDK do Gemini)
            if not response.function_calls:
                output = self._parse_response(response)
                return output, total_cost

            # ----------------------------------------------------------------
            # Há tool_use — executa as ferramentas e envia resultados
            # ----------------------------------------------------------------
            tool_results_parts = await self._execute_tool_calls(response, rate_limiter, execution_id, node_id)

            # Adiciona a resposta do assistente (Texto se houver e chamadas das funções)
            assistant_parts = []
            if response.text and response.text.strip():
                assistant_parts.append(types.Part.from_text(text=response.text))
            
            for fc in response.function_calls:
                # O Part.from_function_call mapeia a intenção que o bot executou
                assistant_parts.append(
                    types.Part.from_function_call(name=fc.name, args=fc.args)
                )
            
            messages.append(types.Content(role="model", parts=assistant_parts))

            # Adiciona os retornos das tools (role user) em novos Parts
            messages.append(types.Content(role="user", parts=tool_results_parts))

    async def _execute_tool_calls(
        self,
        response: types.GenerateContentResponse,
        rate_limiter: RateLimiter,
        execution_id: str,
        node_id: str,
    ) -> list[types.Part]:
        """
        Executa todos os tool calls iterando por todos response.function_calls

        Returns:
            Lista de Parts do tipo FunctionResponse para o bot processar.
        """
        from app.tools.registry import dispatch_tool_call
        tool_results = []

        for fc in response.function_calls:
            tool_name = fc.name
            
            # fc.args pode ser dict se importado certinho ou objeto proto. Geralmente é convertido.
            # Se vier algo q podemos fazer dict(items), faremos isso
            tool_input = fc.args if isinstance(fc.args, dict) else (
                dict(fc.args) if hasattr(fc.args, "keys") else {}
            )

            logger.debug(
                "Agente '%s' chamando ferramenta '%s' com input: %s",
                self.name, tool_name, json.dumps(tool_input, ensure_ascii=False)[:200],
            )

            try:
                result = await dispatch_tool_call(
                    tool_name=tool_name,
                    tool_input=tool_input,
                    rate_limiter=rate_limiter,
                    execution_id=execution_id,
                    node_id=node_id,
                )
                
                # Se o resultado for dict, string, boolean ou number é serilizável e o Gemini SDK adora em `response`.
                if isinstance(result, str):
                    tool_dict = {"result": result}
                else:
                    tool_dict = result
                is_error = False

            except Exception as exc:
                logger.warning(
                    "Agente '%s': ferramenta '%s' retornou erro: %s",
                    self.name, tool_name, str(exc),
                )
                tool_dict = {"error": str(exc), "tool": tool_name}
                is_error = True

            # Cria um Part formatado para devolução da função no Gemini (o dicionário deve mapear pros retornos prováveis)
            # A classe types.Part aceita `.from_function_response` c/ name e response={str: str} nativos. 
            tool_results.append(
                types.Part.from_function_response(
                    name=tool_name,
                    response=tool_dict if isinstance(tool_dict, dict) else {"result": tool_dict}
                )
            )

        return tool_results

    # ------------------------------------------------------------------

    # ------------------------------------------------------------------
    # Parsing e formatação — podem ser sobrescritos nas subclasses
    # ------------------------------------------------------------------

    def _parse_response(self, response: types.GenerateContentResponse) -> Any:
        """
        Extrai o output estruturado da resposta final do Gemini.
        Por padrão extrai o texto principal e tenta parsear como JSON.
        Subclasses podem sobrescrever para lógicas específicas de parsing.

        Returns:
            Dict se o texto for JSON válido, string caso contrário.
        """
        full_text = response.text
        
        if not full_text:
            return {}
        
        full_text = full_text.strip()

        # Tenta extrair JSON — o Claude pode envolver o JSON em markdown ```json ... ```
        json_text = self._extract_json_from_text(full_text)

        try:
            return json.loads(json_text)
        except (json.JSONDecodeError, ValueError):
            # Retorna texto bruto se não for JSON válido
            return full_text

    def _extract_json_from_text(self, text: str) -> str:
        """
        Extrai o conteúdo JSON de uma string que pode conter markdown code blocks.
        Trata: texto puro, ```json ... ```, ``` ... ```.
        """
        # Remove markdown code blocks se presentes
        if "```json" in text:
            start = text.index("```json") + 7
            end = text.rindex("```")
            return text[start:end].strip()
        if "```" in text:
            start = text.index("```") + 3
            end = text.rindex("```")
            return text[start:end].strip()

        # Tenta encontrar o primeiro { ou [ e o último } ou ]
        for open_char, close_char in [("{", "}"), ("[", "]")]:
            if open_char in text and close_char in text:
                start = text.index(open_char)
                end = text.rindex(close_char) + 1
                return text[start:end]

        return text

    def _compress_attempt_history(self, history: list[dict]) -> str:
        """
        Comprime o histórico de tentativas com falha em um resumo eficiente em tokens.
        Nunca inclui o output completo anterior — apenas o motivo da falha e um resumo.
        Implementa a Regra 5 do PRD seção 4.

        Args:
            history: Lista de dicts com attempt, output_summary, passed, failure_reason.

        Returns:
            String formatada para injeção no início da próxima mensagem.
        """
        failed = [h for h in history if not h["passed"]]
        if not failed:
            return ""

        lines = [
            "TENTATIVAS ANTERIORES QUE NÃO ATENDERAM AOS CRITÉRIOS DE QUALIDADE:",
            "",
        ]
        for h in failed:
            lines.append(f"Tentativa {h['attempt']}:")
            lines.append(f"  Motivo da reprovação: {h['failure_reason']}")
            if h["output_summary"]:
                lines.append(f"  Resumo do que foi entregue: {h['output_summary']}")
            lines.append("")

        lines.append("Evite os problemas acima na próxima tentativa.")
        return "\n".join(lines)

    def _summarize_output(self, output: Any) -> str:
        """
        Cria um resumo breve do output para o histórico de tentativas.
        Limita a 300 caracteres para não desperdiçar tokens.
        """
        if output is None:
            return "(sem output)"

        if isinstance(output, dict):
            # Para dicts, mostra as chaves e um trecho dos valores principais
            try:
                summary = json.dumps(output, ensure_ascii=False)
            except (TypeError, ValueError):
                summary = str(output)
        elif isinstance(output, str):
            summary = output
        else:
            summary = str(output)

        if len(summary) > 300:
            return summary[:297] + "..."
        return summary
