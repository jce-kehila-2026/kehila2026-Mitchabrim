"""Generate deterministic local WebP variants for PERF-04.

Original source assets are intentionally retained as visual masters. Runtime
code references the generated variants.
"""

from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
HERO_DIR = ROOT / "public" / "admin-heroes"


def save_webp(source: Path, destination: Path, width: int | None, quality: int) -> None:
    with Image.open(source) as image:
        image.load()
        if width and image.width > width:
            height = round(image.height * width / image.width)
            image = image.resize((width, height), Image.Resampling.LANCZOS)
        destination.parent.mkdir(parents=True, exist_ok=True)
        image.save(
            destination,
            "WEBP",
            quality=quality,
            method=6,
            exact=True,
        )


for source in sorted(HERO_DIR.glob("*.png")):
    save_webp(source, source.with_suffix(".webp"), None, 84)
    save_webp(source, source.with_name(f"{source.stem}-mobile.webp"), 960, 82)

save_webp(ROOT / "src" / "assets" / "parliaments-hero.png",
          ROOT / "src" / "assets" / "parliaments-hero.webp", None, 84)
save_webp(ROOT / "src" / "assets" / "parliaments-hero.png",
          ROOT / "src" / "assets" / "parliaments-hero-mobile.webp", 960, 82)

# The logo is displayed at 420 CSS px or less. 840 px preserves a full 2x
# density on the largest placement while avoiding decoding a 2485 px bitmap.
save_webp(ROOT / "public" / "logo.png", ROOT / "public" / "logo.webp", 840, 92)

save_webp(ROOT / "src" / "assets" / "openEyes.png",
          ROOT / "src" / "assets" / "openEyes.webp", 64, 90)
save_webp(ROOT / "src" / "assets" / "closeEyes.png",
          ROOT / "src" / "assets" / "closeEyes.webp", 64, 90)

print("PERF-04 image variants generated.")
