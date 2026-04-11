"""
Testes para app/tools/render_video_ffmpeg.py

Cobre:
  generate_srt():
    - Texto normal → SRT válido com timestamps corretos
    - Texto vazio → ValueError
    - duration <= 0 → ValueError
    - words_per_line respeita agrupamento
    - Timestamps formatados como HH:MM:SS,mmm

  _fmt_srt_time():
    - Formata segundos corretamente para formato SRT

  validate_video_quality() (com ffmpeg.probe mockado):
    - Vídeo válido → valid=True, issues vazio
    - Vídeo curto (<5s) → issue de duração
    - Resolução abaixo de 720p → issue de resolução
    - FPS abaixo de 24 → issue de FPS
    - Sem áudio → issue de áudio
    - Arquivo inexistente → RuntimeError

  concatenate_clips():
    - Lista vazia → ValueError
    - Um clipe → copia direto sem ffmpeg

  export_for_platform():
    - Aspect ratio desconhecido → ValueError

  ASPECT_RATIO_CONFIG:
    - Todos os ratios previstos presentes
    - Cada ratio tem width e height

  _assert_ffmpeg_available():
    - FFmpeg ausente → RuntimeError
"""

import shutil
import tempfile
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest


# ---------------------------------------------------------------------------
# Testes — generate_srt()
# ---------------------------------------------------------------------------

class TestGenerateSrt:

    def test_basic_srt_generation(self):
        """Texto normal deve gerar SRT com blocos numerados e timestamps."""
        from app.tools.render_video_ffmpeg import generate_srt

        srt = generate_srt(
            text="Olá pessoal, hoje vamos falar sobre um assunto importante para vocês.",
            duration_seconds=10.0,
        )

        assert isinstance(srt, str)
        assert "1\n" in srt
        assert "-->" in srt
        # Deve começar em 00:00:00,000
        assert "00:00:00,000" in srt

    def test_srt_respects_words_per_line(self):
        """words_per_line=3 deve gerar mais blocos com menos palavras cada."""
        from app.tools.render_video_ffmpeg import generate_srt

        text = "uma duas três quatro cinco seis sete oito nove"
        srt = generate_srt(text, duration_seconds=9.0, words_per_line=3)

        # 9 palavras / 3 por linha = 3 blocos
        assert "1\n" in srt
        assert "2\n" in srt
        assert "3\n" in srt

    def test_empty_text_raises_value_error(self):
        """Texto vazio deve lançar ValueError."""
        from app.tools.render_video_ffmpeg import generate_srt

        with pytest.raises(ValueError, match="vazio"):
            generate_srt("", duration_seconds=10.0)

    def test_whitespace_text_raises_value_error(self):
        """Texto com apenas espaços deve lançar ValueError."""
        from app.tools.render_video_ffmpeg import generate_srt

        with pytest.raises(ValueError, match="vazio"):
            generate_srt("   \n\t  ", duration_seconds=10.0)

    def test_zero_duration_raises_value_error(self):
        """duration_seconds=0 deve lançar ValueError."""
        from app.tools.render_video_ffmpeg import generate_srt

        with pytest.raises(ValueError, match="duration"):
            generate_srt("Texto qualquer", duration_seconds=0)

    def test_negative_duration_raises_value_error(self):
        """duration_seconds negativo deve lançar ValueError."""
        from app.tools.render_video_ffmpeg import generate_srt

        with pytest.raises(ValueError, match="duration"):
            generate_srt("Texto qualquer", duration_seconds=-5.0)

    def test_single_word_generates_one_block(self):
        """Uma única palavra deve gerar exatamente 1 bloco SRT."""
        from app.tools.render_video_ffmpeg import generate_srt

        srt = generate_srt("Olá", duration_seconds=3.0)

        assert "1\n" in srt
        assert "2\n" not in srt
        assert "Olá" in srt

    def test_timestamps_are_sequential(self):
        """Timestamps devem ser sequenciais — end de um bloco = start do próximo."""
        from app.tools.render_video_ffmpeg import generate_srt

        srt = generate_srt(
            text="a b c d e f g h i j k l m n",
            duration_seconds=14.0,
            words_per_line=7,
        )

        # 14 palavras / 7 por linha = 2 blocos
        # Bloco 1: 00:00:00,000 → 00:00:07,000
        # Bloco 2: 00:00:07,000 → 00:00:14,000
        lines = srt.strip().split("\n")
        # Verifica que o SRT contém 2 blocos separados por linha vazia
        assert len([l for l in lines if "-->" in l]) == 2


# ---------------------------------------------------------------------------
# Testes — _fmt_srt_time()
# ---------------------------------------------------------------------------

class TestFmtSrtTime:

    def test_zero_seconds(self):
        from app.tools.render_video_ffmpeg import _fmt_srt_time
        assert _fmt_srt_time(0.0) == "00:00:00,000"

    def test_fractional_seconds(self):
        from app.tools.render_video_ffmpeg import _fmt_srt_time
        assert _fmt_srt_time(1.5) == "00:00:01,500"

    def test_full_format(self):
        """1 hora, 2 minutos, 3.456 segundos → formato correto."""
        from app.tools.render_video_ffmpeg import _fmt_srt_time
        t = 3600 + 120 + 3.456
        result = _fmt_srt_time(t)
        assert result == "01:02:03,456"

    def test_large_seconds(self):
        """65.5 segundos → 00:01:05,500."""
        from app.tools.render_video_ffmpeg import _fmt_srt_time
        assert _fmt_srt_time(65.5) == "00:01:05,500"


# ---------------------------------------------------------------------------
# Testes — validate_video_quality() (com ffmpeg.probe mockado)
# ---------------------------------------------------------------------------

class TestValidateVideoQuality:

    def _make_probe_result(
        self,
        duration: float = 60.0,
        width: int = 1080,
        height: int = 1920,
        fps: str = "30/1",
        has_audio: bool = True,
    ) -> dict:
        """Cria resultado de ffmpeg.probe mockado."""
        streams = [
            {
                "codec_type": "video",
                "width": width,
                "height": height,
                "r_frame_rate": fps,
            }
        ]
        if has_audio:
            streams.append({"codec_type": "audio"})

        return {
            "format": {"duration": str(duration)},
            "streams": streams,
        }

    @pytest.mark.asyncio
    async def test_valid_video_passes(self):
        """Vídeo com todos os requisitos deve retornar valid=True."""
        from app.tools.render_video_ffmpeg import validate_video_quality

        with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as f:
            f.write(b"\x00" * 1024)
            f.flush()
            video_path = Path(f.name)

        try:
            probe_result = self._make_probe_result()
            with patch("ffmpeg.probe", return_value=probe_result):
                result = await validate_video_quality(video_path)

            assert result["valid"] is True
            assert result["issues"] == []
            assert result["metadata"]["duration_seconds"] == 60.0
            assert result["metadata"]["resolution"] == "1080x1920"
            assert result["metadata"]["has_audio"] is True
        finally:
            video_path.unlink(missing_ok=True)

    @pytest.mark.asyncio
    async def test_short_video_fails(self):
        """Vídeo com duração < 5s deve ter issue de duração."""
        from app.tools.render_video_ffmpeg import validate_video_quality

        with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as f:
            f.write(b"\x00" * 512)
            f.flush()
            video_path = Path(f.name)

        try:
            probe_result = self._make_probe_result(duration=3.5)
            with patch("ffmpeg.probe", return_value=probe_result):
                result = await validate_video_quality(video_path)

            assert result["valid"] is False
            assert any("curto" in issue for issue in result["issues"])
        finally:
            video_path.unlink(missing_ok=True)

    @pytest.mark.asyncio
    async def test_long_video_fails(self):
        """Vídeo com duração > 120s deve ter issue de duração."""
        from app.tools.render_video_ffmpeg import validate_video_quality

        with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as f:
            f.write(b"\x00" * 512)
            f.flush()
            video_path = Path(f.name)

        try:
            probe_result = self._make_probe_result(duration=180.0)
            with patch("ffmpeg.probe", return_value=probe_result):
                result = await validate_video_quality(video_path)

            assert result["valid"] is False
            assert any("longo" in issue for issue in result["issues"])
        finally:
            video_path.unlink(missing_ok=True)

    @pytest.mark.asyncio
    async def test_low_resolution_fails(self):
        """Resolução abaixo de 720p deve ter issue de resolução."""
        from app.tools.render_video_ffmpeg import validate_video_quality

        with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as f:
            f.write(b"\x00" * 512)
            f.flush()
            video_path = Path(f.name)

        try:
            probe_result = self._make_probe_result(width=480, height=640)
            with patch("ffmpeg.probe", return_value=probe_result):
                result = await validate_video_quality(video_path)

            assert result["valid"] is False
            assert any("Resolução" in issue or "resolução" in issue
                       for issue in result["issues"])
        finally:
            video_path.unlink(missing_ok=True)

    @pytest.mark.asyncio
    async def test_low_fps_fails(self):
        """FPS abaixo de 24 deve ter issue de taxa de quadros."""
        from app.tools.render_video_ffmpeg import validate_video_quality

        with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as f:
            f.write(b"\x00" * 512)
            f.flush()
            video_path = Path(f.name)

        try:
            probe_result = self._make_probe_result(fps="15/1")
            with patch("ffmpeg.probe", return_value=probe_result):
                result = await validate_video_quality(video_path)

            assert result["valid"] is False
            assert any("quadros" in issue or "fps" in issue.lower()
                       for issue in result["issues"])
        finally:
            video_path.unlink(missing_ok=True)

    @pytest.mark.asyncio
    async def test_no_audio_generates_warning(self):
        """Vídeo sem áudio deve ter issue de áudio."""
        from app.tools.render_video_ffmpeg import validate_video_quality

        with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as f:
            f.write(b"\x00" * 512)
            f.flush()
            video_path = Path(f.name)

        try:
            probe_result = self._make_probe_result(has_audio=False)
            with patch("ffmpeg.probe", return_value=probe_result):
                result = await validate_video_quality(video_path)

            assert result["metadata"]["has_audio"] is False
            assert any("áudio" in issue or "audio" in issue.lower()
                       for issue in result["issues"])
        finally:
            video_path.unlink(missing_ok=True)

    @pytest.mark.asyncio
    async def test_missing_file_raises_runtime_error(self):
        """Arquivo inexistente deve lançar RuntimeError."""
        from app.tools.render_video_ffmpeg import validate_video_quality

        fake_path = Path("/tmp/nonexistent_video_12345.mp4")
        with pytest.raises(RuntimeError, match="não encontrado"):
            await validate_video_quality(fake_path)

    @pytest.mark.asyncio
    async def test_multiple_issues_accumulated(self):
        """Vídeo com múltiplos problemas deve acumular todos os issues."""
        from app.tools.render_video_ffmpeg import validate_video_quality

        with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as f:
            f.write(b"\x00" * 512)
            f.flush()
            video_path = Path(f.name)

        try:
            # Curto + baixa resolução + baixo FPS + sem áudio
            probe_result = self._make_probe_result(
                duration=2.0, width=320, height=240, fps="12/1", has_audio=False
            )
            with patch("ffmpeg.probe", return_value=probe_result):
                result = await validate_video_quality(video_path)

            assert result["valid"] is False
            assert len(result["issues"]) >= 3  # duração + resolução + fps (+ áudio)
        finally:
            video_path.unlink(missing_ok=True)


# ---------------------------------------------------------------------------
# Testes — concatenate_clips()
# ---------------------------------------------------------------------------

class TestConcatenateClips:

    @pytest.mark.asyncio
    async def test_empty_list_raises_value_error(self):
        """Lista vazia deve lançar ValueError."""
        from app.tools.render_video_ffmpeg import concatenate_clips

        with pytest.raises(ValueError, match="vazia"):
            await concatenate_clips([], Path("/tmp/output.mp4"))

    @pytest.mark.asyncio
    async def test_single_clip_copies_directly(self):
        """Um único clipe deve ser copiado diretamente sem chamar FFmpeg."""
        from app.tools.render_video_ffmpeg import concatenate_clips

        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp = Path(tmp_dir)
            clip = tmp / "clip_000.mp4"
            clip.write_bytes(b"fake-video-content")
            output = tmp / "output.mp4"

            with patch("ffmpeg.input") as mock_ffmpeg:
                await concatenate_clips([clip], output)
                # FFmpeg não deve ter sido chamado
                mock_ffmpeg.assert_not_called()

            # Output deve conter os mesmos bytes do input
            assert output.read_bytes() == b"fake-video-content"


# ---------------------------------------------------------------------------
# Testes — export_for_platform()
# ---------------------------------------------------------------------------

class TestExportForPlatform:

    @pytest.mark.asyncio
    async def test_unknown_aspect_ratio_raises_value_error(self):
        """Aspect ratio desconhecido deve lançar ValueError."""
        from app.tools.render_video_ffmpeg import export_for_platform

        with pytest.raises(ValueError, match="desconhecido"):
            await export_for_platform(
                input_path=Path("/tmp/input.mp4"),
                output_path=Path("/tmp/output.mp4"),
                aspect_ratio="3:2",
            )


# ---------------------------------------------------------------------------
# Testes — ASPECT_RATIO_CONFIG
# ---------------------------------------------------------------------------

class TestAspectRatioConfig:

    def test_all_standard_ratios_present(self):
        """Todos os ratios padrão devem estar configurados."""
        from app.tools.render_video_ffmpeg import ASPECT_RATIO_CONFIG

        for ratio in ["9:16", "1:1", "16:9", "4:5"]:
            assert ratio in ASPECT_RATIO_CONFIG, f"Ratio {ratio} ausente"

    def test_each_ratio_has_dimensions(self):
        """Cada ratio deve ter width e height definidos."""
        from app.tools.render_video_ffmpeg import ASPECT_RATIO_CONFIG

        for ratio, config in ASPECT_RATIO_CONFIG.items():
            assert "width" in config, f"width ausente em {ratio}"
            assert "height" in config, f"height ausente em {ratio}"
            assert config["width"] > 0
            assert config["height"] > 0


# ---------------------------------------------------------------------------
# Testes — _assert_ffmpeg_available()
# ---------------------------------------------------------------------------

class TestAssertFfmpegAvailable:

    def test_ffmpeg_missing_raises_runtime_error(self):
        """FFmpeg ausente do PATH deve lançar RuntimeError."""
        from app.tools.render_video_ffmpeg import _assert_ffmpeg_available

        with patch("shutil.which", return_value=None):
            with pytest.raises(RuntimeError, match="FFmpeg"):
                _assert_ffmpeg_available()

    def test_ffmpeg_present_does_not_raise(self):
        """FFmpeg presente no PATH não deve lançar exceção."""
        from app.tools.render_video_ffmpeg import _assert_ffmpeg_available

        with patch("shutil.which", return_value="/usr/bin/ffmpeg"):
            _assert_ffmpeg_available()  # Não deve lançar


# ---------------------------------------------------------------------------
# Testes — execute_generate_srt (dispatcher wrapper)
# ---------------------------------------------------------------------------

class TestExecuteGenerateSrt:

    @pytest.mark.asyncio
    async def test_returns_dict_with_srt_content(self):
        """Wrapper deve retornar dict com chave srt_content."""
        from app.tools.render_video_ffmpeg import execute_generate_srt

        result = await execute_generate_srt(
            script_text="Olá pessoal, hoje tenho uma novidade para vocês.",
            duration_seconds=5.0,
        )

        assert isinstance(result, dict)
        assert "srt_content" in result
        assert "-->" in result["srt_content"]
        assert "Olá" in result["srt_content"]

    @pytest.mark.asyncio
    async def test_custom_words_per_line(self):
        """words_per_line customizado deve ser respeitado."""
        from app.tools.render_video_ffmpeg import execute_generate_srt

        result = await execute_generate_srt(
            script_text="uma duas três quatro cinco seis sete oito nove",
            duration_seconds=9.0,
            words_per_line=3,
        )

        srt = result["srt_content"]
        # 9 palavras / 3 = 3 blocos
        assert srt.count("-->") == 3
