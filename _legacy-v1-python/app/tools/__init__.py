# app/tools/
# Implementações das ferramentas disponíveis para os agentes.
# Cada ferramenta expõe: (1) definição JSON para tool_use do Claude,
# (2) função async de execução chamada pelo dispatcher.
# Toda chamada a API externa passa pelo RateLimiter antes de executar.
#
# Módulos:
#   registry.py            — Registro central: mapeia nome → (definição, executor)
#                            e expõe dispatch_tool_call() e get_tools_for_agent()
#   web_search.py          — search_web(): busca na web via Serper/Brave/SerpAPI
#   read_page.py           — read_page(): extrai texto estruturado de URL
#   extract_structured.py  — extract_structured_data(): extrai JSON de texto livre
#   search_ad_library.py   — search_ad_library(): busca anúncios na Meta Ad Library
#   search_youtube.py      — search_youtube_videos(), get_youtube_video_comments(),
#                            get_youtube_transcript()
#   transcribe_video.py    — transcribe_vsl(): transcreve VSL via Whisper
#   generate_image.py      — generate_image(): gera imagens via API configurada
#   generate_video.py      — generate_video_from_image(): image-to-video
#   render_video_ffmpeg.py — Montagem de vídeo final: concat, áudio, legendas, export
#   facebook_ads.py        — create_facebook_campaign/adset/ad, activate_campaign,
#                            get_facebook_campaign_metrics
#   google_ads.py          — create_google_campaign/adgroup/ad, activate_google_campaign,
#                            get_google_campaign_metrics
#   storage_r2.py          — upload_asset(): upload atômico para Cloudflare R2
