# Bring the Film page and the hub up to date from a Letterboxd data export (Settings > Import & Export > Export
# your data, which downloads a zip).
#
#   py tools/lbexport.py "C:/Users/Jason/Downloads/letterboxd-bucatini_mickey-2026-10-20-15-05-utc.zip"
#
# It does three things:
# - My monthly picks: every film in my diary tagged 4insta_MM_YY (the films I enjoyed most that month and recommend)
#   goes into films/picks.json under its month, with its poster where the site already knows it (from posters.json or
#   recent.json). The hub's "picks" box shows the current month's, or the latest month's until I've tagged any.
#   Letterboxd's tag pages sit behind a bot check and its RSS has no tags, so the export is the only way to read them.
# - The lists already on the Film page get their films and counts from the export (lists that are only in the export
#   are private ones, and are left out; each list's tags and pictures stay as they are).
# - The number of films I've watched (watched.csv) goes into the Film page's stats and the hub's Film tile.
import csv, io, json, os, re, sys, zipfile
from datetime import date

def main(src):
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    z = zipfile.ZipFile(src) if src.lower().endswith('.zip') else None
    read = (lambda n: io.TextIOWrapper(z.open(n), encoding='utf-8').read()) if z else (lambda n: open(os.path.join(src, n), encoding='utf-8').read())
    names = z.namelist() if z else [os.path.relpath(os.path.join(d, f), src).replace('\\', '/') for d, _, fs in os.walk(src) for f in fs]
    rows = lambda n: list(csv.DictReader(io.StringIO(read(n))))

    # posters the site already has, by "Title (Year)"
    films_dir = os.path.join(root, 'films')
    P = json.load(open(os.path.join(films_dir, 'posters.json'), encoding='utf-8'))
    R = json.load(open(os.path.join(films_dir, 'recent.json'), encoding='utf-8'))
    known = {v[0]: (slug, 'https://a.ltrbxd.com/resized/' + v[1].replace('~', '-0-230-0-345-crop.jpg')) for slug, v in P['f'].items() if v[1]}
    for f in R.get('films', []):
        if f.get('p'): known.setdefault(f"{f['t']} ({f['y']})", (f.get('slug', ''), f['p'].replace('-0-600-0-900-', '-0-230-0-345-')))

    # 1. the monthly picks
    months = {}
    for r in rows('diary.csv'):
        for t in (r.get('Tags') or '').split(','):
            m = re.fullmatch(r'4insta_?(\d\d)_?(\d\d)', t.strip())
            if not m: continue
            key = f'20{m.group(2)}-{m.group(1)}'
            name = f"{r['Name']} ({r['Year']})"; slug, poster = known.get(name, ('', ''))
            months.setdefault(key, []).append({'t': r['Name'], 'y': r['Year'], 'r': float(r['Rating']) if r.get('Rating') else None,
                'w': r.get('Watched Date', ''), 'p': poster,
                'link': f'https://letterboxd.com/film/{slug}/' if slug else r['Letterboxd URI']})
    for k in months: months[k].sort(key=lambda f: f['w'])
    json.dump({'built': date.today().isoformat(), 'months': dict(sorted(months.items()))},
              open(os.path.join(films_dir, 'picks.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    print('picks:', {k: len(v) for k, v in sorted(months.items())})

    # 2. the lists on the Film page
    page = os.path.join(films_dir, 'index.html'); s = open(page, encoding='utf-8').read()
    m = re.search(r'(<script id="data" type="application/json">)(.*?)(</script>)', s, re.S)
    D = json.loads(m.group(2)); by = {l['s']: l for l in D['lists']}; changed = 0
    for n in names:
        if not re.fullmatch(r'lists/[^/]+\.csv', n): continue
        slug = n[6:-4]
        if slug not in by: continue                                           # a private list
        lines = list(csv.reader(io.StringIO(read(n))))
        films = [f'{x[1]} ({x[2]})' for x in lines[5:] if len(x) > 2 and x[1]]
        l = by[slug]
        if films != l['f'] or len(films) != l['c']:
            l['f'], l['c'] = films, len(films); changed += 1
    D['built'] = date.today().strftime('%-d %b %Y') if os.name != 'nt' else date.today().strftime('%#d %b %Y')
    s = s[:m.start(2)] + json.dumps(D, ensure_ascii=False, separators=(',', ':')) + s[m.end(2):]

    # 3. how many films I've watched
    watched = len(rows('watched.csv'))
    s = re.sub(r'<dd>\d+</dd><dt>Films</dt>', f'<dd>{watched}</dd><dt>Films</dt>', s)
    open(page, 'w', encoding='utf-8').write(s)
    hub = os.path.join(root, 'index.html'); h = open(hub, encoding='utf-8').read()
    open(hub, 'w', encoding='utf-8').write(re.sub(r'<span class="kick">\d+ films</span>', f'<span class="kick">{watched} films</span>', h))
    print(f'lists updated: {changed}; films watched: {watched}')

if __name__ == '__main__':
    main(sys.argv[1])
