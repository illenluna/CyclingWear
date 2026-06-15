"""Gera favicon.png 64x64 — monograma "CW" branco em círculo preto."""
from PIL import Image, ImageDraw, ImageFont

SIZE = 64
img = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
d = ImageDraw.Draw(img)

# Círculo preto
d.ellipse([0, 0, SIZE - 1, SIZE - 1], fill=(17, 17, 17, 255))

# Fonte bold do sistema
FONT_CANDIDATES = [
    "/System/Library/Fonts/SFNSDisplay-Bold.otf",
    "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
    "/System/Library/Fonts/HelveticaNeue.ttc",
    "/Library/Fonts/Arial Bold.ttf",
]
font = None
for path in FONT_CANDIDATES:
    try:
        font = ImageFont.truetype(path, 26)
        break
    except Exception:
        continue
if font is None:
    font = ImageFont.load_default()

text = "CW"
bbox = d.textbbox((0, 0), text, font=font)
tw = bbox[2] - bbox[0]
th = bbox[3] - bbox[1]
x = (SIZE - tw) / 2 - bbox[0]
y = (SIZE - th) / 2 - bbox[1]
d.text((x, y), text, font=font, fill=(255, 255, 255, 255))

out = "/Users/illenluna/Inventário/public/favicon.png"
img.save(out, "PNG")
print(f"Salvo em {out}")
