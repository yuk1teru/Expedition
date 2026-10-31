# Cuts an effects sheet (docs/art/fx/) into frames along a plain grid — effects are clouds of
# separate bits (leaves, sparks), so they are not cut by outlines like figures. Every frame of a
# row keeps the same cell, so the frames of one effect line up; the atlas keeps the sheet's layout.
# Usage: python scripts/cut-grid.py <sheet.png> <atlas.png> <frames.json> <row cuts> <column cuts>
# Cuts are sheet px, e.g. "0,450,860,1254" "0,418,836,1254" (the emptiest lines between rows).
# SCALE=0.5 (default) packs at half size. Pixels nearly transparent (alpha < CLEAR, default 12) are
# cleared first: background removal leaves them with stray colours that would bleed into the edges
# when shrunk; a sheet with a dull haze around its glows wants more (CLEAR=40).
# Needs Python 3 with Pillow and NumPy.

import json, os, sys
import numpy as np
from PIL import Image

src, out_png, out_json, rows, cols = sys.argv[1:6]
rows = [int(v) for v in rows.split(',')]
cols = [int(v) for v in cols.split(',')]
scale = float(os.environ.get('SCALE', '0.5'))
A = np.array(Image.open(src).convert('RGBA'))
A[A[..., 3] < int(os.environ.get('CLEAR', '12'))] = 0
im = Image.fromarray(A)
W = round(im.width * scale)
H = round(im.height * scale)
atlas = im.resize((W, H), Image.LANCZOS)
atlas.save(out_png, optimize=True)
frames = []
for r in range(len(rows) - 1):
    for c in range(len(cols) - 1):
        x0, x1 = round(cols[c] * scale), round(cols[c + 1] * scale)
        y0, y1 = round(rows[r] * scale), round(rows[r + 1] * scale)
        frames.append([x0, y0, x1 - x0, y1 - y0])
json.dump(frames, open(out_json, 'w'))
print(json.dumps(frames))
