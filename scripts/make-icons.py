"""Builds every app icon from build/logo.webp (needs Pillow: pip install pillow).

  python scripts/make-icons.py

Writes build/icon.png (desktop: electron-builder turns it into .ico / .icns),
public/icon.png (browser tab) and the Android launcher icons.
"""
from pathlib import Path
from PIL import Image, ImageChops, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
RES = ROOT / "android/app/src/main/res"
SS = 4  # supersampling for a smooth edge

src = Image.open(ROOT / "build/logo.webp").convert("RGB")

# The drawing sits on white, slightly off-centre. Find its centre and the smallest circle around it.
ink = ImageChops.difference(src, Image.new("RGB", src.size, "white")).convert("L").point(lambda p: 255 if p > 24 else 0)
l, t, r, b = ink.getbbox()
cx, cy = (l + r) / 2, (t + b) / 2
px = ink.load()
radius = max(
    ((x - cx) ** 2 + (y - cy) ** 2) ** 0.5
    for y in range(t, b, 2) for x in range(l, r, 2) if px[x, y]
) + 6


def disc(size: int, fill: float = 1.0) -> Image.Image:
    """The logo on a white disc, transparent outside; the disc spans `fill` of the canvas."""
    big = size * SS
    scale = big * fill / (2 * radius)
    art = src.resize((round(src.width * scale), round(src.height * scale)), Image.LANCZOS)
    canvas = Image.new("RGB", (big, big), "white")
    canvas.paste(art, (round(big / 2 - cx * scale), round(big / 2 - cy * scale)))
    mask = Image.new("L", (big, big), 0)
    d = big * fill
    ImageDraw.Draw(mask).ellipse([(big - d) / 2, (big - d) / 2, (big + d) / 2 - 1, (big + d) / 2 - 1], fill=255)
    canvas.putalpha(mask)
    return canvas.resize((size, size), Image.LANCZOS)


def save(img: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, optimize=True)
    print(path.relative_to(ROOT), img.size)


save(disc(1024, 0.94), ROOT / "build/icon.png")
save(disc(256), ROOT / "public/icon.png")

for density, px_per_dp in {"mdpi": 1, "hdpi": 1.5, "xhdpi": 2, "xxhdpi": 3, "xxxhdpi": 4}.items():
    folder = RES / f"mipmap-{density}"
    legacy = disc(round(48 * px_per_dp))
    save(legacy, folder / "ic_launcher.png")
    save(legacy, folder / "ic_launcher_round.png")
    # Adaptive icon: 108 dp canvas of which launchers show the middle 72 dp (66 dp is always safe).
    # The white background colour fills the rest.
    save(disc(round(108 * px_per_dp), 66 / 108), folder / "ic_launcher_foreground.png")
