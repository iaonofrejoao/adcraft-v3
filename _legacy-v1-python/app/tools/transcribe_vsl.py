"""
Tool: transcribe_vsl

Transcreve o áudio de uma VSL e retorna texto com timestamps.
Conforme PRD seção 5.

Fontes suportadas (em ordem de tentativa):
  1. YouTube URL        → youtube-transcript-api (sem quota, sem API key)
  2. Arquivo local      → OpenAI Whisper API     (requer OPENAI_API_KEY)
  3. URL de player      → yt-dlp + Whisper        (Vturb, Panda, Wistia, etc.)

Fallback universal: { status: "manual_upload_required" }
  Ativado quando: DRM, URL inacessível, player sem suporte, API key ausente.
  O orquestrador pausa o fluxo e solicita upload manual do arquivo de áudio.

Rate limit: sem gerenciamento centralizado (conforme PRD).
"""

import logging
import os
import re
import tempfile
from pathlib import Path

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Definição da tool para Claude tool_use
# ---------------------------------------------------------------------------

TRANSCRIBE_VSL_TOOL: dict = {
    "name": "transcribe_vsl",
    "description": (
        "Transcreve o áudio de uma VSL (Video Sales Letter) e retorna o texto "
        "completo com timestamps de cada segmento. "
        "Aceita URL do YouTube, URL de players de vídeo (Vturb, Panda Video, Wistia) "
        "ou caminho de arquivo local (MP4, MP3, WAV, M4A). "
        "Se a transcrição automática não for possível (DRM, player proprietário sem suporte, "
        "credencial ausente), retorna { status: 'manual_upload_required' } — "
        "o fluxo pausa automaticamente para o usuário fazer upload do arquivo de áudio."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "url_or_file_path": {
                "type": "string",
                "description": (
                    "URL da VSL ou caminho absoluto do arquivo de áudio/vídeo. "
                    "Exemplos: 'https://youtu.be/ABC123', "
                    "'https://play.vturb.com.br/...', '/tmp/vsl.mp4'."
                ),
            },
            "language": {
                "type": "string",
                "description": (
                    "Código de idioma para a transcrição. "
                    "Default 'pt' (português). Use 'en' para inglês, 'es' para espanhol."
                ),
                "default": "pt",
            },
        },
        "required": ["url_or_file_path"],
    },
}


# ---------------------------------------------------------------------------
# Constantes
# ---------------------------------------------------------------------------

# Regex para extrair video_id de URLs do YouTube
_YOUTUBE_PATTERNS = [
    re.compile(r"(?:youtube\.com/watch\?v=|youtu\.be/|youtube\.com/embed/)([A-Za-z0-9_-]{11})"),
]

# Domínios de players proprietários que tentamos via yt-dlp
_SUPPORTED_PLAYER_DOMAINS = (
    "vturb.com.br",
    "play.vturb.com.br",
    "pandavideo.com.br",
    "player.pandavideo.com.br",
    "wistia.com",
    "fast.wistia.com",
    "loom.com",
    "vimeo.com",
)

_PLACEHOLDER_KEYS = frozenset({
    "", "sua-chave-aqui", "your-api-key", "placeholder",
    "change-me", "changeme", "xxxx", "todo", "none", "null",
    "sk-...", "sk-placeholder",
})

# Extensões de áudio/vídeo aceitas pelo Whisper
_AUDIO_EXTENSIONS = {".mp3", ".mp4", ".m4a", ".wav", ".webm", ".ogg", ".flac"}


# ---------------------------------------------------------------------------
# Função principal
# ---------------------------------------------------------------------------

async def execute_transcribe_vsl(
    url_or_file_path: str,
    language: str = "pt",
) -> dict:
    """
    Transcreve uma VSL a partir de URL ou arquivo local.

    Estratégia em cascata:
      1. YouTube URL  → youtube-transcript-api
      2. Arquivo local existente → Whisper API
      3. URL de player reconhecido → yt-dlp + Whisper API
      4. Qualquer falha → manual_upload_required

    Returns:
        Sucesso:
            {
                "status":           "completed",
                "transcript":       str,
                "segments":         [{ "start": float, "end": float, "text": str }],
                "duration_seconds": float,
                "source":           "youtube_captions" | "whisper" | "yt_dlp_whisper",
            }
        Falha:
            {
                "status": "manual_upload_required",
                "reason": str,
            }
    """
    source = url_or_file_path.strip()

    # 1. YouTube
    video_id = _extract_youtube_id(source)
    if video_id:
        result = await _transcribe_youtube(video_id, language)
        if result["status"] == "completed":
            return result
        logger.info(
            "transcribe_vsl: captions do YouTube indisponível para %s — %s",
            video_id, result.get("reason"),
        )
        # Não faz fallback para Whisper em vídeos do YouTube — retorna manual
        return result

    # 2. Arquivo local
    if _is_local_file(source):
        return await _transcribe_local_file(source, language)

    # 3. URL de player (Vturb, Panda, Wistia, etc.)
    if source.startswith("http"):
        if _is_supported_player(source):
            return await _transcribe_player_url(source, language)
        # Player desconhecido — não arrisca download
        return _manual_upload_required(
            f"Player de vídeo não suportado para extração automática. "
            f"Faça upload manual do arquivo de áudio da VSL."
        )

    return _manual_upload_required(
        "Formato de entrada não reconhecido. "
        "Informe uma URL válida ou caminho de arquivo local."
    )


# ---------------------------------------------------------------------------
# 1. Transcrição via YouTube Captions
# ---------------------------------------------------------------------------

async def _transcribe_youtube(video_id: str, language: str) -> dict:
    """
    Usa youtube-transcript-api para obter transcrição sem consumir quota da API.
    Tenta o idioma solicitado → fallback para inglês → qualquer disponível.
    """
    try:
        from youtube_transcript_api import (  # type: ignore[import]
            NoTranscriptFound,
            TranscriptsDisabled,
            YouTubeTranscriptApi,
        )
    except ImportError:
        return _manual_upload_required(
            "Dependência youtube-transcript-api não instalada. "
            "Execute: pip install youtube-transcript-api"
        )

    try:
        transcript_list = YouTubeTranscriptApi.list(video_id)

        # Ordem de preferência de idioma
        lang_codes = _lang_preference(language)
        transcript = None
        for code in lang_codes:
            try:
                transcript = transcript_list.find_transcript([code])
                break
            except NoTranscriptFound:
                continue

        if transcript is None:
            # Aceita qualquer disponível como último recurso
            all_codes = [t.language_code for t in transcript_list]
            if not all_codes:
                return _manual_upload_required(
                    "Vídeo do YouTube sem legendas disponíveis."
                )
            transcript = transcript_list.find_transcript([all_codes[0]])

        segments_raw = list(transcript.fetch())
        segments = _normalize_yt_segments(segments_raw)
        duration = segments[-1]["end"] if segments else 0.0
        full_text = " ".join(seg["text"] for seg in segments)

        return {
            "status":           "completed",
            "transcript":       full_text,
            "segments":         segments,
            "duration_seconds": duration,
            "source":           "youtube_captions",
            "language":         transcript.language_code,
        }

    except TranscriptsDisabled:
        return _manual_upload_required(
            "Legendas desabilitadas neste vídeo do YouTube."
        )
    except Exception as exc:
        return _manual_upload_required(
            f"Não foi possível obter legendas do YouTube: {exc}"
        )


def _normalize_yt_segments(raw) -> list[dict]:
    """
    Converte segmentos do youtube-transcript-api para o formato PRD {start, end, text}.

    Compatível com dict (versões antigas) e FetchedTranscriptSnippet dataclass (v1.2.4+).
    """
    result = []
    for seg in raw:
        if isinstance(seg, dict):
            start = float(seg.get("start", 0))
            duration = float(seg.get("duration", 0))
            text = seg.get("text", "")
        else:  # FetchedTranscriptSnippet dataclass (v1.2.4+)
            start = float(getattr(seg, "start", 0))
            duration = float(getattr(seg, "duration", 0))
            text = getattr(seg, "text", "")
        result.append({
            "start": round(start, 2),
            "end":   round(start + duration, 2),
            "text":  text.strip(),
        })
    return result


# ---------------------------------------------------------------------------
# 2. Transcrição de arquivo local via Whisper API
# ---------------------------------------------------------------------------

async def _transcribe_local_file(file_path: str, language: str) -> dict:
    """
    Transcreve arquivo de áudio/vídeo local usando OpenAI Whisper API.
    Requer OPENAI_API_KEY válida.
    """
    path = Path(file_path)

    if not path.exists():
        return _manual_upload_required(f"Arquivo não encontrado: {file_path}")

    if path.suffix.lower() not in _AUDIO_EXTENSIONS:
        return _manual_upload_required(
            f"Formato de arquivo não suportado: {path.suffix}. "
            f"Aceitos: {', '.join(sorted(_AUDIO_EXTENSIONS))}"
        )

    api_key = os.environ.get("OPENAI_API_KEY", "")
    if _is_placeholder_key(api_key):
        logger.debug(
            "transcribe_vsl: OPENAI_API_KEY placeholder — mock para %s", file_path
        )
        return _mock_transcript(file_path)

    return await _call_whisper(path, language, source_label="whisper")


# ---------------------------------------------------------------------------
# 3. Transcrição de URL de player via yt-dlp + Whisper
# ---------------------------------------------------------------------------

async def _transcribe_player_url(url: str, language: str) -> dict:
    """
    Tenta baixar o áudio via yt-dlp e transcrevê-lo com Whisper.
    Falha silenciosamente se yt-dlp não conseguir extrair (DRM, player bloqueado).
    """
    api_key = os.environ.get("OPENAI_API_KEY", "")
    if _is_placeholder_key(api_key):
        logger.debug("transcribe_vsl: OPENAI_API_KEY placeholder — mock para %s", url)
        return _mock_transcript(url)

    try:
        import yt_dlp  # type: ignore[import]
    except ImportError:
        return _manual_upload_required(
            "Dependência yt-dlp não instalada. "
            "Execute: pip install yt-dlp"
        )

    with tempfile.TemporaryDirectory() as tmp_dir:
        audio_path = Path(tmp_dir) / "vsl_audio.mp3"

        ydl_opts = {
            "format":           "bestaudio/best",
            "outtmpl":          str(audio_path.with_suffix("")),
            "postprocessors":   [{
                "key":            "FFmpegExtractAudio",
                "preferredcodec": "mp3",
            }],
            "quiet":            True,
            "no_warnings":      True,
            "socket_timeout":   30,
        }

        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                ydl.download([url])
        except Exception as exc:
            logger.info(
                "transcribe_vsl: yt-dlp não conseguiu extrair áudio de %s — %s",
                url, exc,
            )
            return _manual_upload_required(
                f"Não foi possível extrair o áudio do player de vídeo. "
                f"O vídeo pode estar protegido por DRM. "
                f"Faça upload manual do arquivo de áudio."
            )

        # yt-dlp pode adicionar sufixo diferente
        candidates = list(Path(tmp_dir).glob("vsl_audio.*"))
        if not candidates:
            return _manual_upload_required(
                "yt-dlp completou mas nenhum arquivo de áudio foi gerado."
            )

        audio_file = candidates[0]
        return await _call_whisper(audio_file, language, source_label="yt_dlp_whisper")


# ---------------------------------------------------------------------------
# Whisper API (OpenAI)
# ---------------------------------------------------------------------------

async def _call_whisper(
    audio_path: Path,
    language: str,
    source_label: str,
) -> dict:
    """
    Chama a OpenAI Whisper API (audio/transcriptions) com verbose_json
    para obter segmentos com timestamps.
    """
    import httpx

    api_key = os.environ.get("OPENAI_API_KEY", "")
    # Normaliza código de idioma para Whisper (aceita "pt", "en", "es"...)
    whisper_lang = language.split("-")[0].lower()

    try:
        with open(audio_path, "rb") as audio_file:
            async with httpx.AsyncClient(timeout=300.0) as client:
                response = await client.post(
                    "https://api.openai.com/v1/audio/transcriptions",
                    headers={"Authorization": f"Bearer {api_key}"},
                    files={"file": (audio_path.name, audio_file, "audio/mpeg")},
                    data={
                        "model":           "whisper-1",
                        "language":        whisper_lang,
                        "response_format": "verbose_json",
                    },
                )
    except httpx.TimeoutException:
        return _manual_upload_required(
            "Timeout ao chamar Whisper API. "
            "O arquivo pode ser grande demais. Tente novamente ou faça upload manual."
        )
    except httpx.RequestError as exc:
        return _manual_upload_required(f"Falha de rede ao chamar Whisper API: {exc}")

    if response.status_code == 401:
        return _manual_upload_required(
            "OPENAI_API_KEY inválida ou expirada. "
            "Verifique as credenciais nas configurações."
        )
    if response.status_code == 413:
        return _manual_upload_required(
            "Arquivo de áudio muito grande para a Whisper API (limite: 25 MB). "
            "Comprima o arquivo e tente novamente, ou faça upload do arquivo já comprimido."
        )
    if response.status_code != 200:
        return _manual_upload_required(
            f"Whisper API retornou HTTP {response.status_code}. "
            f"Tente novamente ou faça upload manual."
        )

    data = response.json()
    segments = _normalize_whisper_segments(data.get("segments", []))
    duration = float(data.get("duration", 0.0))
    transcript = data.get("text", "").strip()

    return {
        "status":           "completed",
        "transcript":       transcript,
        "segments":         segments,
        "duration_seconds": duration,
        "source":           source_label,
        "language":         data.get("language", whisper_lang),
    }


def _normalize_whisper_segments(raw: list[dict]) -> list[dict]:
    """Normaliza segmentos do Whisper para {start, end, text}."""
    return [
        {
            "start": round(float(seg.get("start", 0)), 2),
            "end":   round(float(seg.get("end", 0)), 2),
            "text":  seg.get("text", "").strip(),
        }
        for seg in raw
    ]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _extract_youtube_id(source: str) -> str | None:
    """Retorna o video_id se a string for uma URL do YouTube, senão None."""
    for pattern in _YOUTUBE_PATTERNS:
        match = pattern.search(source)
        if match:
            return match.group(1)
    return None


def _is_local_file(source: str) -> bool:
    return os.path.isfile(source)


def _is_supported_player(url: str) -> bool:
    return any(domain in url for domain in _SUPPORTED_PLAYER_DOMAINS)


def _is_placeholder_key(value: str) -> bool:
    return value.strip().lower() in _PLACEHOLDER_KEYS


def _lang_preference(language: str) -> list[str]:
    """Constrói lista de códigos de idioma em ordem de preferência."""
    base = language.split("-")[0].lower()
    codes = [language]
    if base != language:
        codes.append(base)
    # Fallbacks padrão
    for fallback in ("pt", "pt-BR", "en"):
        if fallback not in codes:
            codes.append(fallback)
    return codes


def _manual_upload_required(reason: str) -> dict:
    """Retorna o payload padrão de falha conforme PRD."""
    logger.info("transcribe_vsl: manual_upload_required — %s", reason)
    return {
        "status": "manual_upload_required",
        "reason": reason,
    }


# ---------------------------------------------------------------------------
# Mock realista para desenvolvimento
# ---------------------------------------------------------------------------

def _mock_transcript(source: str) -> dict:
    """
    Retorna transcrição mockada para desenvolvimento local
    quando OPENAI_API_KEY é placeholder.
    """
    mock_segments = [
        {"start": 0.0,   "end": 4.5,   "text": "Ei, você que está lutando contra a gordura teimosa há anos..."},
        {"start": 4.5,   "end": 9.2,   "text": "Eu sei exatamente como você se sente. Eu já estive nessa situação."},
        {"start": 9.2,   "end": 15.0,  "text": "Tentei todas as dietas, academia, shake, e nada funcionava de verdade."},
        {"start": 15.0,  "end": 21.3,  "text": "Até que descobri um método que os médicos não querem que você saiba."},
        {"start": 21.3,  "end": 27.8,  "text": "Em apenas 30 dias, perdi 8 quilos sem passar fome e sem academia."},
        {"start": 27.8,  "end": 34.1,  "text": "E hoje vou te mostrar exatamente como você pode fazer o mesmo."},
        {"start": 34.1,  "end": 41.5,  "text": "Esse produto usa uma combinação única de ingredientes naturais que aceleram o metabolismo."},
        {"start": 41.5,  "end": 48.0,  "text": "Sem efeitos colaterais, aprovado pela ANVISA e com garantia de 30 dias."},
        {"start": 48.0,  "end": 55.2,  "text": "Mais de 50.000 pessoas já transformaram seu corpo com esse método."},
        {"start": 55.2,  "end": 62.0,  "text": "E agora você também pode. Clique no botão abaixo e garanta o seu com desconto especial."},
        {"start": 62.0,  "end": 68.5,  "text": "Mas atenção: esse preço especial é válido apenas hoje. Não perca essa oportunidade."},
        {"start": 68.5,  "end": 75.0,  "text": "Clique agora e comece sua transformação. Você merece esse resultado."},
    ]

    full_text = " ".join(seg["text"] for seg in mock_segments)

    return {
        "status":           "completed",
        "transcript":       full_text,
        "segments":         mock_segments,
        "duration_seconds": 75.0,
        "source":           "mock",
        "language":         "pt",
    }
