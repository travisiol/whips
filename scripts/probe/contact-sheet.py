import json, os, sys
from PIL import Image, ImageDraw
root = r"C:\Users\wowo2\Documents\GitHub\whips"
photos = json.load(open(os.path.join(root, "src", "data", "photos.json"), encoding="utf-8"))
src_dir = sys.argv[1] if len(sys.argv) > 1 else "raw"
out = sys.argv[2] if len(sys.argv) > 2 else r"C:\Users\wowo2\AppData\Local\Temp\claude\C--Users-wowo2-Documents-GitHub-dustland\d381df4e-4a46-45ef-bc26-e2c691a4b06a\scratchpad\contact.png"
cols, tw, th = 6, 300, 190
rows = (len(photos) + cols - 1) // cols
sheet = Image.new("RGB", (cols * tw, rows * th), (16, 16, 20))
draw = ImageDraw.Draw(sheet)
missing = []
for i, p in enumerate(photos):
    ext = "jpg" if src_dir == "raw" else "png"
    path = os.path.join(root, "public", "cars", src_dir, f"{p['slug']}.{ext}") if src_dir != "raw" else os.path.join(root, "public", "cars", "raw", f"{p['slug']}.jpg")
    try:
        im = Image.open(path).convert("RGBA")
    except Exception as e:
        missing.append(p["slug"]); continue
    im.thumbnail((tw - 8, th - 28))
    x = (i % cols) * tw + (tw - im.width) // 2
    y = (i // cols) * th + 4
    sheet.paste(im, (x, y), im)
    draw.text(((i % cols) * tw + 6, (i // cols) * th + th - 22), f"{i+1} {p['slug']}", fill=(220, 220, 230))
sheet.save(out)
print("saved", out, sheet.size, "missing", missing)
