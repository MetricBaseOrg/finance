"""Build every Bingkai brand asset from ONE geometry definition.

Run from apps/bingkai:  python brand/build_brand.py

WHY THIS EXISTS. The logo was generated as a 1254 px raster (brand/bingkai-logo-source.png)
on an off-white ground with soft, slightly noisy edges. That is fine as a concept and
wrong as an asset: it cannot sit on the app's #0a0a0a theme, it blurs at 16 px, and a
favicon, an apple-touch icon, manifest icons and a share card all traced separately
would drift apart. So the mark was MEASURED off the source (stroke widths from pixel
runs, the head circle from its chord, the shoulder radius from two insets) and is
defined once below as exact shapes. Everything is emitted from that.

Outputs:
  public/bingkai-mark.svg            gold mark, transparent, for anywhere on dark
  src/app/icon.svg                   favicon (Next.js file convention), mark on a dark tile
  src/app/favicon.ico                16/32/48, for clients that ignore SVG favicons
  src/app/apple-icon.png             180x180
  public/icon-192.png, icon-512.png  web app manifest
  src/app/opengraph-image.png        1200x630 share card
  src/app/twitter-image.png          same card

Needs Pillow, fontTools and brotli (the vendored Manrope is woff2).
"""
import io
import math
import os

from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(HERE)
GOLD = (0xC9, 0xA8, 0x4C)
INK = (0x0A, 0x0A, 0x0A)
GOLD_HEX, INK_HEX = "#C9A84C", "#0A0A0A"

# ------------------------------------------------------------------ the geometry
# Units are pixels of the 1254 px source, translated so the mark's top-left is (0, 0).
# Mark box: 460 wide, 475 tall.
W, H = 460, 475
T = 58                                   # frame stroke
RX0 = 399                                # inner edge of the right-hand bar
# The frame, as rectangles plus the two arms of the notch that forms the "B".
RECTS = [
    (0, 0, W, T),                        # top
    (0, 0, 61, H),                       # left
    (0, H - 57, W, H),                   # bottom
    (RX0, 0, W, 170),                    # right, above the notch
    (RX0, 319, W, H),                    # right, below the notch
]
POLYS = [
    # upper arm: the right bar folds in at 45 degrees to a flat tip
    [(RX0, 170), (W, 170), (396, 235), (337, 235)],
    # lower arm: from a flat tip back out to the right bar, 24 px below the upper one
    [(337, 260), (401, 260), (W, 319), (RX0, 319)],
]
HEAD = (230, 190, 70)                    # cx, cy, r
BODY = (114, 278, 342, 376, 68)          # x0, y0, x1, y1, top corner radius


def svg_shapes(fill):
    out = []
    for x0, y0, x1, y1 in RECTS:
        out.append(f'<rect x="{x0}" y="{y0}" width="{x1 - x0}" height="{y1 - y0}"/>')
    for poly in POLYS:
        pts = " ".join(f"{x},{y}" for x, y in poly)
        out.append(f'<polygon points="{pts}"/>')
    cx, cy, r = HEAD
    out.append(f'<circle cx="{cx}" cy="{cy}" r="{r}"/>')
    x0, y0, x1, y1, rr = BODY
    # flat bottom, rounded top corners only
    out.append(
        f'<path d="M{x0},{y1} L{x0},{y0 + rr} A{rr},{rr} 0 0 1 {x0 + rr},{y0} '
        f'L{x1 - rr},{y0} A{rr},{rr} 0 0 1 {x1},{y0 + rr} L{x1},{y1} Z"/>')
    return f'<g fill="{fill}" shape-rendering="geometricPrecision">' + "".join(out) + "</g>"


def draw_mark(img, ox, oy, s, colour):
    """Rasterise the mark onto img at offset (ox, oy) and scale s. Call on a
    supersampled canvas and downsample afterwards: PIL does not antialias shapes."""
    d = ImageDraw.Draw(img)
    for x0, y0, x1, y1 in RECTS:
        d.rectangle([ox + x0 * s, oy + y0 * s, ox + x1 * s - 1, oy + y1 * s - 1], fill=colour)
    for poly in POLYS:
        d.polygon([(ox + x * s, oy + y * s) for x, y in poly], fill=colour)
    cx, cy, r = HEAD
    d.ellipse([ox + (cx - r) * s, oy + (cy - r) * s, ox + (cx + r) * s, oy + (cy + r) * s],
              fill=colour)
    x0, y0, x1, y1, rr = BODY
    # Rounded top corners, square bottom, built from parts. A rounded_rectangle cannot do
    # it: the body is 98 tall with a 68 radius, and extending the box past the bottom to
    # hide the lower corners paints gold into the white gap above the frame's bottom bar.
    X = lambda v: ox + v * s
    Y = lambda v: oy + v * s
    d.rectangle([X(x0), Y(y0 + rr), X(x1), Y(y1)], fill=colour)
    d.rectangle([X(x0 + rr), Y(y0), X(x1 - rr), Y(y0 + rr)], fill=colour)
    d.pieslice([X(x0), Y(y0), X(x0 + 2 * rr), Y(y0 + 2 * rr)], 180, 270, fill=colour)
    d.pieslice([X(x1 - 2 * rr), Y(y0), X(x1), Y(y0 + 2 * rr)], 270, 360, fill=colour)
    return d


def tile(size, pad_frac=0.18):
    """The mark centred on a square dark tile. Square corners, per the brand."""
    SS = 4
    big = Image.new("RGB", (size * SS, size * SS), INK)
    inner = size * SS * (1 - 2 * pad_frac)
    s = inner / max(W, H)
    ox = (size * SS - W * s) / 2
    oy = (size * SS - H * s) / 2
    draw_mark(big, ox, oy, s, GOLD)
    return big.resize((size, size), Image.LANCZOS)


def manrope(px, weight=800):
    from fontTools.ttLib import TTFont
    f = TTFont(os.path.join(APP, "src", "fonts", "manrope-variable.woff2"))
    f.flavor = None
    try:
        from fontTools.varLib import instancer
        f = instancer.instantiateVariableFont(f, {"wght": weight})
    except Exception:
        pass
    buf = io.BytesIO(); f.save(buf); buf.seek(0)
    return ImageFont.truetype(buf, px)


def main():
    # ---- SVGs
    mark_svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" '
                f'role="img" aria-label="Bingkai">{svg_shapes(GOLD_HEX)}</svg>\n')
    open(os.path.join(APP, "public", "bingkai-mark.svg"), "w", encoding="utf-8").write(mark_svg)

    side = 640
    s = side * 0.64 / max(W, H)
    ox, oy = (side - W * s) / 2, (side - H * s) / 2
    icon_svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {side} {side}">'
                f'<rect width="{side}" height="{side}" fill="{INK_HEX}"/>'
                f'<g transform="translate({ox:.2f} {oy:.2f}) scale({s:.5f})">'
                f'{svg_shapes(GOLD_HEX)}</g></svg>\n')
    open(os.path.join(APP, "src", "app", "icon.svg"), "w", encoding="utf-8").write(icon_svg)

    # ---- rasters. Small sizes get LESS padding: at 16 px every pixel of mark counts.
    tile(180, 0.16).save(os.path.join(APP, "src", "app", "apple-icon.png"))
    tile(192, 0.16).save(os.path.join(APP, "public", "icon-192.png"))
    tile(512, 0.16).save(os.path.join(APP, "public", "icon-512.png"))
    # RGBA, not RGB. PIL stores each .ico size as an embedded PNG, and Next.js (Turbopack)
    # refuses to decode an icon whose PNG lacks an alpha channel: "The PNG is not in RGBA
    # format", which fails the whole production build.
    ico = [tile(n, 0.08 if n <= 32 else 0.12).convert("RGBA") for n in (16, 32, 48)]
    ico[-1].save(os.path.join(APP, "src", "app", "favicon.ico"),
                 sizes=[(16, 16), (32, 32), (48, 48)], append_images=ico[:-1])

    # ---- share card
    SS = 2
    cw, ch = 1200 * SS, 630 * SS
    card = Image.new("RGB", (cw, ch), INK)
    ms = 270 * SS / H
    draw_mark(card, 96 * SS, (ch - H * ms) / 2, ms, GOLD)
    d = ImageDraw.Draw(card)
    x = 96 * SS + W * ms + 64 * SS
    right = cw - 64 * SS
    title = manrope(104 * SS, 800)
    sub = manrope(32 * SS, 600)
    sub2 = manrope(30 * SS, 500)
    # tracked uppercase, as in the source wordmark
    word, cx_ = "BINGKAI", x
    for chr_ in word:
        d.text((cx_, 188 * SS), chr_, font=title, fill=GOLD)
        cx_ += title.getlength(chr_) + 12 * SS
    lines = [("Twibbon tanpa unggah, tanpa watermark.", sub, (0xE8, 0xE8, 0xE8), 340),
             ("Fotomu tetap di perangkatmu.", sub2, (0x8A, 0x8A, 0x8A), 392)]
    for text, font, colour, y in lines:
        # A share card is read at thumbnail size, so nothing may run off the edge.
        # The first draft clipped its second line at the right margin.
        assert x + font.getlength(text) <= right, "share card line too long: " + text
        d.text((x + 4 * SS, y * SS), text, font=font, fill=colour)
    d.rectangle([0, ch - 10 * SS, cw, ch], fill=GOLD)
    card = card.resize((1200, 630), Image.LANCZOS)
    card.save(os.path.join(APP, "src", "app", "opengraph-image.png"), optimize=True)
    card.save(os.path.join(APP, "src", "app", "twitter-image.png"), optimize=True)
    print("brand assets written")


if __name__ == "__main__":
    main()
