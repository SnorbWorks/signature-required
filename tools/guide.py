#!/usr/bin/env python3
"""Layout guides for action-frame backgrounds.

For one playable frame, draws a flat diagram at the exact shape of the picture the game
will use: where the floor is, where every platform top is, how tall a person is, how big
a door is. The diagram is attached to the image prompt so the art is drawn to scale, and
`place()` gives the same numbers for checking a finished picture.

    python3 tools/guide.py            writes guide_<frame>.png for every frame in SPECS
    python3 tools/guide.py P0.3 out/  one frame, into a folder

Scale: 1 game unit = half a metre. Milo is 3.5 units tall. A door is 4.2 x 1.9 units.
The floor line (where feet go) is GROUND units above the bottom of the frame.
"""
import sys, zlib, struct, os

GROUND, ZOOM = 1.25, 1.08
RATIOS = {'1:1': 1, '5:4': 1.25, '4:3': 4 / 3, '3:2': 1.5, '16:9': 16 / 9, '21:9': 21 / 9, '4:1': 4, '2:3': 2 / 3, '9:16': 9 / 16}
GREEN, FLOORC, BLOCK, EDGE, MAN, DOOR = (0, 255, 0), (150, 150, 158), (95, 95, 105), (30, 30, 36), (255, 0, 200), (0, 70, 255)

WALL, CEIL, WHITE, BROWN, CYAN, ORANGE, RED, YELLOW = (205, 190, 160), (60, 55, 70), (255, 255, 255), (120, 70, 30), (0, 220, 230), (255, 140, 0), (200, 30, 30), (240, 220, 0)

# frame: size in units, picture shape, what is solid.
#   floor: True = ground right across at height 0
#   blocks: [x0, x1, top, kind]  kind 'solid' = building (runs down out of the picture), 'box' = sits on the ground, 'deck' = thin slab
#   back / paint: flat coloured shapes [x0, x1, bottom, top, colour], drawn behind / in front of the floor and blocks      men: [x, top]  scale figures
# the image model draws doors about a quarter taller than their block, so door blocks are 3.7 units and come out near 4.4
TEAL, LGREY, DKWALL = (0, 150, 150), (200, 200, 212), (150, 95, 80)
BRICK = [-9, 99, .3, 30, DKWALL]      # a wall right across, standing just behind the floor line

SPECS = {
    # rooftops: three building tops against open sky (green = cut out, the far skyline shows through)
    'P0.2': dict(w=24.8, h=9.4, ratio='21:9', floor=False, men=[[3, 2.2]],
                 blocks=[[-6, 9.4, 2.2, 'solid'], [11, 16.6, 2.2, 'solid'], [18, 30, 3, 'solid']],
                 paint=[[5.4, 7.8, 2.2, 7.4, CYAN], [14.6, 15.7, 2.2, 4.1, RED], [20.2, 23.6, 3, 7.3, BROWN], [20.9, 22.8, 3, 6.7, DOOR]]),
    # the shop: made with the wall line .9 above the floor line; the picture is shown with zoom 1, lift .5 (see manifest)
    'P0.3': dict(w=14.2, h=9.4, ratio='3:2', floor=True, edge=.9, men=[[5.6, 0]],
                 back=[[-9, 99, .9, 7.3, WALL], [-9, 99, 7.3, 20, CEIL], [4.6, 9.4, 6.95, 7.25, WHITE]],
                 paint=[[.5, 2.4, .9, 5.1, DOOR], [3.2, 8.2, .9, 4.9, BROWN], [10.2, 11.9, 2.7, 4.9, BROWN], [12.3, 13.8, .9, 4.9, CYAN], [8.7, 9.9, 0, 1.9, BLOCK]]),
    # street with a raised loading platform along a warehouse wall
    'P0.4': dict(w=39.6, h=9.2, ratio='4:1', floor=True, men=[[2.6, 0], [21.5, 3]], back=[BRICK],
                 blocks=[[5.2, 7.2, 1, 'box'], [7.2, 9.4, 2, 'box'], [9.4, 24, 3, 'box'], [27.1, 45, 3, 'box']],
                 paint=[[1.4, 3.4, 2.4, 4.8, YELLOW], [11, 16, 3, 7.2, LGREY], [17.6, 19.5, 3, 6.7, DOOR], [34.4, 39.4, 3, 7.2, LGREY], [27.6, 29, 0, 1.1, BROWN], [29.6, 33, 0, 2.2, TEAL]]),
    # the alley
    'P0.5': dict(w=24.8, h=11.8, ratio='16:9', floor=True, men=[[8, 0]], back=[BRICK], blocks=[],
                 paint=[[.9, 1.9, .3, 1.9, RED], [2.1, 3.1, .3, 1.9, RED], [4.6, 6.5, .3, 4.5, DOOR], [10, 13.6, .3, 2.6, TEAL], [2, 3.7, 6.2, 8.6, YELLOW], [14.6, 16.3, 7.3, 9.7, YELLOW],
                        [13, 19.4, 6.3, 6.7, ORANGE], [18.4, 19, 2.8, 6.3, ORANGE], [21.6, 30, .3, 5.2, LGREY]]),
    # Harlow Street: house fronts, a crate and a loaded flatbed trailer to run along
    'R.2': dict(w=28.2, h=6.8, ratio='4:1', floor=True, men=[[4.9, 0]], back=[BRICK], blocks=[],
                paint=[[1.4, 4.2, .3, .9, BLOCK], [1.9, 3.8, .9, 4.6, DOOR], [9.6, 11.4, 3, 5.2, YELLOW], [13.6, 15.4, 3, 5.2, YELLOW], [17.6, 19.4, 3, 5.2, YELLOW], [21.8, 27.4, .3, 4.9, LGREY],
                       [6, 7.6, 0, .95, BROWN], [8.4, 20.6, 0, 1.9, (70, 70, 82)]]),
    # the Anchor's back lot
    'R.5': dict(w=24.8, h=8.8, ratio='21:9', floor=True, men=[[2.6, 0]], back=[BRICK], blocks=[],
                paint=[[.4, 3.6, .3, 2.6, TEAL], [9.9, 11.1, 3.6, 5.6, YELLOW], [21.2, 23.1, .3, 4.0, DOOR], [21.9, 22.4, 4.4, 4.8, WHITE],
                       [4.6, 6.4, 0, 1, BROWN], [7, 9.6, 0, 1.9, BROWN], [11.4, 14.4, 0, 1.9, BROWN], [16.2, 18.6, 0, 1.9, BROWN]]),
}


def place(w, h, iw, ih):
    """Returns f(x, y) -> picture pixel, for a point x units from the frame's left edge and y units above the floor line."""
    PW, PH = w * 1.025 + 1.25, h * 1.025 + 1.25                  # the near layer's sheet (see layerCtx in art.js, depth .5)
    upp = max(PW / iw, PH / ih) * ZOOM                          # units per picture pixel: the picture covers the sheet, pinned bottom-left
    return (lambda x, y: ((x + (PW - w) / 2) / upp, ih - (y + GROUND + (PH - h) / 2) / upp)), 1 / upp


def png(path, W, H, px):
    raw = b''.join(b'\0' + bytes(px[y * W * 3:(y + 1) * W * 3]) for y in range(H))
    ch = lambda t, d: struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    open(path, 'wb').write(b'\x89PNG\r\n\x1a\n' + ch(b'IHDR', struct.pack('>IIBBBBB', W, H, 8, 2, 0, 0, 0)) + ch(b'IDAT', zlib.compress(raw, 6)) + ch(b'IEND', b''))


def guide(fid, outdir='.'):
    s = SPECS[fid]; H = 768; W = int(round(H * RATIOS[s['ratio']] / 16) * 16)
    px = bytearray(GREEN * (W * H)); P, ppu = place(s['w'], s['h'], W, H)

    def rect(x0, y0, x1, y1, c):
        x0, x1, y0, y1 = max(0, int(round(x0))), min(W, int(round(x1))), max(0, int(round(y0))), min(H, int(round(y1)))
        if x1 <= x0: return
        row = bytes(c) * (x1 - x0)
        for y in range(y0, y1): px[(y * W + x0) * 3:(y * W + x1) * 3] = row

    def disc(cx, cy, r, c):
        for y in range(int(cy - r), int(cy + r) + 1):
            d = r * r - (y - cy) ** 2
            if d > 0: rect(cx - d ** .5, y, cx + d ** .5, y + 1, c)

    def box(x0, x1, top, bottom, c):   # in units
        (a, t), (b, u) = P(x0, top), P(x1, bottom); rect(a, t, b, u, c); rect(a, t, b, t + 4, EDGE); rect(a, t, a + 3, u, EDGE); rect(b - 3, t, b, u, EDGE)

    for x0, x1, y0, y1, c in s.get('back', []):                    # blockout: flat coloured shapes [x0, x1, bottom, top, colour], in units
        (l, t), (r, u) = P(x0, y1), P(x1, y0); rect(l, t, r, u, c)
    if s['floor']: box(-9, 99, s.get('edge', .3), -9, FLOORC)      # the floor runs back a little behind the feet line
    for x0, x1, top, kind in s.get('blocks', []):
        box(x0, x1, top, -9 if kind == 'solid' else top - .35 if kind == 'deck' else 0 if kind == 'box' else -.5, BLOCK if kind != 'box2' else (70, 70, 82))
    for x0, x1, y0, y1, c in s.get('paint', []):
        (l, t), (r, u) = P(x0, y1), P(x1, y0); rect(l, t, r, u, c); rect(l, t, r, t + 3, EDGE); rect(l, t, l + 3, u, EDGE); rect(r - 3, t, r, u, EDGE)
    for x, base in s.get('doors', []):
        (a, t), (b, u) = P(x, base + 4.2), P(x + 1.9, base)
        rect(a, t, b, t + 5, DOOR); rect(a, u - 5, b, u, DOOR); rect(a, t, a + 5, u, DOOR); rect(b - 5, t, b, u, DOOR)
    for x, top in s['men']:                                      # a person 3.5 units tall, feet on the given surface
        cx, fy = P(x, top); u = ppu
        disc(cx, fy - 3.2 * u, .3 * u, MAN); rect(cx - .42 * u, fy - 2.85 * u, cx + .42 * u, fy - 1.55 * u, MAN)
        rect(cx - .36 * u, fy - 1.55 * u, cx - .06 * u, fy, MAN); rect(cx + .06 * u, fy - 1.55 * u, cx + .36 * u, fy, MAN)
    path = os.path.join(outdir, 'guide_%s.png' % fid.replace('.', '_')); png(path, W, H, px)
    (l, t), (r, b) = P(0, s['h'] - GROUND), P(s['w'], -GROUND)
    print('%s  %dx%d  %.1f px per unit  frame shows x %d-%d, y %d-%d  floor line y %d' % (fid, W, H, ppu, l, r, t, b, P(0, 0)[1]))
    return path


if __name__ == '__main__':
    ids = [a for a in sys.argv[1:] if a in SPECS] or list(SPECS); out = next((a for a in sys.argv[1:] if a not in SPECS), '.')
    for i in ids: guide(i, out)
