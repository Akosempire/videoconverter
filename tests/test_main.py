from moviepy import ColorClip

import main


def test_convert_mov_to_mp4_creates_output(tmp_path):
    input_path = tmp_path / "sample.mov"
    output_path = tmp_path / "converted" / "sample.mp4"

    clip = ColorClip(size=(64, 64), color=(255, 0, 0), duration=1)
    clip.write_videofile(str(input_path), fps=24, codec="libx264", audio=False)
    clip.close()

    main.convert_mov_to_mp4(str(input_path), str(output_path))

    assert output_path.exists()
    assert output_path.stat().st_size > 0


def test_main_uses_single_mov_in_directory(tmp_path, monkeypatch):
    input_path = tmp_path / "demo.mov"
    output_path = tmp_path / "demo.mp4"

    clip = ColorClip(size=(64, 64), color=(0, 255, 0), duration=1)
    clip.write_videofile(str(input_path), fps=24, codec="libx264", audio=False)
    clip.close()

    monkeypatch.chdir(tmp_path)
    result = main.main([])

    assert result == output_path
    assert output_path.exists()
    assert output_path.stat().st_size > 0
