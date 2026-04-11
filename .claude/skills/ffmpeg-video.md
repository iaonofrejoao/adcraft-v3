---
name: ffmpeg-video
description: >
  Process, compose, and render video files using FFmpeg for AI-generated creative assets,
  including concatenating clips, adding subtitles, overlaying audio, exporting in multiple
  formats and aspect ratios, and automating video production pipelines. Use this skill
  whenever implementing video processing, montage, subtitle generation, format conversion,
  or any FFmpeg-based operation in a Python backend. Triggers on: FFmpeg, video montage,
  concatenate clips, add subtitles, video render, aspect ratio conversion, video export,
  or any request involving programmatic video processing.
---

# FFmpeg — Processamento de Vídeo para Criativos

Skill para montar vídeos de criativos de marketing usando FFmpeg via Python,
cobrindo concatenação de clipes, adição de legendas, trilha sonora e exportação em múltiplos formatos.

---

## Instalação

```bash
# Ubuntu/Debian (servidor)
apt-get install -y ffmpeg

# Verificar versão
ffmpeg -version

# Python wrapper
pip install ffmpeg-python --break-system-packages
```

---

## Estrutura do Agente Diretor de Criativo

```python
# app/tools/render_video_ffmpeg.py
import ffmpeg
import tempfile
import os
from pathlib import Path
from app.storage import upload_file

async def render_final_creative(
    video_clips: list[str],    # URLs dos clipes no R2
    audio_url: str | None,     # URL do áudio narrado (opcional)
    music_url: str | None,     # URL da trilha de fundo (opcional)
    subtitles_srt: str | None, # Conteúdo do arquivo SRT
    aspect_ratio: str,         # "9x16" | "1x1" | "16x9"
    output_format: str = "mp4"
) -> str:
    """
    Monta o vídeo final a partir dos clipes gerados.
    Retorna URL do vídeo finalizado no Cloudflare R2.
    """
    with tempfile.TemporaryDirectory() as tmp_dir:
        tmp_path = Path(tmp_dir)

        # 1. Baixa todos os clipes localmente
        clip_paths = await _download_clips(video_clips, tmp_path)

        # 2. Concatena os clipes
        concat_path = tmp_path / "concat.mp4"
        await _concatenate_clips(clip_paths, concat_path)

        # 3. Adiciona áudio se disponível
        if audio_url or music_url:
            audio_path = tmp_path / "with_audio.mp4"
            await _mix_audio(
                video_path=concat_path,
                narration_url=audio_url,
                music_url=music_url,
                output_path=audio_path,
                tmp_dir=tmp_path
            )
            concat_path = audio_path

        # 4. Adiciona legendas se disponível
        if subtitles_srt:
            srt_path = tmp_path / "subtitles.srt"
            srt_path.write_text(subtitles_srt, encoding='utf-8')
            subtitled_path = tmp_path / "with_subtitles.mp4"
            await _add_subtitles(concat_path, srt_path, subtitled_path)
            concat_path = subtitled_path

        # 5. Exporta no aspect ratio correto
        final_path = tmp_path / f"final_{aspect_ratio.replace('x', '_')}.mp4"
        await _export_final(concat_path, final_path, aspect_ratio)

        # 6. Faz upload para R2
        with open(final_path, 'rb') as f:
            video_bytes = f.read()

        url = await upload_file(
            file_content=video_bytes,
            file_extension="mp4",
            folder="final_creatives",
            content_type="video/mp4"
        )

        return url
```

---

## Concatenação de Clipes

```python
async def _concatenate_clips(clip_paths: list[Path], output_path: Path) -> None:
    """
    Concatena múltiplos clipes MP4 em ordem.
    Usa o filtro concat do FFmpeg para transição suave entre clipes.
    """
    if len(clip_paths) == 1:
        # Apenas um clipe — copia direto
        import shutil
        shutil.copy(clip_paths[0], output_path)
        return

    # Cria arquivo de lista para o filtro concat
    list_file = output_path.parent / "clips_list.txt"
    with open(list_file, 'w') as f:
        for path in clip_paths:
            f.write(f"file '{path.absolute()}'\n")

    (
        ffmpeg
        .input(str(list_file), format='concat', safe=0)
        .output(
            str(output_path),
            c='copy',           # Copia sem re-encode (mais rápido)
            movflags='faststart'  # Otimiza para streaming web
        )
        .overwrite_output()
        .run(quiet=True)
    )
```

---

## Mixagem de Áudio

```python
async def _mix_audio(
    video_path: Path,
    narration_url: str | None,
    music_url: str | None,
    output_path: Path,
    tmp_dir: Path
) -> None:
    """
    Adiciona narração e/ou trilha de fundo ao vídeo.
    Narração tem volume 100%, trilha de fundo em 15%.
    """
    video_input = ffmpeg.input(str(video_path))
    audio_inputs = []

    if narration_url:
        narration_path = tmp_dir / "narration.mp3"
        await _download_file(narration_url, narration_path)
        audio_inputs.append(
            ffmpeg.input(str(narration_path)).audio.filter('volume', 1.0)
        )

    if music_url:
        music_path = tmp_dir / "music.mp3"
        await _download_file(music_url, music_path)
        # Loop a música se for mais curta que o vídeo
        audio_inputs.append(
            ffmpeg.input(str(music_path), stream_loop=-1).audio
                .filter('volume', 0.15)
                .filter('afade', type='out', start_time=0, duration=2)
        )

    if not audio_inputs:
        import shutil
        shutil.copy(video_path, output_path)
        return

    # Mixa os áudios
    if len(audio_inputs) == 1:
        mixed_audio = audio_inputs[0]
    else:
        mixed_audio = ffmpeg.filter(audio_inputs, 'amix', inputs=len(audio_inputs))

    # Combina vídeo com áudio mixado
    (
        ffmpeg
        .output(
            video_input.video,
            mixed_audio,
            str(output_path),
            vcodec='copy',
            acodec='aac',
            audio_bitrate='192k',
            shortest=None,       # Para quando o vídeo terminar
        )
        .overwrite_output()
        .run(quiet=True)
    )
```

---

## Adição de Legendas

```python
async def _add_subtitles(
    video_path: Path,
    srt_path: Path,
    output_path: Path
) -> None:
    """
    Burn subtítulos no vídeo (hardcoded para garantir visibilidade no feed).
    Estilo: texto branco com contorno preto, fonte grande, posição inferior.
    """
    subtitle_style = (
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

    (
        ffmpeg
        .input(str(video_path))
        .output(
            str(output_path),
            vf=f"subtitles={srt_path.absolute()}:force_style='{subtitle_style}'",
            acodec='copy',
            preset='fast',
            crf=23
        )
        .overwrite_output()
        .run(quiet=True)
    )
```

---

## Exportação por Aspect Ratio

```python
ASPECT_RATIO_CONFIG = {
    "9x16": {
        "width": 1080,
        "height": 1920,
        "description": "Reels, Stories, TikTok"
    },
    "1x1": {
        "width": 1080,
        "height": 1080,
        "description": "Feed quadrado"
    },
    "16x9": {
        "width": 1920,
        "height": 1080,
        "description": "YouTube, apresentações"
    },
    "4x5": {
        "width": 1080,
        "height": 1350,
        "description": "Feed vertical (maior área)"
    }
}

async def _export_final(
    input_path: Path,
    output_path: Path,
    aspect_ratio: str
) -> None:
    """
    Exporta o vídeo no aspect ratio alvo com qualidade otimizada para anúncio.
    Usa padding (letterbox/pillarbox) para evitar crop indesejado.
    """
    config = ASPECT_RATIO_CONFIG[aspect_ratio]
    w, h = config["width"], config["height"]

    (
        ffmpeg
        .input(str(input_path))
        .output(
            str(output_path),
            # Redimensiona mantendo proporção e adiciona padding
            vf=f"scale={w}:{h}:force_original_aspect_ratio=decrease,"
               f"pad={w}:{h}:(ow-iw)/2:(oh-ih)/2:black",
            vcodec='libx264',
            acodec='aac',
            video_bitrate='4M',       # Qualidade para anúncio pago
            audio_bitrate='192k',
            preset='medium',
            crf=20,
            movflags='faststart',     # Streaming otimizado
            pix_fmt='yuv420p',        # Compatibilidade máxima
        )
        .overwrite_output()
        .run(quiet=True)
    )
```

---

## Geração de SRT a partir de Transcrição

```python
def generate_srt(
    text: str,
    duration_seconds: float,
    words_per_line: int = 7
) -> str:
    """
    Gera arquivo SRT simples a partir do texto da narração.
    Distribui o texto uniformemente pela duração do vídeo.
    """
    words = text.split()
    lines = []
    for i in range(0, len(words), words_per_line):
        lines.append(' '.join(words[i:i + words_per_line]))

    srt_content = []
    time_per_line = duration_seconds / len(lines)

    for i, line in enumerate(lines):
        start = i * time_per_line
        end = (i + 1) * time_per_line

        def fmt_time(t: float) -> str:
            h = int(t // 3600)
            m = int((t % 3600) // 60)
            s = int(t % 60)
            ms = int((t % 1) * 1000)
            return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"

        srt_content.append(
            f"{i + 1}\n"
            f"{fmt_time(start)} --> {fmt_time(end)}\n"
            f"{line}\n"
        )

    return "\n".join(srt_content)
```

---

## Validação de Qualidade do Criativo

```python
async def validate_video_quality(video_path: Path) -> dict:
    """
    Analisa metadados do vídeo para validar se atende requisitos mínimos
    para veiculação como anúncio pago.
    """
    probe = ffmpeg.probe(str(video_path))
    video_stream = next(
        (s for s in probe['streams'] if s['codec_type'] == 'video'), None
    )
    audio_stream = next(
        (s for s in probe['streams'] if s['codec_type'] == 'audio'), None
    )

    duration = float(probe['format']['duration'])
    width = int(video_stream['width'])
    height = int(video_stream['height'])
    fps = eval(video_stream['r_frame_rate'])
    size_mb = os.path.getsize(video_path) / (1024 * 1024)

    issues = []

    if duration < 5:
        issues.append("Vídeo muito curto (mínimo 5 segundos)")
    if duration > 120:
        issues.append("Vídeo muito longo para anúncio (máximo 120 segundos)")
    if min(width, height) < 720:
        issues.append("Resolução abaixo do mínimo (720p)")
    if fps < 24:
        issues.append("Taxa de quadros abaixo de 24fps")
    if size_mb > 500:
        issues.append("Arquivo muito grande (máximo 500MB para Facebook)")
    if not audio_stream:
        issues.append("Sem faixa de áudio")

    return {
        "valid": len(issues) == 0,
        "issues": issues,
        "metadata": {
            "duration_seconds": round(duration, 1),
            "resolution": f"{width}x{height}",
            "fps": round(fps, 1),
            "size_mb": round(size_mb, 1),
            "has_audio": audio_stream is not None,
        }
    }
```
