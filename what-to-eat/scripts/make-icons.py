# Draws the What to eat? app icon set from brand tokens and the Fredoka font.
# Run: python3 scripts/make-icons.py node_modules/@expo-google-fonts/fredoka/700Bold/Fredoka_700Bold.ttf assets/images
import sys
from PIL import Image, ImageDraw, ImageFont

FONT = sys.argv[1]
OUT = sys.argv[2]
CREAM, INK = (255, 244, 220), (43, 27, 61)
SUNNY, TOMATO_D, GRAPE, MINT_D = (255, 201, 60), (171, 52, 41), (123, 77, 255), (11, 95, 73)

def word(text, size, color, angle):
    f = ImageFont.truetype(FONT, size)
    l, t, r, b = f.getbbox(text)
    im = Image.new('RGBA', (r - l + 40, b - t + 40), (0, 0, 0, 0))
    ImageDraw.Draw(im).text((20 - l, 20 - t), text, font=f, fill=color)
    return im.rotate(angle, resample=Image.BICUBIC, expand=True)

def tile(size, mono=None):
    """The tilted sunny tile with the crooked wordmark, on transparent."""
    S = size
    im = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    t = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(t)
    pad, rad, bw = int(S * 0.06), int(S * 0.2), int(S * 0.035)
    fill = mono or SUNNY
    d.rounded_rectangle([pad, pad, S - pad, S - pad], radius=rad, fill=mono or INK)
    if not mono:
        d.rounded_rectangle([pad + bw, pad + bw, S - pad - bw, S - pad - bw], radius=rad - bw, fill=fill)
    t = t.rotate(6, resample=Image.BICUBIC)
    im.alpha_composite(t)
    c = (lambda col: mono and (0, 0, 0, 0) or col)
    words = [
        ('What', int(S * 0.21), TOMATO_D, 7, (0.14, 0.20)),
        ('to', int(S * 0.13), GRAPE, -6, (0.68, 0.19)),
        ('eat?', int(S * 0.29), MINT_D, 3, (0.24, 0.44)),
    ]
    for text, sz, col, ang, (x, y) in words:
        w = word(text, sz, col if not mono else (0, 0, 0, 255), ang)
        if mono:
            # Cut the letters out of the solid tile.
            mask = w.split()[3]
            hole = Image.new('RGBA', w.size, (0, 0, 0, 0))
            im.paste(hole, (int(S * x), int(S * y)), mask)
        else:
            im.alpha_composite(w, (int(S * x), int(S * y)))
    return im

def on(bg, content, scale):
    S = bg.size[0]
    c = content.resize((int(S * scale), int(S * scale)), Image.LANCZOS)
    o = (S - c.size[0]) // 2
    bg.alpha_composite(c, (o, o))
    return bg

full = tile(1024)
icon = on(Image.new('RGBA', (1024, 1024), CREAM + (255,)), full, 0.92)
icon.convert('RGB').save(f'{OUT}/icon.png')
# Android adaptive: keep the art inside the middle ~66% safe zone.
on(Image.new('RGBA', (1024, 1024), (0, 0, 0, 0)), full, 0.66).save(f'{OUT}/android-icon-foreground.png')
Image.new('RGB', (1024, 1024), CREAM).save(f'{OUT}/android-icon-background.png')
on(Image.new('RGBA', (1024, 1024), (0, 0, 0, 0)), tile(1024, mono=(255, 255, 255, 255)), 0.66).save(f'{OUT}/android-icon-monochrome.png')
on(Image.new('RGBA', (1024, 1024), (0, 0, 0, 0)), full, 1.0).save(f'{OUT}/splash-icon.png')
icon.convert('RGB').resize((48, 48), Image.LANCZOS).save(f'{OUT}/favicon.png')
print('ok')
