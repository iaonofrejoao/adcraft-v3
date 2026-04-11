"""
ExecutionEngine — motor principal de orquestração do fluxo de agentes.

Responsabilidades:
  - Carregar o shared_state do banco via StateManager
  - Sequenciar os agentes em waves baseadas no grafo de edges do template_snapshot
  - Detectar nós paralelos (múltiplas arestas saindo do mesmo nó) e executá-los
    simultaneamente via asyncio.gather
  - Detectar nós que precisam de aprovação humana e pausar o fluxo
  - Persistir o state após cada nó via StateManager.write_field_direct()
  - Atualizar node_statuses em tempo real (Supabase Realtime → canvas)
  - Rastrear custo via CostTracker
  - Notificar usuário ao concluir ou falhar
  - Suportar retomada após crash (resume())
  - Reagir ao resultado de viabilidade após o Agente 2 (PRD seção 0)

Fluxo por nó (PRD seção 9):
  1. Verifica se o nó está ativo (node_config.active)
  2. Atualiza status → "running"
  3. Instancia e executa o agente via agent.run()
  4. Persiste o subcampo do state
  5. Se approval_required: atualiza status → "waiting_approval" e pausa
  6. Se não: atualiza status → "approved" e avança para o próximo nó
  7. Em falha: status → "failed", persiste erro, notifica usuário

Paralelismo (PRD seção 9):
  - Um nó com N saídas conectadas → dispara N nós no mesmo wave
  - Cada nó paralelo escreve em campo exclusivo do shared_state (sem race condition)
  - O wave seguinte só inicia quando todos os paralelos do wave atual terminarem

Viabilidade (PRD seção 0):
  - Após o wave que contém node-2, avalia state["market"]["viability_verdict"]
  - orchestrator_behavior_on_failure = "stop"          → pausa e notifica
  - orchestrator_behavior_on_failure = "continue"      → continua com flag de aviso
  - orchestrator_behavior_on_failure = "agent_decides" → orquestrador decide por critérios objetivos

Retomada (PRD seção 9):
  - O fluxo retoma do primeiro nó com status != "approved"
  - Nós com status "approved" nunca são reexecutados
"""

from __future__ import annotations

import asyncio
import logging
from collections import defaultdict, deque
from datetime import UTC, datetime
from typing import Any

from app.database import get_supabase
from app.orchestration.cost_tracker import CostTracker
from app.orchestration.rate_limiter import RateLimiter
from app.orchestration.state_manager import StateManager

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Mapeamento de nó → agente
# ---------------------------------------------------------------------------

_NODE_AGENT_MAP: dict[str, str] = {
    "node-1":  "ProductAnalyzerAgent",
    "node-2":  "MarketResearcherAgent",
    "node-3":  "PersonaBuilderAgent",
    "node-4":  "AngleStrategistAgent",
    "node-5":  "BenchmarkAgent",
    "node-6":  "CampaignStrategistAgent",
    "node-7":  "ScriptWriterAgent",
    "node-8":  "CopyWriterAgent",
    "node-9":  "CharacterGeneratorAgent",
    "node-10": "KeyframeGeneratorAgent",
    "node-11": "VideoGeneratorAgent",
    "node-12": "CreativeDirectorAgent",
    "node-13": "ComplianceCheckerAgent",
    "node-14": "UtmBuilderAgent",
    "node-15": "MediaBuyerFacebookAgent",
    "node-16": "MediaBuyerGoogleAgent",
    "node-17": "PerformanceAnalystAgent",
    "node-18": "ScalerAgent",
}

_AGENT_MODULE_MAP: dict[str, str] = {
    "ProductAnalyzerAgent":    "app.agents.product_analyzer",
    "MarketResearcherAgent":   "app.agents.market_researcher",
    "PersonaBuilderAgent":     "app.agents.persona_builder",
    "AngleStrategistAgent":    "app.agents.angle_strategist",
    "BenchmarkAgent":          "app.agents.benchmark_agent",
    "CampaignStrategistAgent": "app.agents.campaign_strategist",
    "ScriptWriterAgent":       "app.agents.script_writer",
    "CopyWriterAgent":         "app.agents.copy_writer",
    "CharacterGeneratorAgent": "app.agents.character_generator",
    "KeyframeGeneratorAgent":  "app.agents.keyframe_generator",
    "VideoGeneratorAgent":     "app.agents.video_generator",
    "CreativeDirectorAgent":   "app.agents.creative_director",
    "ComplianceCheckerAgent":  "app.agents.compliance_checker",
    "UtmBuilderAgent":         "app.agents.utm_builder",
    "MediaBuyerFacebookAgent": "app.agents.media_buyer_facebook",
    "MediaBuyerGoogleAgent":   "app.agents.media_buyer_google",
    "PerformanceAnalystAgent": "app.agents.performance_analyst",
    "ScalerAgent":             "app.agents.scaler",
}

_DEFAULT_NODE_CONFIG: dict[str, Any] = {
    "approval_required": True,
    "model": "claude-sonnet-4-6",
    "quantity": 1,
    "active": True,
}

# Aprovação obrigatória — não pode ser desligada (PRD seção 9)
_MANDATORY_APPROVAL_NODES = {"node-1"}

# Nó que dispara a verificação de viabilidade após conclusão
_VIABILITY_NODE = "node-2"


class ExecutionEngine:
    """
    Motor de orquestração do fluxo de agentes de uma execução.

    Uso:
        engine = ExecutionEngine()
        result = await engine.run(execution_id)
        result = await engine.resume(execution_id)
        result = await engine.rerun_node_with_feedback(execution_id, node_id, feedback)
    """

    # ------------------------------------------------------------------
    # Pontos de entrada públicos
    # ------------------------------------------------------------------

    async def run(self, execution_id: str) -> dict:
        """Inicia uma nova execução do zero."""
        return await self._execute(execution_id, resume=False)

    async def resume(self, execution_id: str) -> dict:
        """
        Retoma uma execução a partir do primeiro nó não aprovado.
        Nós com status "approved" são pulados.
        """
        return await self._execute(execution_id, resume=True)

    async def rerun_node_with_feedback(
        self,
        execution_id: str,
        node_id: str,
        feedback: str,
    ) -> dict:
        """
        Reexecuta um único nó com feedback humano incorporado.
        Chamado quando o usuário rejeita o output de um nó com comentários.

        Args:
            execution_id: UUID da execução.
            node_id:      ID do nó rejeitado (ex: "node-3").
            feedback:     Texto com a orientação do usuário para reexecução.

        Returns:
            dict com status e custo acumulado.
        """
        sm = StateManager(execution_id)
        cost_tracker = CostTracker(execution_id)
        rate_limiter = RateLimiter()

        supabase = get_supabase()
        row = (
            supabase.table("executions")
            .select("node_config, user_id")
            .eq("id", execution_id)
            .single()
            .execute()
        )
        if not row.data:
            raise RuntimeError(f"Execução {execution_id} não encontrada.")

        node_config: dict = row.data.get("node_config", {})
        user_id: str = row.data.get("user_id", "")
        nconfig = {**_DEFAULT_NODE_CONFIG, **node_config.get(node_id, {})}

        agent_class_name = _NODE_AGENT_MAP.get(node_id)
        if not agent_class_name:
            raise ValueError(f"Nó {node_id} não tem agente mapeado.")

        sm.update_execution_status("running")
        state = sm.load()

        try:
            state, paused = await self._run_node(
                node_id=node_id,
                agent_class_name=agent_class_name,
                state=state,
                sm=sm,
                cost_tracker=cost_tracker,
                rate_limiter=rate_limiter,
                nconfig=nconfig,
                execution_id=execution_id,
                human_feedback=feedback,
            )
        except Exception as exc:
            await self._handle_node_failure(
                execution_id=execution_id,
                node_id=node_id,
                agent_class_name=agent_class_name,
                error=exc,
                sm=sm,
                user_id=user_id,
            )
            sm.persist_cost_summary(
                total_cost_usd=cost_tracker.total_cost_usd,
                total_tokens=cost_tracker.total_tokens,
            )
            return {
                "status": "failed",
                "execution_id": execution_id,
                "failed_at_node": node_id,
                "total_cost_usd": cost_tracker.total_cost_usd,
            }

        sm.persist_cost_summary(
            total_cost_usd=cost_tracker.total_cost_usd,
            total_tokens=cost_tracker.total_tokens,
        )

        if paused:
            sm.update_execution_status("paused_for_approval")
            return {
                "status": "paused_for_approval",
                "execution_id": execution_id,
                "waiting_node": node_id,
            }

        # Nó aprovado automaticamente — retoma o restante do fluxo
        return await self._execute(execution_id, resume=True)

    # ------------------------------------------------------------------
    # Loop principal
    # ------------------------------------------------------------------

    async def _execute(self, execution_id: str, resume: bool) -> dict:
        """
        Loop principal de execução baseado em waves topológicas.

        Args:
            execution_id: UUID da execução.
            resume:       Se True, pula nós já aprovados.
        """
        sm = StateManager(execution_id)
        cost_tracker = CostTracker(execution_id)
        rate_limiter = RateLimiter()

        sm.update_execution_status("running")

        supabase = get_supabase()
        row = (
            supabase.table("executions")
            .select("node_config, template_snapshot, user_id")
            .eq("id", execution_id)
            .single()
            .execute()
        )
        if not row.data:
            raise RuntimeError(f"Execução {execution_id} não encontrada no banco.")

        node_config: dict       = row.data.get("node_config", {})
        template_snapshot: dict = row.data.get("template_snapshot", {})
        user_id: str            = row.data.get("user_id", "")

        waves = self._build_execution_waves(template_snapshot)
        node_statuses = sm.load_node_statuses()

        nodes_completed = 0
        nodes_total = sum(len(w) for w in waves)

        for wave in waves:
            # Filtra nós desativados ou já aprovados (retomada)
            active_nodes: list[tuple[str, dict]] = []
            for node_id in wave:
                nconfig = {**_DEFAULT_NODE_CONFIG, **node_config.get(node_id, {})}

                if not nconfig.get("active", True):
                    logger.info("Nó %s desativado — pulando.", node_id)
                    sm.update_node_status(node_id, status="disabled")
                    continue

                current_status = node_statuses.get(node_id, {}).get("status", "idle")
                if resume and current_status == "approved":
                    logger.info("Nó %s já aprovado — pulando (retomada).", node_id)
                    nodes_completed += 1
                    continue

                if node_id not in _NODE_AGENT_MAP:
                    logger.warning("Nó %s sem agente mapeado — pulando.", node_id)
                    continue

                active_nodes.append((node_id, nconfig))

            if not active_nodes:
                continue

            # Carrega state antes de cada wave
            state = sm.load()

            if len(active_nodes) == 1:
                # Execução sequencial (wave com um único nó)
                node_id, nconfig = active_nodes[0]
                agent_class_name = _NODE_AGENT_MAP[node_id]

                try:
                    state, paused = await self._run_node(
                        node_id=node_id,
                        agent_class_name=agent_class_name,
                        state=state,
                        sm=sm,
                        cost_tracker=cost_tracker,
                        rate_limiter=rate_limiter,
                        nconfig=nconfig,
                        execution_id=execution_id,
                    )
                except Exception as exc:
                    await self._handle_node_failure(
                        execution_id=execution_id,
                        node_id=node_id,
                        agent_class_name=agent_class_name,
                        error=exc,
                        sm=sm,
                        user_id=user_id,
                    )
                    sm.persist_cost_summary(
                        total_cost_usd=cost_tracker.total_cost_usd,
                        total_tokens=cost_tracker.total_tokens,
                    )
                    return {
                        "status": "failed",
                        "execution_id": execution_id,
                        "failed_at_node": node_id,
                        "total_cost_usd": cost_tracker.total_cost_usd,
                    }

                nodes_completed += 1
                sm.persist_cost_summary(
                    total_cost_usd=cost_tracker.total_cost_usd,
                    total_tokens=cost_tracker.total_tokens,
                )

                if paused:
                    logger.info(
                        "Execução %s pausada em %s aguardando aprovação.",
                        execution_id, node_id,
                    )
                    sm.update_execution_status("paused_for_approval")
                    return {
                        "status": "paused_for_approval",
                        "execution_id": execution_id,
                        "waiting_node": node_id,
                        "nodes_completed": nodes_completed,
                        "nodes_total": nodes_total,
                    }

            else:
                # Execução paralela — múltiplos nós no mesmo wave
                # Cada agente escreve em campo exclusivo → sem race condition (PRD seção 9)
                logger.info(
                    "Execução %s: wave paralela com %d nós: %s",
                    execution_id,
                    len(active_nodes),
                    [nid for nid, _ in active_nodes],
                )

                results = await asyncio.gather(
                    *[
                        self._run_node(
                            node_id=nid,
                            agent_class_name=_NODE_AGENT_MAP[nid],
                            state=state,
                            sm=sm,
                            cost_tracker=cost_tracker,
                            rate_limiter=rate_limiter,
                            nconfig=ncfg,
                            execution_id=execution_id,
                        )
                        for nid, ncfg in active_nodes
                    ],
                    return_exceptions=True,
                )

                any_paused = False
                failed_node: str | None = None

                for (node_id, _), result in zip(active_nodes, results):
                    if isinstance(result, Exception):
                        failed_node = node_id
                        await self._handle_node_failure(
                            execution_id=execution_id,
                            node_id=node_id,
                            agent_class_name=_NODE_AGENT_MAP[node_id],
                            error=result,
                            sm=sm,
                            user_id=user_id,
                        )
                        break

                    _, paused = result
                    if paused:
                        any_paused = True
                    nodes_completed += 1

                sm.persist_cost_summary(
                    total_cost_usd=cost_tracker.total_cost_usd,
                    total_tokens=cost_tracker.total_tokens,
                )

                if failed_node:
                    return {
                        "status": "failed",
                        "execution_id": execution_id,
                        "failed_at_node": failed_node,
                        "total_cost_usd": cost_tracker.total_cost_usd,
                    }

                if any_paused:
                    sm.update_execution_status("paused_for_approval")
                    return {
                        "status": "paused_for_approval",
                        "execution_id": execution_id,
                        "waiting_node": "parallel_wave",
                        "nodes_completed": nodes_completed,
                        "nodes_total": nodes_total,
                    }

                # Após wave paralela: recarrega state do banco
                # (cada agente já persistiu seu campo individualmente)
                state = sm.load()

            # ----------------------------------------------------------------
            # Verificação de viabilidade após conclusão do node-2 (PRD seção 0)
            # ----------------------------------------------------------------
            wave_node_ids = [nid for nid, _ in active_nodes]
            if _VIABILITY_NODE in wave_node_ids:
                viability_result = self._check_viability(
                    state=sm.load(),
                    execution_id=execution_id,
                    sm=sm,
                    user_id=user_id,
                )
                if viability_result is not None:
                    sm.persist_cost_summary(
                        total_cost_usd=cost_tracker.total_cost_usd,
                        total_tokens=cost_tracker.total_tokens,
                    )
                    return viability_result

        # Todos os waves concluídos
        sm.update_execution_status("completed")
        sm.persist_cost_summary(
            total_cost_usd=cost_tracker.total_cost_usd,
            total_tokens=cost_tracker.total_tokens,
        )

        await self._notify_completion(execution_id, user_id, cost_tracker.total_cost_usd)

        logger.info(
            "Execução %s concluída. Custo total: $%.4f | Tokens: %d",
            execution_id, cost_tracker.total_cost_usd, cost_tracker.total_tokens,
        )

        return {
            "status": "completed",
            "execution_id": execution_id,
            "nodes_completed": nodes_completed,
            "total_cost_usd": cost_tracker.total_cost_usd,
            "total_tokens": cost_tracker.total_tokens,
        }

    # ------------------------------------------------------------------
    # Execução de nó
    # ------------------------------------------------------------------

    async def _run_node(
        self,
        node_id: str,
        agent_class_name: str,
        state: dict,
        sm: StateManager,
        cost_tracker: CostTracker,
        rate_limiter: RateLimiter,
        nconfig: dict,
        execution_id: str,
        human_feedback: str | None = None,
    ) -> tuple[dict, bool]:
        """
        Executa um único nó com retentativas de infra e checkpoint de aprovação.

        Returns:
            (updated_state, paused_for_approval)
        """
        model = nconfig.get("model", "claude-sonnet-4-6")
        logger.info("Iniciando nó %s (%s) modelo=%s.", node_id, agent_class_name, model)

        sm.update_node_status(node_id, status="running")

        agent = self._load_agent(agent_class_name, model)

        state, run_metadata = await self._run_with_infra_retry(
            agent=agent,
            state=state,
            cost_tracker=cost_tracker,
            rate_limiter=rate_limiter,
            node_id=node_id,
            execution_id=execution_id,
            human_feedback=human_feedback,
        )

        # Persiste o campo que este agente escreveu
        field_name = self._get_field_name(agent.name)
        if field_name and field_name in state:
            sm.write_field_direct(field_name, state[field_name], agent_name=agent.name)

        # Atualiza status e métricas do nó no canvas
        node_cost = cost_tracker.node_cost(node_id)
        approval_needed = self._requires_approval(node_id, nconfig)
        sm.update_node_status(
            node_id=node_id,
            status="waiting_approval" if approval_needed else "approved",
            cost_usd=node_cost.cost_usd if node_cost else 0.0,
            tokens=(node_cost.input_tokens + node_cost.output_tokens) if node_cost else 0,
            attempts=run_metadata.get("attempts", 1),
        )

        return state, approval_needed

    async def _run_with_infra_retry(
        self,
        agent: Any,
        state: dict,
        cost_tracker: CostTracker,
        rate_limiter: RateLimiter,
        node_id: str,
        execution_id: str,
        human_feedback: str | None = None,
    ) -> tuple[dict, dict]:
        """
        Executa o agente com retentativas para erros de infra (timeout, 5xx).
        Máximo 3 tentativas com backoff: 5s → 15s → 30s (PRD seção 0).
        """
        delays = [0, 5, 15, 30]

        for attempt_idx, delay in enumerate(delays):
            if delay > 0:
                logger.warning(
                    "Nó %s: erro de infra — aguardando %ds (tentativa %d/%d).",
                    node_id, delay, attempt_idx, len(delays) - 1,
                )
                await asyncio.sleep(delay)

            try:
                return await agent.run(
                    state=state,
                    cost_tracker=cost_tracker,
                    rate_limiter=rate_limiter,
                    node_id=node_id,
                    execution_id=execution_id,
                    human_feedback=human_feedback,
                )
            except (TimeoutError, ConnectionError, OSError) as exc:
                if attempt_idx == len(delays) - 1:
                    raise
                logger.warning(
                    "Nó %s tentativa %d/%d — erro de infra: %s",
                    node_id, attempt_idx + 1, len(delays), str(exc),
                )

        raise RuntimeError(f"Nó {node_id}: esgotou todas as retentativas de infra.")

    # ------------------------------------------------------------------
    # Verificação de viabilidade (PRD seção 0)
    # ------------------------------------------------------------------

    def _check_viability(
        self,
        state: dict,
        execution_id: str,
        sm: StateManager,
        user_id: str,
    ) -> dict | None:
        """
        Avalia o resultado do agente de viabilidade e age conforme configurado.

        Returns:
            None  → fluxo pode continuar normalmente.
            dict  → pausa o fluxo com o resultado retornado.
        """
        market = state.get("market", {})
        verdict = market.get("viability_verdict", "viable")

        if verdict == "viable":
            return None

        behavior = (
            state.get("product", {})
            .get("orchestrator_behavior_on_failure", "agent_decides")
        )

        logger.info(
            "Execução %s: viabilidade=%s behavior=%s",
            execution_id, verdict, behavior,
        )

        if behavior == "stop":
            score = market.get("viability_score", 0)
            justification = market.get("viability_justification", "")
            sm.update_execution_status("paused_for_approval")
            try:
                supabase = get_supabase()
                supabase.table("notifications").insert({
                    "user_id": user_id,
                    "execution_id": execution_id,
                    "type": "failure",
                    "title": f"Viabilidade reprovada: {verdict}",
                    "message": (
                        f"Score: {score}/100. {justification[:300]}"
                        " O fluxo foi pausado. Acesse a execução para decidir."
                    ),
                    "read": False,
                }).execute()
            except Exception as exc:
                logger.warning("Falha ao criar notificação de viabilidade: %s", exc)

            return {
                "status": "paused_for_approval",
                "execution_id": execution_id,
                "waiting_node": "viability_decision",
                "viability_verdict": verdict,
                "viability_score": score,
            }

        if behavior == "continue":
            logger.warning(
                "Execução %s: viabilidade=%s — continuando com viability_warning=True.",
                execution_id, verdict,
            )
            exec_meta = state.get("execution_meta", {})
            exec_meta["viability_warning"] = True
            exec_meta["viability_verdict"] = verdict
            sm.write_field_direct("execution_meta", exec_meta)
            return None

        # behavior == "agent_decides": critérios objetivos
        score = market.get("viability_score", 0)
        justification = market.get("viability_justification", "").lower()

        has_legal_restriction = any(
            kw in justification
            for kw in ("ilegal", "proibid", "regulament", "anvisa", "forbid", "banned")
        )

        if verdict == "not_viable" and (score < 30 or has_legal_restriction):
            sm.update_execution_status("paused_for_approval")
            return {
                "status": "paused_for_approval",
                "execution_id": execution_id,
                "waiting_node": "viability_decision",
                "viability_verdict": verdict,
                "viability_score": score,
                "agent_decision": "stopped_by_orchestrator",
            }

        # Margem positiva ou risco apenas "risky" → continua com aviso
        exec_meta = state.get("execution_meta", {})
        exec_meta["viability_warning"] = True
        exec_meta["viability_verdict"] = verdict
        sm.write_field_direct("execution_meta", exec_meta)
        return None

    # ------------------------------------------------------------------
    # Construção do grafo de execução (Kahn's algorithm)
    # ------------------------------------------------------------------

    def _build_execution_waves(self, template_snapshot: dict) -> list[list[str]]:
        """
        Constrói waves de execução a partir do grafo de edges do template_snapshot.
        Usa o algoritmo de Kahn (BFS topológico) para respeitar dependências.

        Cada wave é uma lista de nós que podem executar em paralelo
        (nenhum deles depende de outro nó da mesma wave).

        Fallback: se o template não tiver nodes/edges válidos, usa a ordem
        padrão dos 18 agentes em waves de 1 nó cada.

        Returns:
            lista de waves, ex:
            [["node-1"], ["node-2"], ["node-3"],
             ["node-4", "node-5"], ["node-6"], ...]
        """
        nodes_raw: list[dict] = template_snapshot.get("nodes", [])
        edges_raw: list[dict] = template_snapshot.get("edges", [])

        all_node_ids = {
            n["id"]
            for n in nodes_raw
            if isinstance(n, dict) and n.get("id") in _NODE_AGENT_MAP
        }

        if not all_node_ids:
            return [[nid] for nid in _NODE_AGENT_MAP]

        if not edges_raw:
            ordered = sorted(
                all_node_ids,
                key=lambda x: int(x.split("-")[1]) if "-" in x else 99,
            )
            return [[nid] for nid in ordered]

        # Constrói grafo de adjacência e grau de entrada
        successors: dict[str, list[str]] = defaultdict(list)
        in_degree: dict[str, int] = {nid: 0 for nid in all_node_ids}

        for edge in edges_raw:
            if not isinstance(edge, dict):
                continue
            src = edge.get("source", "")
            tgt = edge.get("target", "")
            if src in all_node_ids and tgt in all_node_ids:
                successors[src].append(tgt)
                in_degree[tgt] = in_degree.get(tgt, 0) + 1

        # BFS por camadas (Kahn's)
        queue: deque[str] = deque(
            nid for nid in all_node_ids if in_degree[nid] == 0
        )
        waves: list[list[str]] = []

        while queue:
            current_wave = list(queue)
            queue.clear()
            waves.append(current_wave)

            for nid in current_wave:
                for child in successors[nid]:
                    in_degree[child] -= 1
                    if in_degree[child] == 0:
                        queue.append(child)

        # Nós sem aresta (não alcançados pelo grafo)
        covered = {nid for wave in waves for nid in wave}
        orphans = sorted(
            all_node_ids - covered,
            key=lambda x: int(x.split("-")[1]) if "-" in x else 99,
        )
        if orphans:
            logger.warning(
                "Nós sem dependência definida por edges: %s — adicionados ao final.",
                orphans,
            )
            waves.extend([[nid] for nid in orphans])

        return waves

    # ------------------------------------------------------------------
    # Tratamento de falha
    # ------------------------------------------------------------------

    async def _handle_node_failure(
        self,
        execution_id: str,
        node_id: str,
        agent_class_name: str,
        error: Exception,
        sm: StateManager,
        user_id: str,
    ) -> None:
        """Registra falha, atualiza status e notifica o usuário."""
        error_msg = str(error)
        logger.error(
            "Nó %s (%s) falhou permanentemente: %s",
            node_id, agent_class_name, error_msg, exc_info=True,
        )

        sm.update_node_status(
            node_id=node_id,
            status="failed",
            tooltip_message=f"Falha: {error_msg[:100]}",
        )
        sm.update_execution_status("failed")

        # Persiste último erro via write_field_direct (sem necessidade de RPC customizada)
        try:
            current_state = sm.load()
            exec_meta = current_state.get("execution_meta", {})
            exec_meta["last_error"] = {
                "node": node_id,
                "error_type": type(error).__name__,
                "message": error_msg,
                "timestamp": datetime.now(UTC).isoformat(),
            }
            sm.write_field_direct("execution_meta", exec_meta)
        except Exception as persist_exc:
            logger.warning("Falha ao persistir execution_meta de erro: %s", persist_exc)

        await self._notify_failure(execution_id, user_id, node_id, error_msg)

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _requires_approval(self, node_id: str, nconfig: dict) -> bool:
        """Verifica se este nó requer aprovação humana."""
        if node_id in _MANDATORY_APPROVAL_NODES:
            return True
        return nconfig.get("approval_required", True)

    def _load_agent(self, agent_class_name: str, model: str) -> Any:
        """Importa e instancia o agente dinamicamente (lazy import)."""
        module_path = _AGENT_MODULE_MAP.get(agent_class_name)
        if not module_path:
            raise ImportError(
                f"Agente '{agent_class_name}' não encontrado no mapa de módulos."
            )
        import importlib
        module = importlib.import_module(module_path)
        agent_class = getattr(module, agent_class_name)
        return agent_class(model=model)

    def _get_field_name(self, agent_name: str) -> str | None:
        """Retorna o campo do shared_state que este agente escreve."""
        from app.orchestration.state_manager import _STATE_FIELD_OWNERS
        return {v: k for k, v in _STATE_FIELD_OWNERS.items()}.get(agent_name)

    async def _notify_completion(
        self, execution_id: str, user_id: str, total_cost_usd: float
    ) -> None:
        """Cria notificação de conclusão (publicada via Supabase Realtime)."""
        if not user_id:
            return
        try:
            supabase = get_supabase()
            supabase.table("notifications").insert({
                "user_id": user_id,
                "execution_id": execution_id,
                "type": "completion",
                "title": "Execução concluída",
                "message": (
                    f"Fluxo finalizado com sucesso. "
                    f"Custo total: ${total_cost_usd:.4f}"
                ),
                "read": False,
            }).execute()
        except Exception as exc:
            logger.warning("Falha ao criar notificação de conclusão: %s", exc)

    async def _notify_failure(
        self, execution_id: str, user_id: str, node_id: str, error_msg: str
    ) -> None:
        """Cria notificação de falha (publicada via Supabase Realtime)."""
        if not user_id:
            return
        try:
            supabase = get_supabase()
            agent_name = _NODE_AGENT_MAP.get(node_id, node_id)
            supabase.table("notifications").insert({
                "user_id": user_id,
                "execution_id": execution_id,
                "type": "failure",
                "title": f"Falha no nó: {agent_name}",
                "message": error_msg[:500],
                "read": False,
            }).execute()
        except Exception as exc:
            logger.warning("Falha ao criar notificação de erro: %s", exc)
