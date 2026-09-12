import json
import math
from PIL import Image

def build_icons():
    img = Image.open('assets/pieces/b_knight.png').convert('RGBA')
    alpha = img.split()[-1]
    w, h = alpha.size

    # 1. Bounding box of knight
    bbox = alpha.getbbox()
    print('Knight bbox:', bbox)
    x0, y0, x1, y1 = bbox
    kw = x1 - x0
    kh = y1 - y0

    # 2. Moore-Neighbor contour tracing
    grid = [[alpha.getpixel((x, y)) > 120 for x in range(w)] for y in range(h)]

    start = None
    for y in range(h):
        for x in range(w):
            if grid[y][x]:
                start = (x, y)
                break
        if start:
            break

    dirs = [(0, -1), (1, -1), (1, 0), (1, 1), (0, 1), (-1, 1), (-1, 0), (-1, -1)]
    contour = []
    curr = start
    curr_dir = 0

    while True:
        contour.append(curr)
        found = False
        for i in range(8):
            check_dir = (curr_dir + i) % 8
            dx, dy = dirs[check_dir]
            nx, ny = curr[0] + dx, curr[1] + dy
            if 0 <= nx < w and 0 <= ny < h and grid[ny][nx]:
                curr = (nx, ny)
                curr_dir = (check_dir + 5) % 8
                found = True
                break
        if not found or (curr == start and len(contour) > 2):
            break

    print('Contour points:', len(contour))

    # Downsample points for smooth organic curve
    step = 4
    smoothed = contour[::step]
    n = len(smoothed)

    # Normalize to 100x100 box with 10% padding
    # Bounding box of smoothed points:
    sx0 = min(p[0] for p in smoothed)
    sy0 = min(p[1] for p in smoothed)
    sx1 = max(p[0] for p in smoothed)
    sy1 = max(p[1] for p in smoothed)
    sw = sx1 - sx0
    sh = sy1 - sy0

    target_size = 80.0
    scale = target_size / max(sw, sh)
    target_cx = 50.0
    target_cy = 50.0
    src_cx = (sx0 + sx1) / 2.0
    src_cy = (sy0 + sy1) / 2.0

    norm_pts = []
    for p in smoothed:
        nx = target_cx + (p[0] - src_cx) * scale
        ny = target_cy + (p[1] - src_cy) * scale
        norm_pts.append((nx, ny))

    # Generate cubic Bezier path
    d_parts = [f'M {norm_pts[0][0]:.2f},{norm_pts[0][1]:.2f}']
    for i in range(n):
        p0 = norm_pts[(i - 1) % n]
        p1 = norm_pts[i]
        p2 = norm_pts[(i + 1) % n]
        p3 = norm_pts[(i + 2) % n]

        cp1_x = p1[0] + (p2[0] - p0[0]) / 6.0
        cp1_y = p1[1] + (p2[1] - p0[1]) / 6.0
        cp2_x = p2[0] - (p3[0] - p1[0]) / 6.0
        cp2_y = p2[1] - (p3[1] - p1[1]) / 6.0

        d_parts.append(f'C {cp1_x:.2f},{cp1_y:.2f} {cp2_x:.2f},{cp2_y:.2f} {p2[0]:.2f},{p2[1]:.2f}')

    d_parts.append('Z')
    svg_path = ' '.join(d_parts)

    # 3. Save favicon.svg with dark/light mode adaptation
    favicon_svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <style>
    path {{
      fill: #262626;
    }}
    @media (prefers-color-scheme: dark) {{
      path {{
        fill: #f2f2f2;
      }}
    }}
  </style>
  <path d="{svg_path}" fill-rule="evenodd" clip-rule="evenodd" />
</svg>'''

    with open('favicon.svg', 'w', encoding='utf-8') as f:
        f.write(favicon_svg)
    with open('assets/favicon.svg', 'w', encoding='utf-8') as f:
        f.write(favicon_svg)
    with open('assets/logo.svg', 'w', encoding='utf-8') as f:
        f.write(favicon_svg)

    print('Wrote favicon.svg and assets/logo.svg')

    # 4. Generate PNG icons
    cropped = img.crop(bbox)
    cw, ch = cropped.size
    side = int(max(cw, ch) / 0.82)
    canvas = Image.new('RGBA', (side, side), (0, 0, 0, 0))
    offset = ((side - cw) // 2, (side - ch) // 2)
    canvas.paste(cropped, offset)

    # Apple Touch Icon (180x180) - minimal square card with warm white background
    # Apple icons look best with opaque background
    apple_canvas = Image.new('RGBA', (180, 180), (253, 253, 253, 255))
    apple_knight = canvas.resize((144, 144), Image.Resampling.LANCZOS)
    apple_canvas.paste(apple_knight, (18, 18), apple_knight)
    apple_canvas.save('apple-touch-icon.png')
    apple_canvas.save('assets/apple-touch-icon.png')

    # Transparent PNG favicons
    p512 = canvas.resize((512, 512), Image.Resampling.LANCZOS)
    p512.save('assets/icon-512.png')

    p192 = canvas.resize((192, 192), Image.Resampling.LANCZOS)
    p192.save('assets/icon-192.png')

    p48 = canvas.resize((48, 48), Image.Resampling.LANCZOS)
    p48.save('assets/favicon-48x48.png')

    p32 = canvas.resize((32, 32), Image.Resampling.LANCZOS)
    p32.save('assets/favicon-32x32.png')

    p16 = canvas.resize((16, 16), Image.Resampling.LANCZOS)
    p16.save('assets/favicon-16x16.png')

    # favicon.ico with 16, 32, 48 sizes
    canvas.save('favicon.ico', format='ICO', sizes=[(16, 16), (32, 32), (48, 48)])
    canvas.save('assets/favicon.ico', format='ICO', sizes=[(16, 16), (32, 32), (48, 48)])

    # Web Manifest
    manifest = {
        "name": "Minimal Chess",
        "short_name": "MinChess",
        "description": "Minimalist pass-and-play chess for two players",
        "start_url": "./index.html",
        "display": "standalone",
        "background_color": "#fdfdfd",
        "theme_color": "#111111",
        "icons": [
            {
                "src": "assets/icon-192.png",
                "sizes": "192x192",
                "type": "image/png"
            },
            {
                "src": "assets/icon-512.png",
                "sizes": "512x512",
                "type": "image/png"
            }
        ]
    }
    with open('site.webmanifest', 'w', encoding='utf-8') as f:
        json.dump(manifest, f, indent=2)

    print('Generated all icon files and site.webmanifest')

if __name__ == '__main__':
    build_icons()
