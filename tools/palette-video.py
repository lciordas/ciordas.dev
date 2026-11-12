# Redraws a clip made in one palette in the others, for the ?palette= previews: every pixel is split into how much of
# the clip's background, its ink and its highlight colour went into it, and put back together with the other palette's
# highlight. A clip drawn only in those three colours (and blends of them) comes out as if drawn in the new one.
# Run from the repo root with numpy:
#   python tools/palette-video.py media/projects/tennis-simulation/match-peach.mp4 peach '#171513' a e f g
# writes match.mp4 for the default palette and match-e.mp4, match-f.mp4, match-g.mp4 next to it (the name's own
# -peach is dropped first). The tennis clip is kept in peach, the palette it was drawn in, as the source for the others.
import os, re, subprocess, sys
import numpy as np

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
PALETTE_JS = open(os.path.join(ROOT, 'js/palette.js')).read()
DEFAULT = re.search(r"BAKED_IN = '(\w+)'", PALETTE_JS).group(1)
accent = lambda key: re.search(r"\n  " + key + r": \{\s*name: '[^']*', accent: '(#[0-9a-f]{6})'", PALETTE_JS).group(1)
rgb = lambda h: np.array([int(h[i:i + 2], 16) for i in (1, 3, 5)], dtype=np.float64)

src, frm, bg, *keys = sys.argv[1:]
INK, BG, FROM = rgb('#f4efe8'), rgb(bg), rgb(accent(frm))
w, h = map(int, subprocess.check_output(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', src]).decode().strip().split(','))
fps = subprocess.check_output(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=r_frame_rate', '-of', 'csv=p=0', src]).decode().strip()
base = re.sub(rf'-{frm}(\.mp4)$', r'\1', src)

for key in keys:
    TO = rgb(accent(key))
    # Columns: background-to-ink, background-to-highlight, and the direction off that plane (left as it is).
    a, b = INK - BG, FROM - BG
    n = np.cross(a, b); n /= np.linalg.norm(n)
    M = np.column_stack([a, TO - BG, n]) @ np.linalg.inv(np.column_stack([a, b, n]))
    out = base if key == DEFAULT else base.replace('.mp4', f'-{key}.mp4')
    dec = subprocess.Popen(['ffmpeg', '-v', 'error', '-i', src, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], stdout=subprocess.PIPE)
    enc = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{w}x{h}', '-r', fps, '-i', '-',
                            '-an', '-c:v', 'libx264', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-crf', '26', '-preset', 'slow',
                            '-movflags', '+faststart', out], stdin=subprocess.PIPE)
    size = w * h * 3
    while True:
        buf = dec.stdout.read(size)
        if len(buf) < size: break
        p = np.frombuffer(buf, np.uint8).reshape(-1, 3).astype(np.float64) - BG
        enc.stdin.write(np.clip(p @ M.T + BG, 0, 255).round().astype(np.uint8).tobytes())
    enc.stdin.close(); enc.wait(); dec.wait()
    print(out, f'{os.path.getsize(out) / 1e6:.2f} MB')
