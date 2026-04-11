"""
Testes para app/tools/search_youtube.py

Cobre:
  execute_search_youtube_videos():
    - API key placeholder → retorna resultados mock sem chamar API
    - quota excedida (403 quotaExceeded) → YouTubeQuotaExceededError
    - API 200 → lista normalizada com view_count
    - parâmetro order passado na query string

  execute_get_youtube_comments():
    - Comentários desabilitados (403 commentsDisabled) → retorna []
    - API 200 → lista com text, like_count, author
    - API key placeholder → retorna comentários mock

  execute_get_youtube_transcript():
    - Transcrição disponível → retorna dict com transcript e segments
    - Sem transcrição disponível → retorna None sem exceção

  execute_search_youtube_comments():
    - Combina busca + comentários → retorna lista de comentários
    - Nenhum vídeo encontrado → retorna []
"""

import os
import pytest
from unittest.mock import AsyncMock, MagicMock, patch


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_yt_response(status_code: int, json_data: dict) -> MagicMock:
    import httpx
    resp = MagicMock()
    resp.status_code = status_code
    resp.json.return_value = json_data
    resp.raise_for_status = MagicMock()
    if status_code >= 400:
        resp.raise_for_status.side_effect = httpx.HTTPStatusError(
            "error", request=MagicMock(), response=resp
        )
    return resp


def _make_transcript_chain(segments_raw: list[dict]) -> MagicMock:
    """
    Monta o mock da cadeia YouTubeTranscriptApi.list(video_id):
        list(video_id)             → transcript_list
        transcript_list.find_transcript([lang]) → transcript
        transcript.fetch()         → lista de segmentos com .text / .start / .duration
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


_SEARCH_RESPONSE = {
    "items": [
        {
            "id": {"videoId": "abc123"},
            "snippet": {
                "title": "Como emagrecer com Detox",
                "description": "Confira nosso método",
                "channelTitle": "Canal Saúde",
                "publishedAt": "2024-01-15T10:00:00Z",
            },
        }
    ]
}

_VIDEOS_STATS = {
    "items": [
        {
            "id": "abc123",
            "statistics": {"viewCount": "150000", "likeCount": "3200"},
        }
    ]
}

_COMMENTS_RESPONSE = {
    "items": [
        {
            "snippet": {
                "topLevelComment": {
                    "snippet": {
                        "authorDisplayName": "Maria",
                        "textDisplay": "Perdi 5kg em 2 semanas!",
                        "likeCount": 42,
                        "publishedAt": "2024-02-01T08:00:00Z",
                    }
                }
            }
        }
    ]
}

_QUOTA_EXCEEDED_RESPONSE = {
    "error": {
        "code": 403,
        "errors": [{"reason": "quotaExceeded", "domain": "youtube.quota"}],
    }
}

_COMMENTS_DISABLED_RESPONSE = {
    "error": {
        "code": 403,
        "errors": [{"reason": "commentsDisabled", "domain": "youtube.comments"}],
    }
}


# ---------------------------------------------------------------------------
# execute_search_youtube_videos
# ---------------------------------------------------------------------------

class TestExecuteSearchYoutubeVideos:

    @pytest.mark.asyncio
    async def test_placeholder_key_returns_mock(self):
        """API key placeholder deve retornar vídeos mock sem chamar API."""
        from app.tools.search_youtube import execute_search_youtube_videos

        with patch.dict(os.environ, {"YOUTUBE_API_KEY": "sua-chave-aqui"}):
            with patch("app.tools.search_youtube._rate_limiter") as mock_rl:
                mock_rl.acquire = AsyncMock()
                with patch("httpx.AsyncClient") as mock_cls:
                    results = await execute_search_youtube_videos("suplemento detox")
                    mock_cls.assert_not_called()

        assert isinstance(results, list)
        assert len(results) > 0
        video = results[0]
        assert "video_id" in video
        assert "title" in video
        assert "view_count" in video
        assert "channel_name" in video

    @pytest.mark.asyncio
    async def test_quota_exceeded_raises_custom_error(self):
        """Erro 403 quotaExceeded deve lançar YouTubeQuotaExceededError."""
        from app.tools.search_youtube import (
            execute_search_youtube_videos,
            YouTubeQuotaExceededError,
        )
        import httpx

        with patch.dict(os.environ, {"YOUTUBE_API_KEY": "real-key"}):
            with patch("app.tools.search_youtube._rate_limiter") as mock_rl:
                mock_rl.acquire = AsyncMock()
                with patch("httpx.AsyncClient") as mock_client_cls:
                    mock_resp = MagicMock()
                    mock_resp.status_code = 403
                    mock_resp.json.return_value = _QUOTA_EXCEEDED_RESPONSE
                    mock_resp.raise_for_status.side_effect = httpx.HTTPStatusError(
                        "Quota exceeded", request=MagicMock(), response=mock_resp
                    )
                    mock_client = AsyncMock()
                    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
                    mock_client.__aexit__ = AsyncMock(return_value=None)
                    mock_client.get = AsyncMock(return_value=mock_resp)
                    mock_client_cls.return_value = mock_client

                    with pytest.raises(YouTubeQuotaExceededError):
                        await execute_search_youtube_videos("detox")

    @pytest.mark.asyncio
    async def test_real_api_returns_normalized_list(self):
        """API 200 deve retornar lista com view_count como int."""
        from app.tools.search_youtube import execute_search_youtube_videos

        responses = [
            _make_yt_response(200, _SEARCH_RESPONSE),
            _make_yt_response(200, _VIDEOS_STATS),
        ]

        with patch.dict(os.environ, {"YOUTUBE_API_KEY": "real-key"}):
            with patch("app.tools.search_youtube._rate_limiter") as mock_rl:
                mock_rl.acquire = AsyncMock()
                with patch("httpx.AsyncClient") as mock_client_cls:
                    mock_client = AsyncMock()
                    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
                    mock_client.__aexit__ = AsyncMock(return_value=None)
                    mock_client.get = AsyncMock(side_effect=responses)
                    mock_client_cls.return_value = mock_client

                    results = await execute_search_youtube_videos("detox", max_results=1)

        assert len(results) == 1
        assert results[0]["video_id"] == "abc123"
        assert results[0]["title"] == "Como emagrecer com Detox"
        assert results[0]["view_count"] == 150000

    @pytest.mark.asyncio
    async def test_order_parameter_passed_to_api(self):
        """Parâmetro order deve ser passado na query string da requisição."""
        from app.tools.search_youtube import execute_search_youtube_videos

        with patch.dict(os.environ, {"YOUTUBE_API_KEY": "real-key"}):
            with patch("app.tools.search_youtube._rate_limiter") as mock_rl:
                mock_rl.acquire = AsyncMock()
                with patch("httpx.AsyncClient") as mock_client_cls:
                    mock_client = AsyncMock()
                    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
                    mock_client.__aexit__ = AsyncMock(return_value=None)
                    call_kwargs = []

                    async def capture_get(_url, params=None, **kwargs):
                        call_kwargs.append(params or {})
                        return _make_yt_response(200, {"items": []})

                    mock_client.get = capture_get
                    mock_client_cls.return_value = mock_client

                    await execute_search_youtube_videos("detox", order="viewCount")

        assert any("viewCount" in str(k) for k in call_kwargs)


# ---------------------------------------------------------------------------
# execute_get_youtube_comments
# ---------------------------------------------------------------------------

class TestExecuteGetYoutubeComments:

    @pytest.mark.asyncio
    async def test_returns_comments_list(self):
        """API 200 deve retornar lista normalizada de comentários."""
        from app.tools.search_youtube import execute_get_youtube_comments

        with patch.dict(os.environ, {"YOUTUBE_API_KEY": "real-key"}):
            with patch("app.tools.search_youtube._rate_limiter") as mock_rl:
                mock_rl.acquire = AsyncMock()
                with patch("httpx.AsyncClient") as mock_client_cls:
                    mock_resp = _make_yt_response(200, _COMMENTS_RESPONSE)
                    mock_client = AsyncMock()
                    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
                    mock_client.__aexit__ = AsyncMock(return_value=None)
                    mock_client.get = AsyncMock(return_value=mock_resp)
                    mock_client_cls.return_value = mock_client

                    results = await execute_get_youtube_comments("abc123", max_results=10)

        assert len(results) == 1
        comment = results[0]
        assert comment["author"] == "Maria"
        assert comment["text"] == "Perdi 5kg em 2 semanas!"
        assert comment["like_count"] == 42

    @pytest.mark.asyncio
    async def test_comments_disabled_returns_empty_list(self):
        """403 commentsDisabled deve retornar [] sem exceção."""
        from app.tools.search_youtube import execute_get_youtube_comments
        import httpx

        with patch.dict(os.environ, {"YOUTUBE_API_KEY": "real-key"}):
            with patch("app.tools.search_youtube._rate_limiter") as mock_rl:
                mock_rl.acquire = AsyncMock()
                with patch("httpx.AsyncClient") as mock_client_cls:
                    mock_resp = MagicMock()
                    mock_resp.status_code = 403
                    mock_resp.json.return_value = _COMMENTS_DISABLED_RESPONSE
                    mock_resp.raise_for_status.side_effect = httpx.HTTPStatusError(
                        "Forbidden", request=MagicMock(), response=mock_resp
                    )
                    mock_client = AsyncMock()
                    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
                    mock_client.__aexit__ = AsyncMock(return_value=None)
                    mock_client.get = AsyncMock(return_value=mock_resp)
                    mock_client_cls.return_value = mock_client

                    results = await execute_get_youtube_comments("abc123")

        assert results == []

    @pytest.mark.asyncio
    async def test_placeholder_key_returns_mock_comments(self):
        """API key placeholder deve retornar comentários mock."""
        from app.tools.search_youtube import execute_get_youtube_comments

        with patch.dict(os.environ, {"YOUTUBE_API_KEY": "placeholder"}):
            with patch("app.tools.search_youtube._rate_limiter") as mock_rl:
                mock_rl.acquire = AsyncMock()
                with patch("httpx.AsyncClient") as mock_cls:
                    results = await execute_get_youtube_comments("any-video-id")
                    mock_cls.assert_not_called()

        assert isinstance(results, list)
        assert all("text" in c for c in results)


# ---------------------------------------------------------------------------
# execute_get_youtube_transcript
# ---------------------------------------------------------------------------

class TestExecuteGetYoutubeTranscript:

    @pytest.mark.asyncio
    async def test_returns_transcript_when_available(self):
        """Deve retornar dict com transcript e segments quando disponível."""
        from app.tools.search_youtube import execute_get_youtube_transcript

        raw_segments = [
            {"text": "Olá pessoal!", "start": 0.0, "duration": 2.0},
            {"text": "Hoje vamos falar sobre emagrecimento.", "start": 2.0, "duration": 3.5},
        ]
        mock_list = _make_transcript_chain(raw_segments)

        with patch(
            "youtube_transcript_api.YouTubeTranscriptApi.list",
            return_value=mock_list,
        ):
            result = await execute_get_youtube_transcript("abc123")

        assert result is not None
        assert "transcript" in result
        assert "segments" in result
        assert "Olá pessoal!" in result["transcript"]
        assert len(result["segments"]) == 2
        assert "end" in result["segments"][0]
        assert "start" in result["segments"][0]

    @pytest.mark.asyncio
    async def test_returns_none_when_no_transcript(self):
        """Deve retornar None sem exceção quando não há transcrição."""
        from app.tools.search_youtube import execute_get_youtube_transcript
        from youtube_transcript_api import TranscriptsDisabled

        with patch(
            "youtube_transcript_api.YouTubeTranscriptApi.list",
            side_effect=TranscriptsDisabled("abc123"),
        ):
            result = await execute_get_youtube_transcript("abc123")

        assert result is None


# ---------------------------------------------------------------------------
# execute_search_youtube_comments
# ---------------------------------------------------------------------------

class TestExecuteSearchYoutubeComments:

    @pytest.mark.asyncio
    async def test_combines_search_and_comments(self):
        """Deve buscar vídeos e retornar comentários do mais relevante."""
        from app.tools.search_youtube import execute_search_youtube_comments

        mock_videos = [
            {"video_id": "best-vid", "title": "Melhor vídeo", "view_count": 500000, "channel_name": "Canal A"},
            {"video_id": "other-vid", "title": "Outro vídeo", "view_count": 1000, "channel_name": "Canal B"},
        ]
        mock_comments = [
            {"author": "Ana", "text": "Funcionou demais!", "like_count": 10, "published_at": "2024-01-01"},
        ]

        with patch(
            "app.tools.search_youtube.execute_search_youtube_videos",
            AsyncMock(return_value=mock_videos),
        ), patch(
            "app.tools.search_youtube.execute_get_youtube_comments",
            AsyncMock(return_value=mock_comments),
        ) as mock_get_comments:
            results = await execute_search_youtube_comments("emagrecimento", max_results=50)

        # Deve ter chamado get_comments no vídeo com mais views
        mock_get_comments.assert_called_once_with(video_id="best-vid", max_results=50)
        assert results == mock_comments

    @pytest.mark.asyncio
    async def test_returns_empty_if_no_videos_found(self):
        """Sem vídeos encontrados, deve retornar [] sem erro."""
        from app.tools.search_youtube import execute_search_youtube_comments

        with patch(
            "app.tools.search_youtube.execute_search_youtube_videos",
            AsyncMock(return_value=[]),
        ):
            results = await execute_search_youtube_comments("nicho sem vídeos")

        assert results == []
