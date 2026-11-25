#!/usr/bin/env python3
"""Layout guides for the two overhead frames (the avenue crossing 3.2 and the yard maze 5.1).

    python3 tools/topguides.py tools/guides     writes guide_road.png, guide_cars.png, guide_yard.png

The game cuts the painted pictures up by the rectangles listed here (art/manifest.json "top"), so the
numbers in ROAD, CARS and YARD are the single place the layout lives. All are 1360 x 768.
"""
import sys, os, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from guide import png

W, H = 1360, 768
GREEN = (0, 255, 0)
# the avenue: 27.2 units wide at 50 px a unit. Pavement 0-3, six lanes of 3.2, pavement to the right. Lane 5 (index 4) is the tram track.
CARS = {'car_red': [600, 60, 144, 192, (200, 48, 44)], 'car_blue': [800, 60, 144, 192, (63, 127, 208)], 'car_white': [1000, 60, 144, 192, (232, 226, 208)],
        'car_purple': [1200, 60, 144, 192, (138, 90, 192)], 'truck': [330, 60, 144, 416, (224, 154, 31)], 'tram': [80, 24, 144, 720, (127, 184, 168)]}
YARD = {'long0': [40, 40, 390, 130, (168, 64, 47)], 'long1': [470, 40, 390, 130, (47, 95, 147)], 'long2': [900, 40, 390, 130, (63, 122, 82)],
        'long3': [40, 220, 390, 130, (201, 122, 36)], 'long4': [470, 220, 390, 130, (61, 138, 138)], 'long5': [900, 220, 390, 130, (107, 111, 122)],
        'short0': [40, 400, 260, 130, (140, 47, 58)], 'short1': [340, 400, 260, 130, (184, 154, 46)], 'short2': [640, 400, 260, 130, (47, 95, 147)], 'short3': [940, 400, 260, 130, (63, 122, 82)],
        'crate0': [40, 590, 130, 130, (122, 90, 52)], 'crate1': [210, 590, 130, 130, (150, 110, 60)],
        'milo': [480, 580, 150, 150, (242, 178, 28)], 'man': [720, 580, 150, 150, (226, 104, 28)]}

# things the game sets down in the side-on frames (art/props.png): each is cut out by its rectangle
PROPS = {'package': [40, 60, 180, 150, (150, 100, 50)], 'case': [260, 60, 200, 150, (150, 155, 165)], 'box': [500, 50, 170, 170, (200, 160, 110)], 'pot': [710, 60, 140, 160, (190, 90, 50)],
         'crate': [890, 40, 200, 200, (120, 70, 30)], 'barrel': [1130, 30, 160, 220, (40, 90, 160)], 'dumpster': [40, 290, 380, 200, (0, 130, 130)], 'pallets': [460, 300, 260, 190, (170, 130, 80)],
         'gust1': [760, 300, 560, 90, (255, 255, 255)], 'gust2': [760, 410, 560, 80, (255, 255, 255)], 'landing': [40, 560, 600, 150, (140, 70, 40)], 'catwalk': [700, 560, 600, 150, (240, 200, 0)]}
# the overhead runners (art/top_run.png): four steps of Milo's run and four of a dock worker's, seen from straight above, heading right
RUN = {**{'milo%d' % i: [60 + 320 * i, 80, 240, 240, (242, 178, 28)] for i in range(4)}, **{'man%d' % i: [60 + 320 * i, 440, 240, 240, (226, 104, 28)] for i in range(4)}}


def sheet(rects, round_=()):
    px = bytearray(GREEN * (W * H))
    for name, (x, y, w, h, c) in rects.items():
        for yy in range(y, y + h):
            if name in round_:
                d = (w / 2) ** 2 - (yy - y - h / 2) ** 2; a = int(x + w / 2 - d ** .5); b = int(x + w / 2 + d ** .5)
            else: a, b = x, x + w
            px[(yy * W + a) * 3:(yy * W + b) * 3] = bytes(c) * (b - a)
    return px


def road():
    k = 50; px = bytearray((35, 38, 58) * (W * H))
    def col(x0, x1, c):
        for y in range(H): px[(y * W + x0) * 3:(y * W + x1) * 3] = bytes(c) * (x1 - x0)
    col(0, 3 * k, (150, 150, 158)); col(int(22.2 * k), W, (150, 150, 158))
    for i in range(1, 6): col(int((3 + i * 3.2) * k) - 3, int((3 + i * 3.2) * k) + 3, (255, 255, 255))
    for u in (.25, .75): col(int((3 + (4 + u) * 3.2) * k) - 4, int((3 + (4 + u) * 3.2) * k) + 4, (0, 220, 230))
    return px


if __name__ == '__main__':
    out = sys.argv[1] if len(sys.argv) > 1 else '.'
    png(os.path.join(out, 'guide_road.png'), W, H, road())
    png(os.path.join(out, 'guide_cars.png'), W, H, sheet(CARS))
    png(os.path.join(out, 'guide_yard.png'), W, H, sheet(YARD, ('milo', 'man')))
    png(os.path.join(out, 'guide_props.png'), W, H, sheet(PROPS)); png(os.path.join(out, 'guide_run.png'), W, H, sheet(RUN, tuple(RUN)))
    json.dump({'props': {k: v[:4] for k, v in PROPS.items()}, 'run': {k: v[:4] for k, v in RUN.items()}}, open(os.path.join(out, 'rects2.json'), 'w'))
    print(json.dumps({'cars': {k: v[:4] for k, v in CARS.items()}, 'yard': {k: v[:4] for k, v in YARD.items()}}))
