"""
Testes para app/tools/transcribe_vsl.py — execute_transcribe_vsl()

Cobre:
  - URL do YouTube → usa YouTubeTranscriptApi.list() (youtube-transcript-api v1.2.4)
  - URL curta youtu.be → detectada como YouTube
  - URL de player desconhecido → retorna manual_upload_required
  - Vturb tenta yt-dlp → degrada para manual_upload_required
  - Arquivo local sem OPENAI_API_KEY → retorna manual_upload_required
  - Estrutura do output em caso de sucesso e falha
  - YouTube sem transcrição disponível → retorna manual_upload_required
"""

import os
import pytest
from unittest.mock import AsyncMock, MagicMock, patch


# ---------------------------------------------------------------------------
# Helpers para montar o mock da cadeia list() → find_transcript() → fetch()
# ---------------------------------------------------------------------------

def _make_transcript_chain(segments_raw: list[dict]):
    """
    Retorna mock_transcript_list configurado para retornar segmentos.

    Simula a cadeia (v1.2.4):
        YouTubeTranscriptApi.list(video_id)     → transcript_list
        transcript_list.find_transcript([code]) → transcript
        transcript.fetch()                      → lista de FetchedTranscriptSnippet
    """
    mock_segments = []
    for seg in segments_raw:
        s = MagicMock()
        s.text = seg["text"]
        s.start = seg["start"]
        s.duration = seg["duration"]
        mock_segments.append(s)

    mock_transcript = MagicMock()
    mock_transcript.fetch.return_value = mock_segments
    mock_transcript.language_code = "pt"
    mock_transcript.is_generated = False

    mock_list = MagicMock()
    mock_list.find_transcript.return_value = mock_transcript
    mock_list.__iter__ = MagicMock(return_value=iter([]))

    return mock_list


# ---------------------------------------------------------------------------
# Testes
# ---------------------------------------------------------------------------

class TestExecuteTranscribeVsl:

    @pytest.mark.asyncio
    async def test_youtube_url_uses_transcript_api(self):
        """URL do YouTube deve ser resolvida via YouTubeTranscriptApi.list()."""
        from app.tools.transcribe_vsl import execute_transcribe_vsl

        raw_segments = [
            {"text": "Se você está tentando emagrecer", "start": 0.0, "duration": 3.0},
            {"text": "e não consegue, presta atenção.", "start": 3.0, "duration": 2.5},
        ]
        mock_list = _make_transcript_chain(raw_segments)

        with patch("youtube_transcript_api.YouTubeTranscriptApi.list", return_value=mock_list):
            result = await execute_transcribe_vsl(
                "https://www.youtube.com/watch?v=dQw4w9WgXcW", language="pt"
            )

        assert result["status"] == "completed"
        assert "Se você está tentando emagrecer" in result["transcript"]
        assert result["source"] == "youtube_captions"
        assert isinstance(result["segments"], list)
        assert result["duration_seconds"] > 0
        assert "end" in result["segments"][0]
        assert "start" in result["segments"][0]

    @pytest.mark.asyncio
    async def test_youtu_be_short_url_detected(self):
        """URL curta youtu.be deve ser detectada como YouTube."""
        from app.tools.transcribe_vsl import execute_transcribe_vsl

        raw_segments = [{"text": "Olá!", "start": 0.0, "duration": 1.0}]
        mock_list = _make_transcript_chain(raw_segments)

        with patch("youtube_transcript_api.YouTubeTranscriptApi.list", return_value=mock_list):
            result = await execute_transcribe_vsl("https://youtu.be/xyzXYZ78901")

        assert result["status"] == "completed"
        assert result["source"] == "youtube_captions"

    @pytest.mark.asyncio
    async def test_unknown_url_returns_manual_upload_required(self):
        """URL de player desconhecido deve retornar manual_upload_required."""
        from app.tools.transcribe_vsl import execute_transcribe_vsl

        result = await execute_transcribe_vsl(
            "https://player-desconhecido.com/embed/abc123"
        )

        assert result["status"] == "manual_upload_required"
        assert "reason" in result

    @pytest.mark.asyncio
    async def test_vturb_url_attempts_ytdlp(self):
        """URL do Vturb deve tentar yt-dlp para download de áudio."""
        from app.tools.transcribe_vsl import execute_transcribe_vsl

        with patch("yt_dlp.YoutubeDL") as mock_ydl_cls:
            mock_ydl = MagicMock()
            mock_ydl.__enter__ = MagicMock(return_value=mock_ydl)
            mock_ydl.__exit__ = MagicMock(return_value=False)
            mock_ydl.download = MagicMock(
                side_effect=Exception("yt-dlp: unsupported URL")
            )
            mock_ydl_cls.return_value = mock_ydl

            result = await execute_transcribe_vsl(
                "https://vturb.com.br/player/abc123"
            )

        assert result["status"] in ("completed", "manual_upload_required")

    @pytest.mark.asyncio
    async def test_local_mp4_file_path_detected(self):
        """Caminho de arquivo local .mp4 detectado; sem chave Whisper → manual_upload_required."""
        from app.tools.transcribe_vsl import execute_transcribe_vsl

        with patch.dict(os.environ, {"OPENAI_API_KEY": ""}):
            result = await execute_transcribe_vsl("/tmp/vsl_producao.mp4")

        assert result["status"] == "manual_upload_required"
        assert "reason" in result

    @pytest.mark.asyncio
    async def test_success_output_has_all_fields(self):
        """Output de sucesso deve ter todos os campos documentados no PRD."""
        from app.tools.transcribe_vsl import execute_transcribe_vsl

        raw_segments = [
            {"text": f"Segmento {i}.", "start": float(i * 3), "duration": 3.0}
            for i in range(5)
        ]
        mock_list = _make_transcript_chain(raw_segments)

        with patch("youtube_transcript_api.YouTubeTranscriptApi.list", return_value=mock_list):
            result = await execute_transcribe_vsl(
                "https://youtube.com/watch?v=test1234567", language="pt"
            )

        required_fields = {"status", "transcript", "segments", "duration_seconds", "source"}
        assert required_fields <= set(result.keys())
        assert result["status"] == "completed"
        assert isinstance(result["duration_seconds"], (int, float))
        assert result["duration_seconds"] > 0

    @pytest.mark.asyncio
    async def test_manual_upload_output_has_reason(self):
        """Output de falha deve ter status e reason."""
        from app.tools.transcribe_vsl import execute_transcribe_vsl

        result = await execute_transcribe_vsl(
            "https://player-proprietario.com/video/xyz"
        )

        assert result["status"] == "manual_upload_required"
        assert "reason" in result
        assert isinstance(result["reason"], str)
        assert len(result["reason"]) > 0

    @pytest.mark.asyncio
    async def test_youtube_no_transcript_returns_manual_upload(self):
        """YouTube sem transcrição disponível deve retornar manual_upload_required."""
        from app.tools.transcribe_vsl import execute_transcribe_vsl
        from youtube_transcript_api import NoTranscriptFound

        mock_list = MagicMock()
        mock_list.find_transcript.side_effect = NoTranscriptFound(
            "abc123", ["pt", "pt-BR", "en"], mock_list
        )
        # Sem nenhum transcript disponível para fallback
        mock_list.__iter__ = MagicMock(return_value=iter([]))

        with patch("youtube_transcript_api.YouTubeTranscriptApi.list", return_value=mock_list):
            result = await execute_transcribe_vsl(
                "https://www.youtube.com/watch?v=dQw4w9WgXcW"
            )

        assert result["status"] == "manual_upload_required"
