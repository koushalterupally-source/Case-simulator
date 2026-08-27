#!/usr/bin/env python3
"""Generate the app icon set.

No image library is available in this environment, so this writes PNGs directly: raw RGBA scanlines,
zlib-deflated, wrapped in the three chunks a PNG needs. Everything is drawn with supersampled coverage
so the curves stay clean at 72px.

Usage:  python3 make_icons.py <out-dir>
"""

import os
import struct
import sys
import zlib

SIZES = [72, 96, 128, 144, 152, 192, 384, 512]

BG_FROM = (0x25, 0x63, 0xEB)   # accent blue
BG_TO = (0x7C, 0x3A, 0xED)     # violet
SHEET = (0xFF, 0xFF, 0xFF)
BAR = (0x93, 0xB4, 0xF7)
TICK = (0x22, 0xC5, 0x5E)

SS = 3  # supersampling factor per axis


def lerp(a, b, t):
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))


def rounded_rect(x, y, w, h, r):
    """Return a coverage predicate for a rounded rectangle."""
    def inside(px, py):
        if px < x or py < y or px > x + w or py > y + h:
            return False
        cx = min(max(px, x + r), x + w - r)
        cy = min(max(py, y + r), y + h - r)
        dx, dy = px - cx, py - cy
        return dx * dx + dy * dy <= r * r or (x + r <= px <= x + w - r) or (y + r <= py <= y + h - r)
    return inside


def tick_shape(size):
    """A check mark built from two thick segments."""
    s = size
    pts = [(0.395, 0.640), (0.470, 0.712), (0.640, 0.520)]
    thickness = 0.052 * s

    def dist_to_seg(px, py, ax, ay, bx, by):
        vx, vy = bx - ax, by - ay
        wx, wy = px - ax, py - ay
        L2 = vx * vx + vy * vy
        t = 0.0 if L2 == 0 else max(0.0, min(1.0, (wx * vx + wy * vy) / L2))
        dx, dy = px - (ax + t * vx), py - (ay + t * vy)
        return (dx * dx + dy * dy) ** 0.5

    abs_pts = [(px * s, py * s) for px, py in pts]

    def inside(px, py):
        for i in range(len(abs_pts) - 1):
            ax, ay = abs_pts[i]
            bx, by = abs_pts[i + 1]
            if dist_to_seg(px, py, ax, ay, bx, by) <= thickness / 2:
                return True
        return False
    return inside


def render(size):
    s = size
    sheet_x, sheet_y = 0.235 * s, 0.195 * s
    sheet_w, sheet_h = 0.530 * s, 0.610 * s
    sheet = rounded_rect(sheet_x, sheet_y, sheet_w, sheet_h, 0.075 * s)
    tick = tick_shape(s)

    bars = []
    for i, (wy, ww) in enumerate([(0.300, 0.330), (0.375, 0.270), (0.450, 0.330)]):
        bars.append(rounded_rect(0.310 * s, wy * s, ww * s, 0.038 * s, 0.019 * s))

    outer = rounded_rect(0, 0, s - 1, s - 1, 0.223 * s)

    rows = []
    for y in range(s):
        row = bytearray()
        for x in range(s):
            acc = [0, 0, 0, 0]
            for sy in range(SS):
                for sx in range(SS):
                    px = x + (sx + 0.5) / SS
                    py = y + (sy + 0.5) / SS
                    if not outer(px, py):
                        continue
                    base = lerp(BG_FROM, BG_TO, (px + py) / (2.0 * s))
                    col = base
                    if sheet(px, py):
                        col = SHEET
                        for bar in bars:
                            if bar(px, py):
                                col = BAR
                                break
                        if tick(px, py):
                            col = TICK
                    acc[0] += col[0]
                    acc[1] += col[1]
                    acc[2] += col[2]
                    acc[3] += 255
            n = SS * SS
            alpha = acc[3] // n
            if alpha == 0:
                row += bytes((0, 0, 0, 0))
            else:
                # un-premultiply against covered samples so edges stay the right hue
                covered = max(1, acc[3] // 255)
                row += bytes((acc[0] // covered, acc[1] // covered, acc[2] // covered, alpha))
        rows.append(bytes(row))
    return rows


def write_png(path, size, rows):
    raw = b''.join(b'\x00' + row for row in rows)

    def chunk(tag, payload):
        return (struct.pack('>I', len(payload)) + tag + payload
                + struct.pack('>I', zlib.crc32(tag + payload) & 0xFFFFFFFF))

    png = b'\x89PNG\r\n\x1a\n'
    png += chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 6, 0, 0, 0))
    png += chunk(b'IDAT', zlib.compress(raw, 9))
    png += chunk(b'IEND', b'')
    with open(path, 'wb') as fh:
        fh.write(png)


def main():
    if len(sys.argv) != 2:
        print(__doc__)
        return 1
    out = sys.argv[1]
    os.makedirs(out, exist_ok=True)
    for size in SIZES:
        path = os.path.join(out, f'icon-{size}.png')
        write_png(path, size, render(size))
        print(f'{path}  {os.path.getsize(path):,} bytes')
    return 0


if __name__ == '__main__':
    sys.exit(main())
