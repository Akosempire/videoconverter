from io import BytesIO
from pathlib import Path

from moviepy import ColorClip

from app import create_app


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
