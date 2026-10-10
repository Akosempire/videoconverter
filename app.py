import logging
import shutil
import uuid
from pathlib import Path

from flask import Flask, render_template, request, send_from_directory, url_for
from werkzeug.exceptions import RequestEntityTooLarge
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
    export_clip = video_clip
    try:
        if resolution != "original":
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
        # Heavy-file fast path: for UGC/large sources the proxy (30-60s) would
        # 502 before ffmpeg finishes. Auto-switch to ultrafast and cap to 720p
        # when the source is clearly heavy, keeping quality choice via CRF only.
        try:
            src_bytes = input_path.stat().st_size
        except Exception:
            src_bytes = 0
        is_heavy = src_bytes > 150 * 1024 * 1024 or max(video_clip.size) > 1920 or getattr(video_clip, "duration", 0) > 120
        preset = "ultrafast" if is_heavy else "fast"
        # If auto-capped, ensure we don't upscale; pick 720 when source >720 and user left original
        auto_limited = False
        if is_heavy and resolution == "original" and max(video_clip.size) > 1280:
            limit = 720
            scale = min(1, limit / min(video_clip.size), (limit * 16 / 9) / max(video_clip.size))
            if scale < 1:
                dimensions = tuple(max(2, int(d * scale) // 2 * 2) for d in video_clip.size)
                # Replace prior resize if any: close previous export_clip first
                if export_clip is not video_clip:
                    try:
                        export_clip.close()
                    except Exception:
                        pass
                export_clip = video_clip.resized(new_size=dimensions)
                auto_limited = True
        export_clip.write_videofile(
            str(output_path),
            codec="libx264",
            audio_codec="aac",
            audio=keep_audio,
            ffmpeg_params=["-preset", preset, "-crf", crf, "-threads", "2"],
            logger=None,
        )
    finally:
        try:
            if export_clip is not video_clip:
                export_clip.close()
        except Exception:
            pass
        try:
            video_clip.close()
        except Exception:
            pass

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

    def wants_json():
        return (
            "application/json" in request.headers.get("Accept", "")
            or request.accept_mimetypes.accept_json
            or request.accept_mimetypes.best == "application/json"
            or request.is_json
            or request.headers.get("X-Requested-With") == "XMLHttpRequest"
        )

    def error_response(message, status):
        if wants_json():
            return {"error": message}, status
        return render_template("index.html", error=message), status

    @app.route("/", methods=["GET"])
    def index():
        return render_template("index.html")

    @app.get("/healthz")
    def health():
        # Lightweight but informative: check disk and ffmpeg via quick probe
        try:
            usage = shutil.disk_usage(upload_dir)
            free_mb = usage.free // (1024 * 1024)
            if free_mb < 100:
                return {"status": "degraded", "free_mb": free_mb}, 200
        except Exception:
            pass
        return {"status": "ok"}

    @app.route("/design-system", methods=["GET"])
    def design_system():
        return render_template("design-system.html")

    @app.route("/design-system/premium", methods=["GET"])
    def design_system_premium():
        return render_template("design-system-premium.html")

    @app.errorhandler(RequestEntityTooLarge)
    @app.errorhandler(413)
    def upload_too_large(error):
        return error_response("This file exceeds the 500 MB upload limit. Try a smaller or shorter MOV, or use 720p / Smaller file.", 413)

    @app.errorhandler(400)
    def bad_request(error):
        return error_response("Bad request. Please try again.", 400)

    @app.errorhandler(404)
    def not_found(error):
        if wants_json():
            return {"error": "Not found."}, 404
        return error, 404

    @app.errorhandler(405)
    def method_not_allowed(error):
        if wants_json():
            return {"error": "Method not allowed."}, 405
        return error, 405

    @app.errorhandler(500)
    def internal_error(error):
        app.logger.exception("Unhandled 500: %s", error)
        return error_response("The converter hit an unexpected error. Try a shorter or smaller MOV, or retry in a moment.", 500)

    @app.errorhandler(502)
    def bad_gateway(error):
        app.logger.warning("502 bad gateway: %s", error)
        return error_response("The server is busy or the video is too heavy to convert right now. Try a shorter/smaller MOV (720p, Smaller file) or wait a minute and retry.", 502)

    @app.errorhandler(504)
    def gateway_timeout(error):
        return error_response("Conversion took too long and timed out. Try a shorter clip, 720p, or Smaller file.", 504)

    @app.errorhandler(Exception)
    def unhandled_exception(error):
        # Let HTTPExceptions (with .code) pass through to their handlers
        if hasattr(error, "code") and isinstance(getattr(error, "code"), int):
            # Re-raise so Flask routes to the specific handler above
            raise error
        app.logger.exception("Unhandled exception: %s", error)
        return error_response("An unexpected error occurred. Please try again with a valid MOV.", 500)

    @app.before_request
    def check_disk_space():
        # Only for convert POSTs: fail fast if disk is critically low
        if request.path == "/convert" and request.method == "POST":
            try:
                free = shutil.disk_usage(upload_dir).free
                if free < 50 * 1024 * 1024:
                    return error_response("Server storage is critically low. Please try again later.", 503)
            except Exception:
                pass

    @app.route("/convert", methods=["POST"])
    def convert():
        files = request.files.getlist("video")
        if not files or not any(f.filename for f in files):
            files = request.files.getlist("videos")
        if not files or not any(f.filename for f in files):
            single = request.files.get("video")
            files = [single] if single and single.filename else []
        if not files:
            return error_response("Please choose a MOV file to upload.", 400)

        quality = request.form.get("quality", "standard")
        resolution = request.form.get("resolution", "original")
        keep_audio = request.form.get("keep_audio") == "yes" if "quality" in request.form else True
        if quality not in {"standard", "high", "small"} or resolution not in {"original", "1080", "720"}:
            return error_response("Choose a supported quality and resolution.", 400)

        expects_json = wants_json()

        results = []
        errors = []
        for uploaded_file in files:
            if not uploaded_file or not uploaded_file.filename:
                continue
            original_name = uploaded_file.filename
            filename = secure_filename(original_name)
            if not filename:
                errors.append({"filename": original_name, "error": "Invalid filename."})
                continue
            if not filename.lower().endswith(".mov"):
                errors.append({"filename": original_name, "error": "Only .mov files are supported."})
                continue
            if uploaded_file.content_length is not None and uploaded_file.content_length > app.config["MAX_CONTENT_LENGTH"]:
                errors.append({"filename": filename, "error": "This file exceeds the 500 MB upload limit."})
                continue

            # Use a unique temp input to avoid collisions across concurrent users / batches
            tmp_input = upload_dir / f".tmp.{uuid.uuid4().hex}_{filename}"
            try:
                uploaded_file.save(tmp_input)
                if tmp_input.stat().st_size > app.config["MAX_CONTENT_LENGTH"]:
                    tmp_input.unlink(missing_ok=True)
                    errors.append({"filename": filename, "error": "This file exceeds the 500 MB upload limit."})
                    continue
                if tmp_input.stat().st_size == 0:
                    tmp_input.unlink(missing_ok=True)
                    errors.append({"filename": filename, "error": "This file is empty. Try a valid MOV export."})
                    continue
            except RequestEntityTooLarge:
                if tmp_input.exists():
                    tmp_input.unlink(missing_ok=True)
                errors.append({"filename": filename, "error": "This file exceeds the 500 MB upload limit."})
                continue
            except Exception as exc:
                app.logger.exception("Save failed for %s", filename)
                if tmp_input.exists():
                    tmp_input.unlink(missing_ok=True)
                errors.append({"filename": filename, "error": f"Could not save the uploaded file: {exc}"})
                continue

            # Output keeps the expected stem for tests and user clarity; tmp collision avoided via input.
            # For batches with duplicate stems, make the second unique so it doesn't overwrite the first.
            output_path = upload_dir / f"{Path(filename).stem}.mp4"
            if len(files) > 1 and output_path.exists():
                output_path = upload_dir / f"{Path(filename).stem}_{uuid.uuid4().hex[:6]}.mp4"
            try:
                convert_mov_to_mp4(str(tmp_input), str(output_path), quality=quality, resolution=resolution, keep_audio=keep_audio)
            except Exception as exc:
                app.logger.exception("Video conversion failed for %s", filename)
                detail = str(exc).strip()
                if "moov atom not found" in detail or "Invalid data" in detail:
                    errors.append({"filename": filename, "error": "This file doesn’t look like a valid MOV. Try another QuickTime export."})
                elif "No such file" in detail or "not found" in detail.lower():
                    errors.append({"filename": filename, "error": "The uploaded file couldn’t be read. Please try uploading again."})
                elif "Unknown encoder" in detail or "codec" in detail.lower():
                    errors.append({"filename": filename, "error": "This MOV uses an unsupported codec. Try re-exporting as H.264/AAC."})
                else:
                    # Include short detail for debugging but keep user-facing concise
                    short = detail.split("\n")[-1][:180] if detail else "unknown"
                    app.logger.warning("Conversion detail for %s: %s", filename, short)
                    errors.append({"filename": filename, "error": "This video could not be converted. Try a shorter clip or re-export as H.264/AAC."})
                if tmp_input.exists():
                    tmp_input.unlink(missing_ok=True)
                continue
            finally:
                if tmp_input.exists():
                    try:
                        tmp_input.unlink(missing_ok=True)
                    except Exception:
                        pass

            try:
                sz = output_path.stat().st_size
                if sz == 0:
                    errors.append({"filename": filename, "error": "Conversion produced an empty file. Try again."})
                    continue
            except FileNotFoundError:
                errors.append({"filename": filename, "error": "Conversion finished but the output is missing."})
                continue

            results.append({
                "download_url": url_for("download_file", filename=output_path.name),
                "filename": output_path.name,
                "source": filename,
                "original": original_name,
                "size": output_path.stat().st_size,
            })

        if len(files) == 1 and not errors and len(results) == 1:
            if expects_json:
                return results[0]
            return render_template(
                "index.html",
                success=True,
                download_url=results[0]["download_url"],
                filename=results[0]["filename"],
            )
        if len(files) == 1 and errors:
            # Single-file error should be JSON for XHR, HTML otherwise
            err = errors[0]
            is_client = "Only .mov" in err["error"] or "empty" in err["error"].lower() or "Invalid filename" in err["error"]
            return error_response(err["error"], 400 if is_client else 500)

        if expects_json:
            status = 200 if results else (400 if errors and not results and any("Only .mov" in e["error"] or "empty" in e["error"].lower() for e in errors) else 500)
            return {"results": results, "errors": errors, "count": len(results)}, status
        if results:
            return render_template(
                "index.html",
                success=True,
                download_url=results[0]["download_url"],
                filename=results[0]["filename"],
            )
        return error_response(errors[0]["error"] if errors else "Batch conversion failed.", 400 if errors and any("Only .mov" in e["error"] for e in errors) else 500)

    @app.route("/download/<path:filename>")
    def download_file(filename):
        # Prevent path traversal — only serve files that live directly in upload_dir
        safe = secure_filename(Path(filename).name)
        if safe != Path(filename).name or Path(filename).name != filename:
            return error_response("Invalid download path.", 400)
        return send_from_directory(upload_dir, filename, as_attachment=True)

    return app


if __name__ == "__main__":
    from server import main

    main()
