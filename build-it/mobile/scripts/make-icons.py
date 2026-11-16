# Draws the Build It icon set from brand tokens and the Archivo Black font.
# Run: python3 scripts/make-icons.py node_modules/@expo-google-fonts/archivo/900Black/Archivo_900Black.ttf assets/images
import sys
from PIL import Image, ImageDraw, ImageFont

FONT, OUT = sys.argv[1], sys.argv[2]
PATINA, PALE, CONCRETE, GRAPHITE = (30, 91, 87), (200, 236, 229), (236, 238, 234), (27, 34, 38)


def mark(size, word_color, it_color, line_color, bg=None):
    """Build over It, with a dimension line under, centered on a square."""
    im = Image.new('RGBA', (size, size), bg or (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    f = ImageFont.truetype(FONT, int(size * 0.24))
    lines = [('Build', word_color), ('It', it_color)]
    boxes = [d.textbbox((0, 0), t, font=f) for t, _ in lines]
    lh = int(size * 0.22)
    total = lh * 2 + int(size * 0.09)
    y = (size - total) // 2
    for (t, col), (l, top, r, b) in zip(lines, boxes):
        d.text(((size - (r - l)) // 2 - l, y - top), t, font=f, fill=col)
        y += lh
    # Dimension line: a rule with end ticks, like a plan sheet.
    y += int(size * 0.05)
    w = int(size * 0.5)
    x0, x1, lw = (size - w) // 2, (size + w) // 2, max(2, size // 90)
    d.line([(x0, y), (x1, y)], fill=line_color, width=lw)
    for x in (x0, x1):
        d.line([(x, y - size * 0.03), (x, y + size * 0.03)], fill=line_color, width=lw)
    return im


mark(1024, CONCRETE, PALE, PALE, PATINA + (255,)).convert('RGB').save(f'{OUT}/icon.png')
# Android adaptive icon: the mark sits in the inner safe zone of a 1024 layer.
fg = Image.new('RGBA', (1024, 1024), (0, 0, 0, 0))
fg.alpha_composite(mark(660, CONCRETE, PALE, PALE), (182, 182))
fg.save(f'{OUT}/android-icon-foreground.png')
mono = Image.new('RGBA', (1024, 1024), (0, 0, 0, 0))
mono.alpha_composite(mark(660, (0, 0, 0, 255), (0, 0, 0, 255), (0, 0, 0, 255)), (182, 182))
mono.save(f'{OUT}/android-icon-monochrome.png')
mark(400, GRAPHITE, PATINA, PATINA).save(f'{OUT}/splash-icon.png')
mark(48, CONCRETE, PALE, PALE, PATINA + (255,)).save(f'{OUT}/favicon.png')
