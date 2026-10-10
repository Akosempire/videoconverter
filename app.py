from pathlib import Path

from flask import Flask, render_template, request, send_from_directory, url_for
from moviepy import VideoFileClip
from werkzeug.utils import secure_filename


def convert_mov_to_mp4(input_path, output_path):
    """Convert a MOV file to MP4 while preserving audio."""
    input_path = Path(input_path)
    output_path = Path(output_path)

    if not input_path.exists():
        raise FileNotFoundError(f"Input file not found: {input_path}")

    output_path.parent.mkdir(parents=True, exist_ok=True)
    video_clip = VideoFileClip(str(input_path))
    try:
        video_clip.write_videofile(
            str(output_path),
            codec="libx264",
            audio_codec="aac",
            ffmpeg_params=["-preset", "fast", "-crf", "23", "-threads", "4"],
        )
    finally:
        video_clip.close()

    return output_path


def create_app(test_config=None):
    app = Flask(__name__)
    app.config.update(
        SECRET_KEY="dev-secret-key",
        UPLOAD_FOLDER=Path(__file__).resolve().parent / "uploads",
        MAX_CONTENT_LENGTH=500 * 1024 * 1024,
        TESTING=False,
    )

    if test_config:
        app.config.update(test_config)

    upload_dir = Path(app.config["UPLOAD_FOLDER"])
    upload_dir.mkdir(parents=True, exist_ok=True)

    @app.route("/", methods=["GET"])
    def index():
        return render_template("index.html")

    @app.route("/convert", methods=["POST"])
    def convert():
        uploaded_file = request.files.get("video")
        if not uploaded_file or not uploaded_file.filename:
            return render_template("index.html", error="Please choose a MOV file to upload."), 400

        filename = secure_filename(uploaded_file.filename)
        if not filename.lower().endswith(".mov"):
            return render_template("index.html", error="Only .mov files are supported."), 400

        input_path = upload_dir / filename
        uploaded_file.save(input_path)

        output_path = upload_dir / f"{input_path.stem}.mp4"
        try:
            convert_mov_to_mp4(str(input_path), str(output_path))
        except Exception as exc:
            return render_template("index.html", error=f"Conversion failed: {exc}"), 500

        return render_template(
            "index.html",
            success=True,
            download_url=url_for("download_file", filename=output_path.name),
            filename=output_path.name,
        )

    @app.route("/download/<path:filename>")
    def download_file(filename):
        return send_from_directory(upload_dir, filename, as_attachment=True)

    return app


if __name__ == "__main__":
    create_app().run(debug=True, host="0.0.0.0", port=5000)
