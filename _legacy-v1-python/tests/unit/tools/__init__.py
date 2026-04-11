# tests/unit/tools/
# Testes unitários das ferramentas (tools) disponíveis para os agentes.
#
# Módulos de teste existentes:
#   test_web_search.py           — execute_search_web()
#   test_read_page.py            — execute_read_page()
#   test_search_ad_library.py    — execute_search_ad_library()
#   test_search_youtube.py       — execute_search_youtube_videos(),
#                                  execute_get_youtube_comments(),
#                                  execute_get_youtube_transcript(),
#                                  execute_search_youtube_comments()
#   test_transcribe_vsl.py       — execute_transcribe_vsl()
#   test_generate_image.py       — execute_generate_image(),
#                                  get_image_provider(),
#                                  FluxImageProvider, IdeogramImageProvider, FalImageProvider
#   test_generate_video.py       — execute_generate_video_from_image(),
#                                  get_video_provider(),
#                                  RunwayVideoProvider, KlingVideoProvider, PikaVideoProvider
#   test_render_video_ffmpeg.py  — generate_srt(), validate_video_quality(),
#                                  concatenate_clips(), export_for_platform(),
#                                  _assert_ffmpeg_available()
