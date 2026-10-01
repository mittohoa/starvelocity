# Renders the Play Store assets from the same geometry as
# android/app/src/main/res/drawable/ic_launcher_foreground.xml, so the store
# icon cannot drift from the launcher icon.
from PIL import Image, ImageDraw, ImageFont
import os

ACCENT = (0xCF, 0x20, 0x70)
DARK   = (0x0D, 0x11, 0x17)
WHITE  = (0xFF, 0xFF, 0xFF)

SPARK = [
    (67, 26),
    ((69.2, 39.8), (73.2, 43.8), (87, 46)),
    ((73.2, 48.2), (69.2, 52.2), (67, 66)),
    ((64.8, 52.2), (60.8, 48.2), (47, 46)),
    ((60.8, 43.8), (64.8, 39.8), (67, 26)),
]
TRAILS = [((29, 74), (47, 56), 9, 1.00),
          ((25, 55), (33, 47), 7, 0.75),
          ((45, 85), (51, 79), 6, 0.55)]

def bezier(p0, c1, c2, p3, n=120):
    out = []
    for i in range(n + 1):
        t = i / n
        u = 1 - t
        out.append((
            u*u*u*p0[0] + 3*u*u*t*c1[0] + 3*u*t*t*c2[0] + t*t*t*p3[0],
            u*u*u*p0[1] + 3*u*u*t*c1[1] + 3*u*t*t*c2[1] + t*t*t*p3[1],
        ))
    return out

def draw_mark(img, ox, oy, scale):
    """Draw the mark with the 108-unit viewport mapped to `scale` px per unit."""
    T = lambda p: (ox + p[0]*scale, oy + p[1]*scale)
    pts, cur = [], SPARK[0]
    for c1, c2, p in SPARK[1:]:
        pts += bezier(cur, c1, c2, p)[1:]
        cur = p
    ImageDraw.Draw(img).polygon([T(p) for p in pts], fill=WHITE)
    for a, b, w, alpha in TRAILS:
        layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
        d = ImageDraw.Draw(layer)
        px = w * scale
        col = WHITE + (int(alpha * 255),)
        d.line([T(a), T(b)], fill=col, width=int(round(px)))
        for end in (a, b):  # round caps
            cx, cy = T(end); r = px / 2
            d.ellipse([cx-r, cy-r, cx+r, cy+r], fill=col)
        img.alpha_composite(layer)

SS = 4
per_unit = (512 / 72) * SS
full = int(round(108 * per_unit))
icon = Image.new("RGBA", (full, full), ACCENT + (255,))
draw_mark(icon, 0, 0, per_unit)
# The store icon is not mask-clipped the way a launcher icon is, so frame the
# whole 108-unit canvas: the mark then sits with real margin instead of
# touching the edge the way the 72-unit launcher window makes it.
win = full
off = (full - win) // 2
icon = icon.crop((off, off, off + win, off + win)).resize((512, 512), Image.LANCZOS)
icon.convert("RGB").save("play/icon-512.png", "PNG")

def font(names, size):
    for n in names:
        p = os.path.join("C:/Windows/Fonts", n)
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()

fg = Image.new("RGBA", (2048, 1000), DARK + (255,))
mark_scale = 520 / 108
draw_mark(fg, 150, (1000 - 520) / 2, mark_scale)
d = ImageDraw.Draw(fg)
d.text((700, 350), "StarVelocity", font=font(["segoeuib.ttf", "arialbd.ttf"], 132), fill=WHITE)
d.text((706, 520), "Stars per day, not stars in total.",
       font=font(["consola.ttf", "cour.ttf"], 62), fill=ACCENT + (255,))
d.text((706, 610), "GitHub repositories ranked by how fast they are climbing.",
       font=font(["segoeui.ttf", "arial.ttf"], 50), fill=(0x9A, 0xA4, 0xB2, 255))
fg.resize((1024, 500), Image.LANCZOS).convert("RGB").save("play/feature-graphic-1024x500.png", "PNG")
print("wrote both")
