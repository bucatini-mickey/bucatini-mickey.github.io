# Make web copies of my photographs for the site, from a folder of originals that stays on my PC.
#
#   py tools/photos.py "E:/Claude/photos"            (run from the repo root)
#
# The folder holds one subfolder per use, and a photo's folder decides where it appears:
#   gallery/            the Photos page
#   home_and_gallary/   the Photos page and the hub's backdrop
#   joke/               slipped into the hub's backdrop now and then
#   paintings/          the Art page (cropped to the canvas; see tools/photos.json)
#   me/ and any folder starting with '_' are left out (kept for later).
# Loose photos in the top folder count as gallery photos. A photo can be left out by putting '_' at the start of
# its file name, or by listing it under "skip" in tools/photos.json; "crop" there gives a box (in pixels of the
# upright original) for photos that need trimming, such as a painting photographed on a wall.
# For every photo used: turns it the right way up (from its EXIF orientation), crops it if asked, then writes three
# WebP copies, 2560, 1280 and 640 px on the long side (never enlarged), to photos/img/<name>-<size>.webp, with no
# metadata at all, so location (GPS), camera and date never leave the PC. assets/library.json records each photo's
# files, size, tags, a dominant colour, a tiny blurred preview and an 'alt' description (from tools/alts.json, by
# photo id, unless one was already written into library.json). Originals are never copied or changed; photos already made are
# skipped unless the original or its crop changed.
import base64, hashlib, io, json, os, re, sys
from PIL import Image, ImageOps

SIZES = (2560, 1280, 640)
EXTS = {'.jpg', '.jpeg', '.png', '.tif', '.tiff', '.webp', '.heic'}
TAGS = {'gallery': ['gallery'], 'home_and_gallary': ['home', 'gallery'], 'home_and_gallery': ['home', 'gallery'],
        'home': ['home'], 'joke': ['joke'], 'paintings': ['painting'], '': ['gallery']}
LEAVE_OUT = {'me'}

def slug(name):
    s = re.sub(r'[^a-z0-9]+', '-', os.path.splitext(name)[0].lower()).strip('-')
    return s or 'photo'

def main(src):
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    out_dir = os.path.join(root, 'photos', 'img'); os.makedirs(out_dir, exist_ok=True)
    lib_path = os.path.join(root, 'assets', 'library.json')
    cfg_path = os.path.join(root, 'tools', 'photos.json')
    cfg = json.load(open(cfg_path, encoding='utf-8')) if os.path.exists(cfg_path) else {}
    skip, crops = set(cfg.get('skip', [])), cfg.get('crop', {})
    alts_path = os.path.join(root, 'tools', 'alts.json')
    alts = json.load(open(alts_path, encoding='utf-8')) if os.path.exists(alts_path) else {}
    old = {}
    if os.path.exists(lib_path):
        try: old = {p['id']: p for p in json.load(open(lib_path, encoding='utf-8')).get('photos', [])}
        except Exception: pass
    found = []
    for folder in [''] + sorted(d for d in os.listdir(src) if os.path.isdir(os.path.join(src, d))):
        if folder.startswith(('_', '.')) or folder in LEAVE_OUT: continue
        if folder not in TAGS: print('unknown folder, skipped:', folder); continue
        d = os.path.join(src, folder)
        for name in sorted(os.listdir(d)):
            if name.startswith(('_', '.')) or name in skip or os.path.splitext(name)[1].lower() not in EXTS: continue
            if os.path.isfile(os.path.join(d, name)): found.append((folder, name))
    photos, used = [], set()
    for folder, name in found:
        path = os.path.join(src, folder, name)
        pid = slug(name)
        while pid in used: pid += '-2'
        used.add(pid)
        crop = crops.get(name)
        stamp = hashlib.md5(json.dumps([os.path.getmtime(path), crop]).encode()).hexdigest()[:10]
        files = {s: f'photos/img/{pid}-{s}.webp' for s in SIZES}
        tags = TAGS[folder]
        prev = old.get(pid)
        if prev and prev.get('stamp') == stamp and all(os.path.exists(os.path.join(root, f)) for f in files.values()):
            prev['tags'] = tags; prev['alt'] = prev.get('alt') or alts.get(pid, ''); photos.append(prev); continue
        try:
            im = ImageOps.exif_transpose(Image.open(path)).convert('RGB')
        except Exception as e:
            print('skipped', name, '-', e); continue
        if crop: im = im.crop(tuple(crop))
        W, H = im.size
        for s, rel in files.items():
            k = min(1, s / max(W, H))
            cp = im.resize((round(W * k), round(H * k)), Image.LANCZOS) if k < 1 else im
            cp.save(os.path.join(root, rel), 'WEBP', quality=82 if s > 1000 else 78, method=6)   # saved with no EXIF
        tiny = im.resize((16, max(1, round(16 * H / W))), Image.LANCZOS)
        buf = io.BytesIO(); tiny.save(buf, 'WEBP', quality=50)
        r, g, b = im.resize((1, 1), Image.LANCZOS).getpixel((0, 0))
        photos.append({'id': pid, 'src': files[1280], 'files': files, 'w': W, 'h': H, 'tags': tags, 'stamp': stamp,
                       'colour': f'#{r:02x}{g:02x}{b:02x}', 'preview': 'data:image/webp;base64,' + base64.b64encode(buf.getvalue()).decode(),
                       'alt': (prev or {}).get('alt') or alts.get(pid, '')})
        print('made', pid, tags, f'{W}x{H}', flush=True)
    keep = {p['id'] for p in photos}
    for f in os.listdir(out_dir):                                  # remove copies of photos no longer used
        if f.endswith('.webp') and f.rsplit('-', 1)[0] not in keep: os.remove(os.path.join(out_dir, f))
    json.dump({'photos': photos}, open(lib_path, 'w', encoding='utf-8'), indent=1)
    print(len(photos), 'photos in assets/library.json')

if __name__ == '__main__':
    if len(sys.argv) != 2 or not os.path.isdir(sys.argv[1]): sys.exit('usage: py tools/photos.py FOLDER')
    main(sys.argv[1])
