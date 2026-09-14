"""
Detours the raw Commons photos (public/cars/raw/<slug>.jpg) into transparent
cutouts (public/cars/<slug>.png) so the real cars sit in the showroom.
Background removal by rembg (u2net, runs on CPU); the result is cropped to
the car with a small margin and resized to 1400 px wide.

    python scripts/cutout-photos.py            all cars without a cutout yet
    python scripts/cutout-photos.py f40 r34    redo these slugs
"""
import io, json, os, sys
from PIL import Image, ImageFilter
from rembg import remove, new_session

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, "public", "cars", "raw")
OUT = os.path.join(ROOT, "public", "cars")
photos = json.load(open(os.path.join(ROOT, "src", "data", "photos.json"), encoding="utf-8"))
only = set(sys.argv[1:])
session = new_session("u2net")
MAX_W = 1400

for p in photos:
    slug = p["slug"]
    dst = os.path.join(OUT, f"{slug}.png")
    if only and slug not in only:
        continue
    if not only and (os.path.exists(dst) or os.path.exists(os.path.join(OUT, f"{slug}.webp"))):
        continue
    src = os.path.join(RAW, f"{slug}.jpg")
    if not os.path.exists(src):
        print("missing raw", slug); continue
    im = Image.open(src).convert("RGB")
    # Work at a sane size: the matting model sees 320 px anyway, the output alpha is upsampled.
    if im.width > 1800:
        im = im.resize((1800, round(im.height * 1800 / im.width)), Image.LANCZOS)
    cut = remove(im, session=session, alpha_matting=True, alpha_matting_foreground_threshold=240, alpha_matting_background_threshold=10, alpha_matting_erode_size=8)
    alpha = cut.getchannel("A")
    bbox = alpha.point(lambda a: 255 if a > 24 else 0).getbbox()
    if not bbox:
        print("no subject", slug); continue
    x0, y0, x1, y1 = bbox
    mx, my = int((x1 - x0) * 0.04), int((y1 - y0) * 0.06)
    cut = cut.crop((max(0, x0 - mx), max(0, y0 - my), min(cut.width, x1 + mx), min(cut.height, y1 + my)))
    if cut.width > MAX_W:
        cut = cut.resize((MAX_W, round(cut.height * MAX_W / cut.width)), Image.LANCZOS)
    cut.save(dst, optimize=True)
    print(f"ok {slug} {cut.width}x{cut.height} ({os.path.getsize(dst) // 1024} kB)")
