"""
Tool: render_video_ffmpeg

Montagem e renderização do vídeo final usando FFmpeg local.
Conforme PRD seção 5 (tools do Agente 12 — Diretor de Criativo) e
skill ffmpeg-video.md.

Funções expostas ao Agente 12:
  concatenate_clips()     — une clipes na ordem correta
  mix_audio()             — adiciona narração e trilha de fundo
  add_subtitles()         — burn de legendas SRT no vídeo
  export_for_platform()   — exporta no aspect ratio e qualidade corretos
  validate_video_quality()— verifica requisitos mínimos para anúncio pago
  generate_srt()          — gera arquivo SRT a partir do roteiro

Requisito: FFmpeg instalado no servidor.
  apt-get install -y ffmpeg   (Ubuntu/Debian)
  pip install ffmpeg-python    (wrapper Python)

Falha fatal: se FFmpeg não for encontrado, lança RuntimeError na primeira
chamada. O healthcheck em GET /health deve verificar isso na inicialização.
"""

from __future__ import annotations

import logging
import shutil
import tempfile
from pathlib import Path

import ffmpeg
import httpx

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Configuração de aspect ratios suportados
# ---------------------------------------------------------------------------

ASPECT_RATIO_CONFIG: dict[str, dict] = {
    "9:16": {
        "width": 1080,
        "height": 1920,
        "description": "Reels, Stories, TikTok",
        "ffmpeg_key": "9x16",
    },
    "1:1": {
        "width": 1080,
        "height": 1080,
        "description": "Feed quadrado",
        "ffmpeg_key": "1x1",
    },
    "16:9": {
        "width": 1920,
        "height": 1080,
        "description": "YouTube, apresentações",
        "ffmpeg_key": "16x9",
    },
    "4:5": {
        "width": 1080,
        "height": 1350,
        "description": "Feed vertical (maior área)",
        "ffmpeg_key": "4x5",
    },
    # Aliases com "x" usados internamente pela skill
    "9x16": {"width": 1080, "height": 1920, "description": "Reels, Stories, TikTok"},
    "1x1":  {"width": 1080, "height": 1080, "description": "Feed quadrado"},
    "16x9": {"width": 1920, "height": 1080, "description": "YouTube"},
    "4x5":  {"width": 1080, "height": 1350, "description": "Feed vertical"},
}

# Estilo padrão das legendas — otimizado para anúncios em mobile
_SUBTITLE_STYLE = (
    "FontName=Arial,"
    "FontSize=18,"
    "PrimaryColour=&H00FFFFFF,"   # Branco
    "OutlineColour=&H00000000,"   # Contorno preto
    "BackColour=&H80000000,"      # Fundo semi-transparente
    "Outline=2,"
    "Shadow=1,"
    "Alignment=2,"                # Centralizado na parte inferior
    "MarginV=30"
)


# ---------------------------------------------------------------------------
# Função principal de renderização (usada pelo Agente 12)
# ---------------------------------------------------------------------------

async def render_final_creative(
    video_clips: list[str],
    aspect_ratio: str,
    audio_url: str | None = None,
    music_url: str | None = None,
    subtitles_srt: str | None = None,
) -> bytes:
    """
    Pipeline completo de renderização do vídeo final.

    1. Baixa todos os clipes para diretório temporário
    2. Concatena na ordem correta
    3. Adiciona narração e/ou trilha de fundo (se fornecidos)
    4. Burn de legendas (se fornecidas)
    5. Exporta no aspect ratio e qualidade de anúncio

    Args:
        video_clips:    URLs dos clipes aprovados (ordem = ordem de exibição).
        aspect_ratio:   "9:16" | "1:1" | "16:9" | "4:5".
        audio_url:      URL do áudio de narração (MP3/WAV). Opcional.
        music_url:      URL da trilha de fundo (MP3). Volume 15%. Opcional.
        subtitles_srt:  Conteúdo do arquivo SRT. Opcional.

    Returns:
        Bytes do MP4 final pronto para upload no R2.
    """
    _assert_ffmpeg_available()

    with tempfile.TemporaryDirectory() as tmp_dir:
        tmp_path = Path(tmp_dir)

        # 1 — Download dos clipes
        clip_paths = await _download_clips(video_clips, tmp_path)

        # 2 — Concatenação
        concat_path = tmp_path / "concat.mp4"
        await concatenate_clips(clip_paths, concat_path)

        current_path = concat_path

        # 3 — Áudio
        if audio_url or music_url:
            audio_out = tmp_path / "with_audio.mp4"
            await mix_audio(
                video_path=current_path,
                narration_url=audio_url,
                music_url=music_url,
                output_path=audio_out,
                tmp_dir=tmp_path,
            )
            current_path = audio_out

        # 4 — Legendas
        if subtitles_srt:
            srt_path = tmp_path / "subtitles.srt"
            srt_path.write_text(subtitles_srt, encoding="utf-8")
            subtitled_out = tmp_path / "with_subtitles.mp4"
            await add_subtitles(current_path, srt_path, subtitled_out)
            current_path = subtitled_out

        # 5 — Exportação final
        final_path = tmp_path / f"final_{aspect_ratio.replace(':', 'x')}.mp4"
        await export_for_platform(current_path, final_path, aspect_ratio)

        return final_path.read_bytes()


# ---------------------------------------------------------------------------
# concatenate_clips
# ---------------------------------------------------------------------------

async def concatenate_clips(clip_paths: list[Path], output_path: Path) -> None:
    """
    Concatena múltiplos clipes MP4 em ordem usando o filtro concat do FFmpeg.

    Para um único clipe, copia diretamente sem re-encode.
    Para múltiplos, usa demuxer concat (copia streams sem re-encode — mais rápido
    e sem perda de qualidade, desde que todos os clipes tenham o mesmo codec).

    Args:
        clip_paths:  Lista de Paths dos clipes locais, em ordem de exibição.
        output_path: Path onde o MP4 concatenado será salvo.

    Raises:
        RuntimeError: se FFmpeg retornar erro.
        ValueError:   se clip_paths estiver vazio.
    """
    if not clip_paths:
        raise ValueError("concatenate_clips: lista de clipes está vazia.")

    if len(clip_paths) == 1:
        shutil.copy(clip_paths[0], output_path)
        logger.debug("concatenate_clips: 1 clipe — copiado diretamente.")
        return

    # Cria arquivo de lista para o demuxer concat
    list_file = output_path.parent / "clips_list.txt"
    with open(list_file, "w", encoding="utf-8") as f:
        for path in clip_paths:
            # Usa caminho absoluto — evita problemas com diretório de trabalho
            f.write(f"file '{path.absolute()}'\n")

    logger.debug(
        "concatenate_clips: concatenando %d clipes → %s",
        len(clip_paths), output_path.name,
    )

    try:
        (
            ffmpeg
            .input(str(list_file), format="concat", safe=0)
            .output(
                str(output_path),
                c="copy",             # Copia sem re-encode (mais rápido)
                movflags="faststart", # Otimiza para streaming web
            )
            .overwrite_output()
            .run(quiet=True)
        )
    except ffmpeg.Error as exc:
        raise RuntimeError(
            f"concatenate_clips: FFmpeg falhou — {exc.stderr.decode()[:500] if exc.stderr else exc}"
        ) from exc


# ---------------------------------------------------------------------------
# mix_audio
# ---------------------------------------------------------------------------

async def mix_audio(
    video_path: Path,
    output_path: Path,
    tmp_dir: Path,
    narration_url: str | None = None,
    music_url: str | None = None,
    narration_volume: float = 1.0,
    music_volume: float = 0.15,
) -> None:
    """
    Adiciona narração e/ou trilha de fundo ao vídeo.

    - Narração: volume configurável (padrão 100%)
    - Trilha de fundo: volume configurável (padrão 15%) com loop se necessário
    - Se nenhum áudio fornecido, copia o vídeo sem alteração

    Args:
        video_path:        Path do vídeo de entrada.
        output_path:       Path do vídeo de saída com áudio.
        tmp_dir:           Diretório temporário para download de arquivos de áudio.
        narration_url:     URL do áudio de narração. Opcional.
        music_url:         URL da trilha de fundo. Opcional.
        narration_volume:  Volume da narração (0.0–1.0). Default 1.0.
        music_volume:      Volume da trilha de fundo (0.0–1.0). Default 0.15.

    Raises:
        RuntimeError: se FFmpeg retornar erro.
    """
    if not narration_url and not music_url:
        shutil.copy(video_path, output_path)
        logger.debug("mix_audio: nenhum áudio fornecido — copiado sem alteração.")
        return

    video_input = ffmpeg.input(str(video_path))
    audio_inputs = []

    if narration_url:
        narration_path = tmp_dir / "narration.mp3"
        await _download_file(narration_url, narration_path)
        audio_inputs.append(
            ffmpeg.input(str(narration_path)).audio
            .filter("volume", narration_volume)
        )
        logger.debug("mix_audio: narração adicionada (volume=%.0f%%)", narration_volume * 100)

    if music_url:
        music_path = tmp_dir / "music.mp3"
        await _download_file(music_url, music_path)
        # stream_loop=-1: loop infinito, truncado pelo parâmetro shortest
        audio_inputs.append(
            ffmpeg.input(str(music_path), stream_loop=-1).audio
            .filter("volume", music_volume)
            .filter("afade", type="out", start_time=0, duration=2)
        )
        logger.debug("mix_audio: trilha de fundo adicionada (volume=%.0f%%)", music_volume * 100)

    # Mixa todos os áudios em uma única stream
    if len(audio_inputs) == 1:
        mixed_audio = audio_inputs[0]
    else:
        mixed_audio = ffmpeg.filter(audio_inputs, "amix", inputs=len(audio_inputs))

    logger.debug("mix_audio: exportando → %s", output_path.name)

    try:
        (
            ffmpeg
            .output(
                video_input.video,
                mixed_audio,
                str(output_path),
                vcodec="copy",       # Não re-encoda o vídeo
                acodec="aac",
                audio_bitrate="192k",
                shortest=None,       # Para quando o stream mais curto terminar
            )
            .overwrite_output()
            .run(quiet=True)
        )
    except ffmpeg.Error as exc:
        raise RuntimeError(
            f"mix_audio: FFmpeg falhou — {exc.stderr.decode()[:500] if exc.stderr else exc}"
        ) from exc


# ---------------------------------------------------------------------------
# add_subtitles
# ---------------------------------------------------------------------------

async def add_subtitles(
    video_path: Path,
    srt_path: Path,
    output_path: Path,
    style: str = _SUBTITLE_STYLE,
) -> None:
    """
    Burn de legendas no vídeo (hardcoded — garante visibilidade no feed mobile).

    Usa o filtro subtitles do FFmpeg com estilo customizável.
    Texto branco com contorno preto, fonte Arial 18px, posição inferior centralizada.

    Args:
        video_path:  Path do vídeo de entrada.
        srt_path:    Path do arquivo SRT com as legendas.
        output_path: Path do vídeo de saída com legendas.
        style:       String de estilo FFmpeg/ASS (override do estilo padrão).

    Raises:
        RuntimeError: se FFmpeg retornar erro ou arquivo SRT não encontrado.
    """
    if not srt_path.exists():
        raise RuntimeError(f"add_subtitles: arquivo SRT não encontrado: {srt_path}")

    # No Windows, o FFmpeg precisa que o path use barras normais e seja escapado
    srt_abs = str(srt_path.absolute()).replace("\\", "/").replace(":", "\\:")

    logger.debug("add_subtitles: adicionando legendas de %s → %s", srt_path.name, output_path.name)

    try:
        (
            ffmpeg
            .input(str(video_path))
            .output(
                str(output_path),
                vf=f"subtitles={srt_abs}:force_style='{style}'",
                acodec="copy",  # Não re-encoda o áudio
                preset="fast",
                crf=23,
            )
            .overwrite_output()
            .run(quiet=True)
        )
    except ffmpeg.Error as exc:
        raise RuntimeError(
            f"add_subtitles: FFmpeg falhou — {exc.stderr.decode()[:500] if exc.stderr else exc}"
        ) from exc


# ---------------------------------------------------------------------------
# export_for_platform
# ---------------------------------------------------------------------------

async def export_for_platform(
    input_path: Path,
    output_path: Path,
    aspect_ratio: str,
) -> None:
    """
    Exporta o vídeo no aspect ratio e qualidade otimizados para anúncio pago.

    Usa padding (letterbox/pillarbox) para redimensionar sem cropar.
    Codifica em H.264 + AAC com bitrate otimizado para feed (4 Mbps vídeo).

    Args:
        input_path:   Path do vídeo de entrada.
        output_path:  Path do MP4 exportado.
        aspect_ratio: "9:16" | "1:1" | "16:9" | "4:5" (ou variantes com "x").

    Raises:
        ValueError:   se aspect_ratio não for reconhecido.
        RuntimeError: se FFmpeg retornar erro.
    """
    config = ASPECT_RATIO_CONFIG.get(aspect_ratio)
    if not config:
        raise ValueError(
            f"export_for_platform: aspect_ratio desconhecido '{aspect_ratio}'. "
            f"Disponíveis: {list(ASPECT_RATIO_CONFIG)}"
        )

    w, h = config["width"], config["height"]
    logger.debug(
        "export_for_platform: exportando %dx%d (%s) → %s",
        w, h, aspect_ratio, output_path.name,
    )

    try:
        (
            ffmpeg
            .input(str(input_path))
            .output(
                str(output_path),
                vf=(
                    f"scale={w}:{h}:force_original_aspect_ratio=decrease,"
                    f"pad={w}:{h}:(ow-iw)/2:(oh-ih)/2:black"
                ),
                vcodec="libx264",
                acodec="aac",
                video_bitrate="4M",       # Qualidade para anúncio pago
                audio_bitrate="192k",
                preset="medium",
                crf=20,
                movflags="faststart",     # Streaming otimizado
                pix_fmt="yuv420p",        # Compatibilidade máxima (iOS, Android)
            )
            .overwrite_output()
            .run(quiet=True)
        )
    except ffmpeg.Error as exc:
        raise RuntimeError(
            f"export_for_platform: FFmpeg falhou — {exc.stderr.decode()[:500] if exc.stderr else exc}"
        ) from exc


# ---------------------------------------------------------------------------
# validate_video_quality
# ---------------------------------------------------------------------------

async def validate_video_quality(video_path: Path) -> dict:
    """
    Valida se o vídeo atende aos requisitos mínimos para veiculação como anúncio pago.

    Critérios verificados (Facebook/Meta Ads):
      - Duração: 5–120 segundos
      - Resolução mínima: 720p (menor dimensão ≥ 720px)
      - Taxa de quadros: ≥ 24 fps
      - Tamanho do arquivo: ≤ 500 MB
      - Presença de faixa de áudio

    Args:
        video_path: Path do arquivo MP4 a validar.

    Returns:
        {
          "valid": bool,
          "issues": [str],
          "metadata": {
            "duration_seconds": float,
            "resolution": "WxH",
            "fps": float,
            "size_mb": float,
            "has_audio": bool,
          }
        }

    Raises:
        RuntimeError: se FFmpeg não conseguir analisar o arquivo.
    """
    if not video_path.exists():
        raise RuntimeError(f"validate_video_quality: arquivo não encontrado: {video_path}")

    try:
        probe = ffmpeg.probe(str(video_path))
    except ffmpeg.Error as exc:
        raise RuntimeError(
            f"validate_video_quality: FFmpeg probe falhou — "
            f"{exc.stderr.decode()[:300] if exc.stderr else exc}"
        ) from exc

    video_stream = next(
        (s for s in probe["streams"] if s["codec_type"] == "video"), None
    )
    audio_stream = next(
        (s for s in probe["streams"] if s["codec_type"] == "audio"), None
    )

    if not video_stream:
        return {
            "valid": False,
            "issues": ["Arquivo não contém stream de vídeo."],
            "metadata": {},
        }

    duration = float(probe["format"].get("duration", 0))
    width = int(video_stream.get("width", 0))
    height = int(video_stream.get("height", 0))

    # fps pode vir como fração ("24/1" ou "30000/1001")
    fps_raw = video_stream.get("r_frame_rate", "0/1")
    try:
        num, den = fps_raw.split("/")
        fps = float(num) / float(den)
    except (ValueError, ZeroDivisionError):
        fps = 0.0

    size_mb = video_path.stat().st_size / (1024 * 1024)

    issues: list[str] = []

    if duration < 5:
        issues.append(f"Vídeo muito curto: {duration:.1f}s (mínimo 5s).")
    if duration > 120:
        issues.append(f"Vídeo muito longo: {duration:.1f}s (máximo 120s para anúncio).")
    if min(width, height) < 720:
        issues.append(f"Resolução abaixo do mínimo: {width}x{height} (mínimo 720p).")
    if fps < 24:
        issues.append(f"Taxa de quadros abaixo do mínimo: {fps:.1f}fps (mínimo 24fps).")
    if size_mb > 500:
        issues.append(f"Arquivo muito grande: {size_mb:.1f}MB (máximo 500MB para Facebook).")
    if not audio_stream:
        issues.append("Sem faixa de áudio — anúncios sem som têm alcance reduzido.")

    metadata = {
        "duration_seconds": round(duration, 1),
        "resolution": f"{width}x{height}",
        "fps": round(fps, 1),
        "size_mb": round(size_mb, 1),
        "has_audio": audio_stream is not None,
    }

    logger.debug(
        "validate_video_quality: %s — valid=%s issues=%d metadata=%s",
        video_path.name, len(issues) == 0, len(issues), metadata,
    )

    return {
        "valid": len(issues) == 0,
        "issues": issues,
        "metadata": metadata,
    }


# ---------------------------------------------------------------------------
# generate_srt
# ---------------------------------------------------------------------------

def generate_srt(
    text: str,
    duration_seconds: float,
    words_per_line: int = 7,
) -> str:
    """
    Gera conteúdo de arquivo SRT a partir do texto do roteiro.

    Distribui o texto uniformemente ao longo da duração total do vídeo.
    O resultado pode ser passado diretamente para add_subtitles() ou salvo
    em disco como arquivo .srt.

    Args:
        text:           Texto completo da narração (roteiro).
        duration_seconds: Duração total do vídeo em segundos.
        words_per_line: Número máximo de palavras por linha de legenda. Default 7.

    Returns:
        String com o conteúdo SRT completo.

    Raises:
        ValueError: se text estiver vazio ou duration_seconds <= 0.
    """
    if not text or not text.strip():
        raise ValueError("generate_srt: texto está vazio.")
    if duration_seconds <= 0:
        raise ValueError(f"generate_srt: duration_seconds inválido ({duration_seconds}).")

    words = text.split()
    if not words:
        raise ValueError("generate_srt: texto sem palavras.")

    # Agrupa palavras em linhas
    lines: list[str] = []
    for i in range(0, len(words), words_per_line):
        lines.append(" ".join(words[i : i + words_per_line]))

    time_per_line = duration_seconds / len(lines)
    srt_blocks: list[str] = []

    for i, line in enumerate(lines):
        start = i * time_per_line
        end = (i + 1) * time_per_line
        srt_blocks.append(
            f"{i + 1}\n"
            f"{_fmt_srt_time(start)} --> {_fmt_srt_time(end)}\n"
            f"{line}"
        )

    return "\n\n".join(srt_blocks) + "\n"


def _fmt_srt_time(t: float) -> str:
    """Formata segundos para o formato de timestamp SRT: HH:MM:SS,mmm"""
    h = int(t // 3600)
    m = int((t % 3600) // 60)
    s = int(t % 60)
    ms = int(round((t % 1) * 1000))
    # Garante que ms não ultrapasse 999 por arredondamento
    if ms >= 1000:
        ms = 999
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


# ---------------------------------------------------------------------------
# Helpers internos
# ---------------------------------------------------------------------------

async def _download_clips(urls: list[str], tmp_dir: Path) -> list[Path]:
    """
    Baixa todos os clipes das URLs para o diretório temporário.
    Mantém a ordem original para preservar a sequência do roteiro.
    """
    paths: list[Path] = []
    async with httpx.AsyncClient(timeout=120.0, follow_redirects=True) as client:
        for i, url in enumerate(urls):
            dest = tmp_dir / f"clip_{i:03d}.mp4"
            logger.debug("_download_clips: baixando clipe %d/%d de %s", i + 1, len(urls), url[:80])
            resp = await client.get(url)
            resp.raise_for_status()
            dest.write_bytes(resp.content)
            paths.append(dest)
    return paths


async def _download_file(url: str, dest: Path) -> None:
    """Baixa um arquivo de uma URL para um Path local."""
    async with httpx.AsyncClient(timeout=60.0, follow_redirects=True) as client:
        resp = await client.get(url)
        resp.raise_for_status()
        dest.write_bytes(resp.content)


# ---------------------------------------------------------------------------
# Executores URL-based — chamados pelo dispatcher de tools do registry
#
# Cada execute_* recebe strings (URLs do R2), baixa para diretório temporário,
# chama a função Path-based correspondente e faz upload do resultado de volta
# ao R2, retornando a URL permanente.
# ---------------------------------------------------------------------------

async def execute_concatenate_clips(clip_urls: list[str]) -> dict:
    """
    Dispatcher wrapper para concatenate_clips().
    Recebe URLs dos clipes, concatena e retorna URL do resultado no R2.
    """
    from app.storage import upload_file

    _assert_ffmpeg_available()

    with tempfile.TemporaryDirectory() as tmp_dir:
        tmp_path = Path(tmp_dir)
        clip_paths = await _download_clips(clip_urls, tmp_path)
        output_path = tmp_path / "concat.mp4"
        await concatenate_clips(clip_paths, output_path)
        file_url = await upload_file(
            file_content=output_path.read_bytes(),
            file_extension="mp4",
            folder="render_intermediate",
            content_type="video/mp4",
        )

    return {"video_url": file_url}


async def execute_mix_audio(
    video_url: str,
    narration_url: str | None = None,
    music_url: str | None = None,
) -> dict:
    """
    Dispatcher wrapper para mix_audio().
    Recebe URLs, mixa áudio e retorna URL do vídeo resultante no R2.
    """
    from app.storage import upload_file

    _assert_ffmpeg_available()

    with tempfile.TemporaryDirectory() as tmp_dir:
        tmp_path = Path(tmp_dir)
        video_path = tmp_path / "input.mp4"
        await _download_file(video_url, video_path)
        output_path = tmp_path / "with_audio.mp4"
        await mix_audio(
            video_path=video_path,
            output_path=output_path,
            tmp_dir=tmp_path,
            narration_url=narration_url,
            music_url=music_url,
        )
        file_url = await upload_file(
            file_content=output_path.read_bytes(),
            file_extension="mp4",
            folder="render_intermediate",
            content_type="video/mp4",
        )

    return {"video_url": file_url}


async def execute_add_subtitles(
    video_url: str,
    srt_content: str,
) -> dict:
    """
    Dispatcher wrapper para add_subtitles().
    Recebe URL do vídeo e conteúdo SRT, retorna URL do vídeo com legendas no R2.
    """
    from app.storage import upload_file

    _assert_ffmpeg_available()

    with tempfile.TemporaryDirectory() as tmp_dir:
        tmp_path = Path(tmp_dir)
        video_path = tmp_path / "input.mp4"
        await _download_file(video_url, video_path)
        srt_path = tmp_path / "subtitles.srt"
        srt_path.write_text(srt_content, encoding="utf-8")
        output_path = tmp_path / "with_subtitles.mp4"
        await add_subtitles(video_path, srt_path, output_path)
        file_url = await upload_file(
            file_content=output_path.read_bytes(),
            file_extension="mp4",
            folder="render_intermediate",
            content_type="video/mp4",
        )

    return {"video_url": file_url}


async def execute_export_for_platform(
    video_url: str,
    aspect_ratio: str,
) -> dict:
    """
    Dispatcher wrapper para export_for_platform().
    Recebe URL do vídeo e aspect ratio, retorna URL do MP4 exportado no R2.
    """
    from app.storage import upload_file

    _assert_ffmpeg_available()

    with tempfile.TemporaryDirectory() as tmp_dir:
        tmp_path = Path(tmp_dir)
        video_path = tmp_path / "input.mp4"
        await _download_file(video_url, video_path)
        safe_ratio = aspect_ratio.replace(":", "x")
        output_path = tmp_path / f"export_{safe_ratio}.mp4"
        await export_for_platform(video_path, output_path, aspect_ratio)
        file_url = await upload_file(
            file_content=output_path.read_bytes(),
            file_extension="mp4",
            folder="final_creatives",
            content_type="video/mp4",
        )

    return {"video_url": file_url, "aspect_ratio": aspect_ratio}


async def execute_validate_video_quality(video_url: str) -> dict:
    """
    Dispatcher wrapper para validate_video_quality().
    Baixa o vídeo, valida e retorna o resultado sem upload (operação read-only).
    """
    _assert_ffmpeg_available()

    with tempfile.TemporaryDirectory() as tmp_dir:
        video_path = Path(tmp_dir) / "input.mp4"
        await _download_file(video_url, video_path)
        result = await validate_video_quality(video_path)

    return result


async def execute_generate_srt(
    script_text: str,
    duration_seconds: float,
    words_per_line: int = 7,
) -> dict:
    """
    Dispatcher wrapper para generate_srt().
    Função puramente textual — sem download/upload.
    """
    srt_content = generate_srt(script_text, duration_seconds, words_per_line)
    return {"srt_content": srt_content}


def _assert_ffmpeg_available() -> None:
    """
    Verifica se o FFmpeg está disponível no PATH do sistema.
    Chamado no início de render_final_creative() para falhar cedo com
    mensagem clara — evita erros crípticos no meio do pipeline.
    """
    if shutil.which("ffmpeg") is None:
        raise RuntimeError(
            "render_video_ffmpeg: FFmpeg não encontrado no PATH do sistema. "
            "Instale com: apt-get install -y ffmpeg"
        )
