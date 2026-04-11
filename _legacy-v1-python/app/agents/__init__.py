# app/agents/
# Definições de todos os agentes de IA da plataforma.
# Todo agente herda de BaseAgent (base.py) — nunca criar agentes fora desse padrão.
#
# Agentes do fluxo principal (em ordem de execução):
#   base.py                 — Classe abstrata BaseAgent com loop de execução e retry
#   orchestrator.py         — Agente 0: planeja sequência e delega para subagentes
#   product_analyzer.py     — Agente 1: transcreve VSL e extrai estrutura da oferta
#   market_researcher.py    — Agente 2: avalia viabilidade de mercado
#   persona_builder.py      — Agente 3: constrói persona e público-alvo
#   angle_strategist.py     — Agente 4: define ângulo criativo e hooks
#   benchmark_agent.py      — Agente 5: coleta referências de criativos vencedores
#   campaign_strategist.py  — Agente 6: define formato, budget e métricas de corte
#   script_writer.py        — Agente 7: escreve roteiros e variações de hook
#   copy_writer.py          — Agente 8: escreve copies para todas as plataformas
#   character_generator.py  — Agente 9: gera personagem visual consistente
#   keyframe_generator.py   — Agente 10: gera primeiro frame de cada cena
#   video_generator.py      — Agente 11: gera clipes de vídeo por cena (image-to-video)
#   creative_director.py    — Agente 12: monta vídeo final via FFmpeg
#   compliance_checker.py   — Agente 13: valida contra políticas do Facebook e Google
#   utm_builder.py          — Agente 14: estrutura link de afiliado com UTMs
#   media_buyer_facebook.py — Agente 15: cria campanhas no Facebook Ads (sempre PAUSED)
#   media_buyer_google.py   — Agente 16: cria campanhas no Google Ads (sempre PAUSED)
#   performance_analyst.py  — Agente 17: analisa métricas diárias e diagnostica
#   scaler.py               — Agente 18: propõe ações de escala (requer aprovação humana)
