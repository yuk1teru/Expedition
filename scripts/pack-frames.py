# Cuts an animation sheet generated as one picture (a grid of figures on a transparent
# background) into frames: finds every figure by its outline, aligns them by the feet and the
# torso centre, packs them into a grid of equal cells at half size (docs/art/README.md).
# Usage: python scripts/pack-frames.py <sheet.png> <atlas.png> <atlas.json> <preview.png> [groups]
# Groups steady the body inside a cycle: "0-5:xy,6-7:x" moves frames 0–5 so the glowing sign on
# the chest stands at their mean point (x and y), frames 6–7 — along x only. The generator draws
# every frame a little off, and without this the body jitters while walking.
# The atlas has COLS columns (environment, default 6). Needs Python 3 with Pillow and NumPy.

import json, os, sys
import numpy as np
from PIL import Image, ImageDraw
from collections import deque
src, out_png, out_json, preview = sys.argv[1:5]
groups = []
if len(sys.argv) > 5:
    for g in sys.argv[5].split(','):
        rng, axes = g.split(':'); a, b = rng.split('-')
        groups.append((list(range(int(a), int(b) + 1)), axes))
im = Image.open(src).convert('RGBA'); A = np.array(im)
alpha = A[..., 3]
S = 3; m = alpha[::S, ::S] > 128; h, w = m.shape
lab = np.zeros((h, w), int); comps = []; n = 0
for y in range(h):
    for x in range(w):
        if m[y, x] and not lab[y, x]:
            n += 1; q = deque([(y, x)]); lab[y, x] = n; cnt = 0; ys = []
            while q:
                cy, cx = q.popleft(); cnt += 1; ys.append(cy)
                for dy in (-1, 0, 1):
                    for dx in (-1, 0, 1):
                        ny, nx = cy + dy, cx + dx
                        if 0 <= ny < h and 0 <= nx < w and m[ny, nx] and not lab[ny, nx]:
                            lab[ny, nx] = n; q.append((ny, nx))
            if cnt > 150: comps.append(n)
# full-res mask per component: nearest upsample of the label map, dilated by one low-res pixel
up = np.kron(lab, np.ones((S, S), int))[:A.shape[0], :A.shape[1]]
frames = []
for c in comps:
    mk = up == c
    d = mk.copy()
    for sh in range(1, S + 2):
        d[sh:, :] |= mk[:-sh, :]; d[:-sh, :] |= mk[sh:, :]; d[:, sh:] |= mk[:, :-sh]; d[:, :-sh] |= mk[:, sh:]
    keep = d & (alpha > 0)
    ys, xs = np.nonzero(keep & (alpha > 128))
    y0, y1, x0, x1 = ys.min(), ys.max(), xs.min(), xs.max()
    hgt = y1 - y0
    band = (ys > y0 + 0.3 * hgt) & (ys < y0 + 0.6 * hgt)
    ax = int(np.median(xs[band])); ay = int(y1)
    frames.append({'keep': keep, 'box': (int(x0), int(y0), int(x1), int(y1)), 'anchor': (ax, ay), 'cy': (y0 + y1) / 2})
# order: rows by the foot line, then x
frames.sort(key=lambda f: (round(f['box'][3] / 340), f['box'][0]))

def sign_point(f):
    """Centre of the glowing sign on the chest (pale gold, bright), relative to the anchor."""
    r, g, b, a = (A[..., k].astype(int) for k in range(4))
    m = f['keep'] & (a > 200) & (r > 225) & (g > 205) & (b > 120) & (b < 230)
    ys, xs = np.nonzero(m)
    if len(xs) < 20: return None
    return xs.mean() - f['anchor'][0], ys.mean() - f['anchor'][1]

for idx, axes in groups:
    pts = {i: sign_point(frames[i]) for i in idx}
    known = [p for p in pts.values() if p]
    mx = sum(p[0] for p in known) / len(known); my = sum(p[1] for p in known) / len(known)
    for i, p in pts.items():
        if not p: continue
        ax, ay = frames[i]['anchor']
        dx = round(p[0] - mx) if 'x' in axes else 0
        dy = round(p[1] - my) if 'y' in axes else 0
        frames[i]['anchor'] = (ax + dx, ay + dy)
        print('steady', i, 'shift', -dx, -dy)
L = max(f['anchor'][0] - f['box'][0] for f in frames) + 6
R = max(f['box'][2] - f['anchor'][0] for f in frames) + 6
U = max(f['anchor'][1] - f['box'][1] for f in frames) + 6
D = 6
cw, ch = L + R, U + D
SCALE = 0.5
cwS, chS = int(round(cw * SCALE)), int(round(ch * SCALE))
COLS = int(os.environ.get('COLS', '6')); ROWS = (len(frames) + COLS - 1) // COLS
atlas = Image.new('RGBA', (cwS * COLS, chS * ROWS))
prev = Image.new('RGBA', (cw * COLS, ch * ROWS), (70, 90, 60, 255)); pd = ImageDraw.Draw(prev)
for i, f in enumerate(frames):
    x0, y0, x1, y1 = f['box']; ax, ay = f['anchor']
    pad = 8
    cx0, cy0 = max(0, x0 - pad), max(0, y0 - pad)
    crop = A[cy0:y1 + pad, cx0:x1 + pad].copy()
    crop[..., 3] = np.where(f['keep'][cy0:y1 + pad, cx0:x1 + pad], crop[..., 3], 0)
    cimg = Image.fromarray(crop)
    cell = Image.new('RGBA', (cw, ch)); cell.alpha_composite(cimg, (L - (ax - cx0), U - (ay - cy0)))
    col, row = i % COLS, i // COLS
    atlas.alpha_composite(cell.resize((cwS, chS), Image.LANCZOS), (col * cwS, row * chS))
    prev.alpha_composite(cell, (col * cw, row * ch))
    pd.line([(col * cw, row * ch + U), (col * cw + cw, row * ch + U)], fill=(255, 255, 0, 255))
    pd.line([(col * cw + L, row * ch), (col * cw + L, row * ch + ch)], fill=(0, 255, 255, 255))
    pd.text((col * cw + 4, row * ch + 4), str(i), fill=(255, 255, 255, 255))
atlas.save(out_png, optimize=True)
prev.convert('RGB').resize((cw * COLS // 2, ch * ROWS // 2)).save(preview)
json.dump({'cell': [cwS, chS], 'anchor': [round(L * SCALE), round(U * SCALE)], 'frameHeight': round(sum(f['box'][3] - f['box'][1] for f in frames[:6]) / 6 * SCALE)}, open(out_json, 'w'))
print('cells', cw, ch, '->', cwS, chS, 'anchor', L, U)
print(json.load(open(out_json)))
