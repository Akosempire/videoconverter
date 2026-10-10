from pathlib import Path

from flask import Flask, render_template, request, send_from_directory, url_for
from werkzeug.utils import secure_filename


def convert_mov_to_mp4(
    input_path, output_path, *, quality="standard", resolution="original", keep_audio=True
):
    """Convert MOV with the selected quality, size limit, and audio preference."""
    from moviepy import VideoFileClip

    input_path = Path(input_path)
    output_path = Path(output_path)

    if not input_path.exists():
        raise FileNotFoundError(f"Input file not found: {input_path}")

    output_path.parent.mkdir(parents=True, exist_ok=True)
    video_clip = VideoFileClip(str(input_path))
    try:
        export_clip = video_clip
        if resolution != "original":
            # Bound both orientations within the chosen landscape/portrait size.
            limit = int(resolution)
            scale = min(
                1, limit / min(video_clip.size), (limit * 16 / 9) / max(video_clip.size)
            )
            if scale < 1:
                dimensions = tuple(
                    max(2, int(dimension * scale) // 2 * 2)
                    for dimension in video_clip.size
                )
                export_clip = video_clip.resized(new_size=dimensions)
        crf = {"standard": "23", "high": "18", "small": "28"}[quality]
        export_clip.write_videofile(
            str(output_path),
            codec="libx264",
            audio_codec="aac",
            audio=keep_audio,
            ffmpeg_params=["-preset", "fast", "-crf", crf, "-threads", "2"],
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

    def error_response(message, status):
        if request.accept_mimetypes.best == "application/json":
            return {"error": message}, status
        return render_template("index.html", error=message), status

    @app.route("/", methods=["GET"])
    def index():
        return render_template("index.html")

    @app.get("/healthz")
    def health():
        return {"status": "ok"}

    @app.route("/design-system", methods=["GET"])
    def design_system():
        return render_template("design-system.html")

    @app.route("/design-system/premium", methods=["GET"])
    def design_system_premium():
        return render_template("design-system-premium.html")

    @app.errorhandler(413)
    def upload_too_large(error):
        return error_response("This file exceeds the 500 MB upload limit.", 413)

    @app.route("/convert", methods=["POST"])
    def convert():
        uploaded_file = request.files.get("video")
        if not uploaded_file or not uploaded_file.filename:
            return error_response("Please choose a MOV file to upload.", 400)

        filename = secure_filename(uploaded_file.filename)
        if not filename.lower().endswith(".mov"):
            return error_response("Only .mov files are supported.", 400)

        quality = request.form.get("quality", "standard")
        resolution = request.form.get("resolution", "original")
        # Preserve the original API default when no option fields were sent.
        keep_audio = request.form.get("keep_audio") == "yes" if "quality" in request.form else True
        if quality not in {"standard", "high", "small"} or resolution not in {"original", "1080", "720"}:
            return error_response("Choose a supported quality and resolution.", 400)

        input_path = upload_dir / filename
        uploaded_file.save(input_path)

        output_path = upload_dir / f"{input_path.stem}.mp4"
        try:
            convert_mov_to_mp4(str(input_path), str(output_path), quality=quality, resolution=resolution, keep_audio=keep_audio)
        except Exception:
            app.logger.exception("Video conversion failed")
            return error_response("This video could not be converted. Make sure it is a valid MOV file and try again.", 500)

        if request.accept_mimetypes.best == "application/json":
            return {
                "download_url": url_for("download_file", filename=output_path.name),
                "filename": output_path.name,
                "size": output_path.stat().st_size,
            }

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
    from server import main

    main()
