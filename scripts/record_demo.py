"""Record a demo video of the example slides.

Walks through every chat slide of example.html fragment by fragment, waiting
for each AI answer to finish streaming, then writes media/demo.mp4 and a short
media/demo.gif (title + first conversation) for the README, plus media/demo-full.gif (the whole walkthrough).

Requirements: `pip install playwright && playwright install chromium`, ffmpeg.

Usage (from the repository root):
    quarto render example.qmd
    python scripts/record_demo.py
"""

import shutil
import subprocess
import tempfile
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
MEDIA = ROOT / "media"
WIDTH, HEIGHT = 1280, 720
TRIM_START = 1.6  # seconds of page load cut from the start
GIF_SECONDS = 22  # title slide + first conversation


def record(video_dir: Path) -> Path:
    with sync_playwright() as p:
        browser = p.chromium.launch()
        context = browser.new_context(
            viewport={"width": WIDTH, "height": HEIGHT},
            record_video_dir=str(video_dir),
            record_video_size={"width": WIDTH, "height": HEIGHT},
        )
        page = context.new_page()
        page.goto((ROOT / "example.html").as_uri())
        page.wait_for_timeout(1500)
        page.add_style_tag(content=".slide-menu-button{display:none!important}")
        page.wait_for_timeout(2500)  # title slide

        has_chat = page.evaluate(
            "Array.from(document.querySelectorAll('.slides > section'))"
            ".map(s => !!s.querySelector('.slides-chat'))"
        )
        for h, chat in enumerate(has_chat):
            if not chat:
                continue
            page.evaluate(f"Reveal.slide({h})")
            page.wait_for_timeout(1400)
            while (page.evaluate("Reveal.getIndices().h") == h
                   and page.evaluate("Reveal.availableFragments().next")):
                page.evaluate("Reveal.next()")
                dots = page.evaluate(
                    "!!Reveal.getCurrentSlide()"
                    ".querySelector('.is-typing.visible:not(.text-revealed)')"
                )
                if dots:
                    page.wait_for_timeout(1300)
                    continue
                page.wait_for_timeout(300)
                page.wait_for_function(
                    "!Reveal.getCurrentSlide().querySelector('.is-streaming')",
                    timeout=15000,
                )
                page.wait_for_timeout(1200)
            page.wait_for_timeout(1500)

        video = Path(page.video.path())
        context.close()
        browser.close()
        return video


def gif(mp4: Path, out: Path, fps: int, seconds: float | None = None) -> None:
    duration = ["-t", str(seconds)] if seconds else []
    subprocess.run(
        ["ffmpeg", "-v", "error", "-y", *duration, "-i", str(mp4),
         "-vf", f"fps={fps},scale=800:-1:flags=lanczos,split[a][b];"
                "[a]palettegen=max_colors=96:stats_mode=diff[p];"
                "[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle",
         str(out)],
        check=True,
    )


def encode(webm: Path) -> None:
    MEDIA.mkdir(exist_ok=True)
    mp4 = MEDIA / "demo.mp4"
    subprocess.run(
        ["ffmpeg", "-v", "error", "-y", "-ss", str(TRIM_START), "-i", str(webm),
         "-c:v", "libx264", "-crf", "23", "-preset", "slow",
         "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(mp4)],
        check=True,
    )
    # GitHub READMEs cannot play a video stored in the repository, so the
    # full walkthrough is also shipped as a GIF.
    gif(mp4, MEDIA / "demo.gif", fps=12, seconds=GIF_SECONDS)
    gif(mp4, MEDIA / "demo-full.gif", fps=10)


if __name__ == "__main__":
    tmp = Path(tempfile.mkdtemp())
    try:
        encode(record(tmp))
    finally:
        shutil.rmtree(tmp)
    print(f"Wrote demo.mp4, demo.gif and demo-full.gif to {MEDIA}")
