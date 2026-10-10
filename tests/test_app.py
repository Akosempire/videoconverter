from io import BytesIO
from pathlib import Path

from moviepy import ColorClip

from app import create_app

import numpy as np
from moviepy import AudioClip, VideoFileClip


def test_upload_route_converts_mov_to_mp4(tmp_path):
    input_path = tmp_path / "sample.mov"
    clip = ColorClip(size=(64, 64), color=(255, 0, 0), duration=1)
    clip.write_videofile(str(input_path), fps=24, codec="libx264", audio=False)
    clip.close()

    app = create_app(test_config={"TESTING": True, "UPLOAD_FOLDER": str(tmp_path)})
    client = app.test_client()

    with open(input_path, "rb") as f:
        response = client.post(
            "/convert",
            data={"video": (BytesIO(f.read()), "sample.mov")},
            content_type="multipart/form-data",
        )

    assert response.status_code == 200
    assert b"download" in response.data.lower()
    assert (tmp_path / "sample.mp4").exists()


def test_workspace_starts_empty(tmp_path):
    client = create_app({"TESTING": True, "UPLOAD_FOLDER": tmp_path}).test_client()
    response = client.get("/")
    assert response.status_code == 200
    assert b'NO FILE SELECTED' in response.data
    assert b'Choose a video' in response.data
    assert b'Assetname here' not in response.data
    assert b'editor-reference.jpg' not in response.data


def test_export_options_resize_mute_and_preserve_source(tmp_path):
    source = tmp_path / "options.mov"
    audio = AudioClip(lambda t: .1 * np.sin(440 * 2 * np.pi * t), duration=.25, fps=44100)
    clip = ColorClip(size=(1600, 900), color=(20, 80, 120), duration=.25).with_audio(audio)
    clip.write_videofile(str(source), fps=8, codec="libx264", audio_codec="aac", logger=None)
    clip.close()
    audio.close()
    original = source.read_bytes()
    client = create_app({"TESTING": True, "UPLOAD_FOLDER": tmp_path}).test_client()
    response = client.post("/convert", headers={"Accept": "application/json"}, data={
        "video": (BytesIO(original), "options.mov"), "quality": "high", "resolution": "720",
    })
    assert response.status_code == 200
    assert response.json["size"] > 0
    assert client.get(response.json["download_url"]).status_code == 200
    with VideoFileClip(str(tmp_path / "options.mp4")) as result:
        assert result.size == [1280, 720]
        assert result.audio is None
    assert source.read_bytes() == original

    response = client.post("/convert", headers={"Accept": "application/json"}, data={
        "video": (BytesIO(original), "options.mov"), "quality": "small", "resolution": "1080", "keep_audio": "yes",
    })
    assert response.status_code == 200
    with VideoFileClip(str(tmp_path / "options.mp4")) as result:
        assert result.size == [1600, 900]  # A 1080p limit never upscales a smaller source.
        assert result.audio is not None


def test_json_errors_are_actionable(tmp_path):
    client = create_app({"TESTING": True, "UPLOAD_FOLDER": tmp_path}).test_client()
    headers = {"Accept": "application/json"}
    assert client.post("/convert", headers=headers).status_code == 400
    invalid = client.post("/convert", headers=headers, data={"video": (BytesIO(b"x"), "bad.txt")})
    assert invalid.status_code == 400
    assert invalid.json["error"] == "Only .mov files are supported."
    options = client.post("/convert", headers=headers, data={"video": (BytesIO(b"x"), "bad.mov"), "quality": "invalid"})
    assert options.status_code == 400
    corrupt = client.post("/convert", headers=headers, data={"video": (BytesIO(b"x"), "bad.mov")})
    assert corrupt.status_code == 500
    assert "valid MOV" in corrupt.json["error"]
