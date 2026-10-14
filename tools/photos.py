# Make web copies of my photographs for the site, from a folder of originals that stays on my PC.
#
#   py tools/photos.py "E:/Claude/Personal/Photos"            (run from the repo root)
#
# For every image in that folder (jpg, jpeg, png, tif, tiff, webp, heic if Pillow can read it):
#   - turns it the right way up (from its EXIF orientation), then writes three WebP copies, 2560, 1280 and 640 px
#     on the long side (never enlarged), to photos/img/<name>-<size>.webp;
#   - writes no metadata at all into the copies, so location (GPS), camera and date never leave the PC;
#   - records each photo in assets/library.json: its files, size, a dominant colour, and a tiny blurred preview
#     (a 16 px wide data URI) for pages to show while the real image loads, and an 'alt' description (written by
#     hand into library.json; kept when the photo is remade).
# Originals are never copied or changed. Photos already converted are skipped unless the original is newer.
# A photo can be left out by putting a '_' at the start of its file name.
# The hub's datamosh (assets/scenes.js) and the Photos page read assets/library.json.
import base64, io, json, os, re, sys
from PIL import Image, ImageOps

SIZES = (2560, 1280, 640)
EXTS = {'.jpg', '.jpeg', '.png', '.tif', '.tiff', '.webp', '.heic'}

def slug(name):
    s = re.sub(r'[^a-z0-9]+', '-', os.path.splitext(name)[0].lower()).strip('-')
    return s or 'photo'

def main(src):
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    out_dir = os.path.join(root, 'photos', 'img')
    os.makedirs(out_dir, exist_ok=True)
    lib_path = os.path.join(root, 'assets', 'library.json')
    old = {}
    if os.path.exists(lib_path):
        try: old = {p['id']: p for p in json.load(open(lib_path, encoding='utf-8')).get('photos', [])}
        except Exception: pass
    photos, used = [], set()
    for name in sorted(os.listdir(src)):
        path = os.path.join(src, name)
        if name.startswith(('_', '.')) or os.path.splitext(name)[1].lower() not in EXTS or not os.path.isfile(path): continue
        pid = slug(name)
        while pid in used: pid += '-2'
        used.add(pid)
        files = {s: f'photos/img/{pid}-{s}.webp' for s in SIZES}
        fresh = all(os.path.exists(os.path.join(root, f)) and os.path.getmtime(os.path.join(root, f)) >= os.path.getmtime(path) for f in files.values())
        if fresh and pid in old:
            photos.append(old[pid]); continue
        try:
            im = ImageOps.exif_transpose(Image.open(path)).convert('RGB')
        except Exception as e:
            print('skipped', name, '-', e); continue
        W, H = im.size
        for s, rel in files.items():
            k = min(1, s / max(W, H))
            cp = im.resize((round(W * k), round(H * k)), Image.LANCZOS) if k < 1 else im
            cp.save(os.path.join(root, rel), 'WEBP', quality=82 if s > 1000 else 78, method=6)   # saved with no EXIF, ICC aside
        tiny = im.resize((16, max(1, round(16 * H / W))), Image.LANCZOS)
        buf = io.BytesIO(); tiny.save(buf, 'WEBP', quality=50)
        r, g, b = im.resize((1, 1), Image.LANCZOS).getpixel((0, 0))
        photos.append({'id': pid, 'src': files[1280], 'files': files, 'w': W, 'h': H,
                       'colour': f'#{r:02x}{g:02x}{b:02x}', 'preview': 'data:image/webp;base64,' + base64.b64encode(buf.getvalue()).decode(),
                       'alt': old.get(pid, {}).get('alt', '')})
        print('made', pid, f'{W}x{H}')
    keep = {p['id'] for p in photos}
    for f in os.listdir(out_dir):                                  # remove copies of photos no longer in the folder
        if f.endswith('.webp') and f.rsplit('-', 1)[0] not in keep: os.remove(os.path.join(out_dir, f))
    json.dump({'photos': photos}, open(lib_path, 'w', encoding='utf-8'), indent=1)
    print(len(photos), 'photos in assets/library.json')

if __name__ == '__main__':
    if len(sys.argv) != 2 or not os.path.isdir(sys.argv[1]): sys.exit(__doc__ or 'usage: py tools/photos.py FOLDER')
    main(sys.argv[1])
