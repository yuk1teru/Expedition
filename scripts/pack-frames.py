# Cuts an animation sheet generated as one picture (a grid of figures on a transparent
# background) into frames: finds every figure by its outline, aligns them by the feet and the
# torso centre, packs them into a grid of equal cells at half size (docs/art/README.md; SCALE=1 keeps
# the full size — for a big figure drawn large, such as a biome's boss).
# Usage: python scripts/pack-frames.py <sheet.png> <atlas.png> <atlas.json> <preview.png> [groups]
# Groups steady the body inside a cycle: "0-5:xy,6-7:x" moves frames 0–5 so the glowing sign on
# the chest stands at their mean point (x and y), frames 6–7 — along x only. The generator draws
# every frame a little off, and without this the body jitters while walking. A number after y
# removes only that share of the vertical spread: "0-7:xy75" keeps a quarter of the bob.
# The atlas has COLS columns (environment, default 6). Needs Python 3 with Pillow and NumPy.
# When figures of neighbouring cells touch (a staff tip on the figure below), set GRID=<cols>x<rows>:
# the sheet is cut along the emptiest lines near the grid instead of by outlines.

import json, os, sys
import numpy as np
from PIL import Image, ImageDraw
from collections import deque
src, out_png, out_json, preview = sys.argv[1:5]
groups = []
if len(sys.argv) > 5:
    for g in sys.argv[5].split(','):
        rng, axes = g.split(':'); a, b = rng.split('-')
        share = 1.0
        if 'y' in axes and axes.split('y')[1]: share = int(axes.split('y')[1]) / 100
        groups.append((list(range(int(a), int(b) + 1)), axes, share))
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
GRID = os.environ.get('GRID')
if GRID:
    # Rows are cut along the emptiest lines near the grid; inside a row band every figure is an
    # outline of its own. A small piece cut off at a band edge (a staff tip that crossed the line)
    # goes back to the nearest figure of the neighbouring row it came from.
    gc, gr = (int(v) for v in GRID.lower().split('x'))
    solid = alpha > 40
    def cut(profile, n, size):
        out = [0]
        for k in range(1, n):
            c = int(k * size / n); w = int(size / n * 0.3)
            out.append(c - w + int(np.argmin(profile[c - w:c + w])))
        return out + [size]
    rows = cut(solid.sum(axis=1), gr, alpha.shape[0])
    def label(mask):
        hh, ww = mask.shape; lb = np.zeros((hh, ww), int); parts = []; n = 0
        for y in range(hh):
            for x in range(ww):
                if mask[y, x] and not lb[y, x]:
                    n += 1; q = deque([(y, x)]); lb[y, x] = n; cnt = 0; sx = sy = 0
                    while q:
                        cy, cx = q.popleft(); cnt += 1; sx += cx; sy += cy
                        for dy in (-1, 0, 1):
                            for dx in (-1, 0, 1):
                                ny, nx = cy + dy, cx + dx
                                if 0 <= ny < hh and 0 <= nx < ww and mask[ny, nx] and not lb[ny, nx]:
                                    lb[ny, nx] = n; q.append((ny, nx))
                    parts.append({'id': n, 'size': cnt, 'cx': sx / cnt, 'cy': sy / cnt})
        return lb, parts
    figs = []  # per row: list of (figure keep mask in full res)
    pieces = []  # small pieces: (row, touches 'top'/'bottom'/None, mask, cx)
    for r in range(gr):
        y0b, y1b = rows[r], rows[r + 1]
        low = solid[y0b:y1b:S, ::S]
        # Thin the outlines by one step first, so a tip that only touches a boot comes apart.
        er = low.copy()
        er[1:, :] &= low[:-1, :]; er[:-1, :] &= low[1:, :]; er[:, 1:] &= low[:, :-1]; er[:, :-1] &= low[:, 1:]
        lb, parts = label(er)
        parts.sort(key=lambda p: -p['size'])
        big = sorted(parts[:gc], key=lambda p: p['cx'])
        up = np.kron(lb, np.ones((S, S), int))[:y1b - y0b, :alpha.shape[1]]
        row_figs = []
        for p in big:
            m = np.zeros_like(solid); m[y0b:y1b] = up == p['id']; row_figs.append({'mask': m, 'cx': p['cx'] * S})
        figs.append(row_figs)
        for p in parts[gc:]:
            m = np.zeros_like(solid); m[y0b:y1b] = up == p['id']
            ys = np.nonzero(m.any(axis=1))[0]
            edge = 'top' if ys.min() <= y0b + 24 else 'bottom' if ys.max() >= y1b - 24 else None
            pieces.append((r, edge, m, p['cx'] * S))
        # Thin lines the thinning wiped out (an arrow, a bowstring): every leftover bit of the band
        # goes to the figure whose box holds it (or the nearest one).
        taken = np.zeros((y1b - y0b, alpha.shape[1]), bool)
        for f in row_figs: taken |= f['mask'][y0b:y1b]
        for _, _, m, _ in [q for q in pieces if q[0] == r]: taken |= m[y0b:y1b]
        rest = low & ~taken[::S, ::S][:low.shape[0], :low.shape[1]]
        lb3, parts3 = label(rest)
        up3 = np.kron(lb3, np.ones((S, S), int))[:y1b - y0b, :alpha.shape[1]]
        for f in row_figs:
            ys, xs = np.nonzero(f['mask'])
            f['box'] = (xs.min(), ys.min(), xs.max(), ys.max())
        for p in parts3:
            px, py = p['cx'] * S, y0b + p['cy'] * S
            def gap(f):
                x0, y0, x1, y1 = f['box']
                return max(x0 - px, 0, px - x1) + max(y0 - py, 0, py - y1)
            target = min(row_figs, key=gap)
            m = np.zeros_like(solid); m[y0b:y1b] = up3 == p['id']
            target['mask'] |= m
    for r, edge, m, cx in pieces:
        rr = r - 1 if edge == 'top' and r > 0 else r + 1 if edge == 'bottom' and r < gr - 1 else r
        target = min(figs[rr], key=lambda f: abs(f['cx'] - cx))
        target['mask'] |= m
    claimed = np.zeros_like(solid)
    for row_figs in figs:
        for f in row_figs: claimed |= f['mask']
    for r, row_figs in enumerate(figs):
        for c, f in enumerate(row_figs):
            # Grow the mask a little to take the soft edge pixels — but never onto another figure's.
            mk = f['mask']; d = mk.copy()
            for sh in range(1, S + 2):
                d[sh:, :] |= mk[:-sh, :]; d[:-sh, :] |= mk[sh:, :]; d[:, sh:] |= mk[:, :-sh]; d[:, :-sh] |= mk[:, sh:]
            keep = (mk | (d & ~claimed)) & (alpha > 0)
            # Drop small loose bits not joined to the figure (a neighbour's tip left at its feet).
            low = keep[::S, ::S] & (alpha[::S, ::S] > 128)
            lb2, parts2 = label(low)
            if parts2:
                biggest = max(p['size'] for p in parts2)
                # only bits lying at the row's edge (a neighbour's tip); thin parts inside — an
                # arrow, a bowstring — stay
                near = lambda p: p['cy'] * S < rows[r] + 30 or p['cy'] * S > rows[r + 1] - 30
                drop = [p['id'] for p in parts2 if p['size'] < biggest * 0.03 and near(p)]
                if drop:
                    gone = np.kron(np.isin(lb2, drop), np.ones((S, S), bool))[:keep.shape[0], :keep.shape[1]]
                    keep &= ~gone
            ys, xs = np.nonzero(keep & (alpha > 128))
            y0, y1, x0, x1 = ys.min(), ys.max(), xs.min(), xs.max()
            hgt = y1 - y0
            bandm = (ys > y0 + 0.3 * hgt) & (ys < y0 + 0.6 * hgt)
            frames.append({'keep': keep, 'box': (int(x0), int(y0), int(x1), int(y1)), 'anchor': (int(np.median(xs[bandm])), int(y1)), 'cy': (y0 + y1) / 2, 'row': r, 'col': c})
    comps = []
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
# order: rows by the foot line (a new row where the feet drop by more than half a figure), then x
# (cut by the grid, the order is the grid's)
if GRID: frames.sort(key=lambda f: (f['row'], f['col']))
frames.sort(key=lambda f: (f.get('row', 0), f['box'][0]) if GRID else f['box'][3])
if not GRID:
    half = sorted(f['box'][3] - f['box'][1] for f in frames)[len(frames) // 2] / 2
    row, prev = 0, None
    for f in frames:
        if prev is not None and f['box'][3] - prev > half: row += 1
        f['row'] = row
        prev = f['box'][3]
    frames.sort(key=lambda f: (f['row'], f['box'][0]))

def sign_point(f):
    """Centre of the glowing sign on the chest (pale gold, bright), relative to the anchor."""
    r, g, b, a = (A[..., k].astype(int) for k in range(4))
    m = f['keep'] & (a > 200) & (r > 225) & (g > 205) & (b > 120) & (b < 230)
    ys, xs = np.nonzero(m)
    if len(xs) < 20: return None
    return xs.mean() - f['anchor'][0], ys.mean() - f['anchor'][1]

for idx, axes, share in groups:
    pts = {i: sign_point(frames[i]) for i in idx}
    known = [p for p in pts.values() if p]
    mx = sum(p[0] for p in known) / len(known); my = sum(p[1] for p in known) / len(known)
    for i, p in pts.items():
        if not p: continue
        ax, ay = frames[i]['anchor']
        dx = round(p[0] - mx) if 'x' in axes else 0
        dy = round((p[1] - my) * share) if 'y' in axes else 0
        frames[i]['anchor'] = (ax + dx, ay + dy)
        print('steady', i, 'shift', -dx, -dy)
L = max(f['anchor'][0] - f['box'][0] for f in frames) + 6
R = max(f['box'][2] - f['anchor'][0] for f in frames) + 6
U = max(f['anchor'][1] - f['box'][1] for f in frames) + 6
D = 6
cw, ch = L + R, U + D
SCALE = float(os.environ.get('SCALE', '0.5'))
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
json.dump({'cell': [cwS, chS], 'anchor': [round(L * SCALE), round(U * SCALE)], 'frameHeight': round(sum(f['box'][3] - f['box'][1] for f in frames[:6]) / min(6, len(frames)) * SCALE)}, open(out_json, 'w'))
print('cells', cw, ch, '->', cwS, chS, 'anchor', L, U)
print(json.load(open(out_json)))
