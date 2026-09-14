"""
Packs the cutouts for the web: public/cars/<slug>.webp (1200 px wide, alpha)
for the site, public/cars/png/<slug>.png (900 px) for the token-logo route
and any client without WebP. Run after scripts/cutout-photos.py.
"""
import json, os
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CARS = os.path.join(ROOT, "public", "cars")
PNG = os.path.join(CARS, "png")
os.makedirs(PNG, exist_ok=True)
photos = json.load(open(os.path.join(ROOT, "src", "data", "photos.json"), encoding="utf-8"))
total_webp = 0
for p in photos:
    slug = p["slug"]
    src = os.path.join(CARS, f"{slug}.png")
    if not os.path.exists(src):
        print("missing cutout", slug); continue
    im = Image.open(src).convert("RGBA")
    web = im if im.width <= 1200 else im.resize((1200, round(im.height * 1200 / im.width)), Image.LANCZOS)
    web.save(os.path.join(CARS, f"{slug}.webp"), "WEBP", quality=84, method=6)
    small = im if im.width <= 900 else im.resize((900, round(im.height * 900 / im.width)), Image.LANCZOS)
    small.save(os.path.join(PNG, f"{slug}.png"), optimize=True)
    os.remove(src)
    total_webp += os.path.getsize(os.path.join(CARS, f"{slug}.webp"))
print(f"packed {len(photos)} cars, webp total {total_webp // 1024} kB")
