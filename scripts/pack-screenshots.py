# Packages the device captures two ways. Native 1080x2340 looks best and is
# what Play usually accepts; the 9:16 set is the fallback if the Console
# rejects the taller ratio. Padding colour is sampled from each shot, so the
# light-theme capture does not get dark bars.
from PIL import Image
import os, shutil

SRC = os.environ['SHOT']
SHOTS = [
    ('s1-feed.png',      '01-feed-vi-dark'),
    ('s2-filter.png',    '02-language-filter-vi-dark'),
    ('s3-detail.png',    '03-repo-detail-vi-dark'),
    ('s4-light.png',     '04-feed-vi-light'),
    ('s5-en.png',        '05-feed-en-dark'),
    ('s6-en-detail.png', '06-repo-detail-en-dark'),
]

for src, name in SHOTS:
    im = Image.open(os.path.join(SRC, src)).convert('RGB')
    shutil.copyfile(os.path.join(SRC, src), f'play/screenshots/native/{name}.png')

    pad = im.getpixel((4, im.height // 2))          # side gutter colour
    h = 1920
    w = round(im.width * h / im.height)
    canvas = Image.new('RGB', (1080, h), pad)
    canvas.paste(im.resize((w, h), Image.LANCZOS), ((1080 - w) // 2, 0))
    canvas.save(f'play/screenshots/9x16/{name}.png')
    print(f'{name}: native {im.size} + 9x16 (inner {w}x{h}, pad {pad})')
