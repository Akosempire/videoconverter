import argparse
from pathlib import Path

from moviepy import VideoFileClip


def resolve_input_and_output(input_path=None, output_path=None):
    """Resolve the MOV input and MP4 output paths for conversion."""
    if input_path:
        source_path = Path(input_path).expanduser()
        if not source_path.exists():
            raise FileNotFoundError(
                f"Input file not found: {source_path}. "
                "Place a .mov file in the current folder or pass an explicit path."
            )
    else:
        mov_files = sorted(
            path for path in Path.cwd().iterdir()
            if path.is_file() and path.suffix.lower() == ".mov"
        )
        if not mov_files:
            raise FileNotFoundError(
                "No .mov file found in the current folder. "
                "Usage: python main.py input.mov [output.mp4]"
            )
        if len(mov_files) > 1:
            names = ", ".join(file.name for file in mov_files)
            raise FileNotFoundError(
                f"Multiple MOV files found in the current folder: {names}. "
                "Please specify which file to convert."
            )
        source_path = mov_files[0]

    if output_path:
        target_path = Path(output_path).expanduser()
    else:
        target_path = source_path.with_suffix(".mp4")

    return source_path, target_path


def convert_mov_to_mp4(input_path, output_path):
    """Convert a MOV video file to MP4 while preserving audio."""
    input_path, output_path = resolve_input_and_output(input_path, output_path)
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


def build_parser():
    parser = argparse.ArgumentParser(
        description="Convert a MOV file to MP4 using MoviePy and FFmpeg.",
    )
    parser.add_argument("input_path", nargs="?", default=None, help="Source MOV file")
    parser.add_argument("output_path", nargs="?", default=None, help="Destination MP4 file")
    return parser


def main(argv=None):
    args = build_parser().parse_args(argv)
    try:
        output = convert_mov_to_mp4(args.input_path, args.output_path)
    except FileNotFoundError as exc:
        raise SystemExit(str(exc)) from exc

    print(f"Conversion finished: {output}")
    return output


if __name__ == "__main__":
    main()
