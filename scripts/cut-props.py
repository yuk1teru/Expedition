# Cuts a sheet of separate props generated as one picture (trees, bushes, stones… on a transparent
# background) into pieces by their outlines and packs them into an atlas (docs/art/README.md).
# Usage: python scripts/cut-props.py <sheet.png> <atlas.png> <pieces.json> [preview.png]
# Each piece gets its rect in the atlas and its foot point: the middle of the grass base it stands
# on (the centre of the lowest part of the outline, raised by the depth of that base). Pieces are
# numbered row by row (by the top of the outline, then by x) — name them in the game's data.
# SCALE=0.65 packs the pieces smaller (the game draws them smaller than the sheet anyway).
# Needs Python 3 with Pillow and NumPy.

import json, os, sys
import numpy as np
from PIL import Image, ImageDraw
from collections import deque

src, out_png, out_json = sys.argv[1:4]
preview = sys.argv[4] if len(sys.argv) > 4 else None
im = Image.open(src).convert('RGBA'); A = np.array(im)
alpha = A[..., 3]
K = 3
m = alpha[::K, ::K] > 128
hh, ww = m.shape
lab = np.zeros((hh, ww), int); sizes = {}; n = 0
for y in range(hh):
    for x in range(ww):
        if m[y, x] and not lab[y, x]:
            n += 1; q = deque([(y, x)]); lab[y, x] = n; cnt = 0
            while q:
                cy, cx = q.popleft(); cnt += 1
                for dy in (-1, 0, 1):
                    for dx in (-1, 0, 1):
                        ny, nx = cy + dy, cx + dx
                        if 0 <= ny < hh and 0 <= nx < ww and m[ny, nx] and not lab[ny, nx]:
                            lab[ny, nx] = n; q.append((ny, nx))
            sizes[n] = cnt
# Full size labels; the soft edge (alpha 1–128) goes to the nearest piece.
full = np.kron(lab, np.ones((K, K), int))[:alpha.shape[0], :alpha.shape[1]]
full[alpha == 0] = 0
for _ in range(4):
    grow = full.copy()
    for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1)):
        sh = np.roll(np.roll(full, dy, 0), dx, 1)
        take = (grow == 0) & (sh > 0) & (alpha > 0)
        grow[take] = sh[take]
    full = grow
# Crumbs (a lone leaf) are dropped.
ids = [i for i, c in sizes.items() if c * K * K >= 1500]
pieces = []
for i in ids:
    ys, xs = np.nonzero(full == i)
    x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    cut = A[y0:y1, x0:x1].copy()
    cut[full[y0:y1, x0:x1] != i] = 0
    mask = cut[..., 3] > 128
    h = y1 - y0
    base = mask[int(h * 0.85):]
    cols = np.nonzero(base.any(axis=0))[0]
    base_w = cols.max() - cols.min() + 1
    ax = float(np.nonzero(base)[1].mean())
    bottom = int(np.nonzero(mask.any(axis=1))[0].max()) + 1
    ay = bottom - base_w * 0.17
    pieces.append({'img': Image.fromarray(cut), 'top': int(y0), 'x': int(x0), 'w': int(x1 - x0), 'h': int(h), 'anchor': [round(ax), round(ay)]})
# Row by row: pieces whose tops are within 60 px are one row.
pieces.sort(key=lambda p: (p['top'], p['x']))
rows = []
for p in pieces:
    if rows and abs(p['top'] - rows[-1][0]['top']) < 60: rows[-1].append(p)
    else: rows.append([p])
pieces = [p for r in rows for p in sorted(r, key=lambda p: p['x'])]
scale = float(os.environ.get('SCALE', '1'))
if scale != 1:
    for p in pieces:
        p['w'], p['h'] = round(p['w'] * scale), round(p['h'] * scale)
        p['img'] = p['img'].resize((p['w'], p['h']), Image.LANCZOS)
        p['anchor'] = [round(v * scale) for v in p['anchor']]
# Shelf packing, 2 px apart.
W = 2048; x = y = shelf = 0; PAD = 2
for p in pieces:
    if x + p['w'] > W: x = 0; y += shelf + PAD; shelf = 0
    p['at'] = [x, y]; x += p['w'] + PAD; shelf = max(shelf, p['h'])
atlas = Image.new('RGBA', (W, y + shelf))
for p in pieces: atlas.paste(p['img'], tuple(p['at']))
atlas.save(out_png, optimize=True)
json.dump([{'rect': [*p['at'], p['w'], p['h']], 'anchor': p['anchor']} for p in pieces], open(out_json, 'w'))
for k, p in enumerate(pieces): print(k, 'sheet', p['x'], p['top'], 'size', p['w'], p['h'], 'anchor', p['anchor'])
if preview:
    pv = Image.new('RGBA', atlas.size, (255, 0, 255, 255)); pv.alpha_composite(atlas)
    d = ImageDraw.Draw(pv)
    for k, p in enumerate(pieces):
        ax, ay = p['at'][0] + p['anchor'][0], p['at'][1] + p['anchor'][1]
        d.ellipse([ax - 5, ay - 5, ax + 5, ay + 5], outline=(0, 255, 255, 255), width=2)
        d.text((p['at'][0] + 4, p['at'][1] + 4), str(k), fill=(255, 255, 0, 255))
    pv.convert('RGB').save(preview)
