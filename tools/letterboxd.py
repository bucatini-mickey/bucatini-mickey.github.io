# Fetch my recent Letterboxd diary from its public RSS feed and write films/recent.json for the Film page.
#
#   python tools/letterboxd.py            (run from the repo root; a GitHub Action also runs it daily)
#
# The feed holds my last 100 activities. Diary entries (films) are kept: title, year, the film's page, my rating,
# like and rewatch, the date I watched it, the poster and any review text. Lists in the feed are skipped.
import html, json, os, re, sys, urllib.request
from xml.etree import ElementTree as ET

USER = 'bucatini_mickey'
NS = {'lb': 'https://letterboxd.com', 'tmdb': 'https://themoviedb.org', 'dc': 'http://purl.org/dc/elements/1.1/'}

def main():
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    req = urllib.request.Request(f'https://letterboxd.com/{USER}/rss/', headers={'User-Agent': 'Mozilla/5.0 (film page for bucatini-mickey.github.io)'})
    xml = urllib.request.urlopen(req, timeout=30).read()
    items = []
    for it in ET.fromstring(xml).iter('item'):
        title = it.findtext('lb:filmTitle', namespaces=NS)
        if not title: continue                                            # a list, not a film
        link = it.findtext('link') or ''
        m = re.search(r'/film/([^/]+)/', link)
        desc = it.findtext('description') or ''
        poster = re.search(r'<img src="([^"]+)"', desc)
        paras = [re.sub(r'<[^>]+>', '', p).strip() for p in re.findall(r'<p>(.*?)</p>', desc, re.S)]
        review = '\n\n'.join(html.unescape(p) for p in paras if p and not p.startswith('Watched on '))
        rating = it.findtext('lb:memberRating', namespaces=NS)
        items.append({
            't': title, 'y': it.findtext('lb:filmYear', namespaces=NS) or '',
            'slug': m.group(1) if m else '', 'link': link,
            'r': float(rating) if rating else None,
            'like': it.findtext('lb:memberLike', namespaces=NS) == 'Yes',
            're': it.findtext('lb:rewatch', namespaces=NS) == 'Yes',
            'w': it.findtext('lb:watchedDate', namespaces=NS) or '',
            'p': poster.group(1) if poster else '',
            'rev': review,
        })
    out = os.path.join(root, 'films', 'recent.json')
    new = json.dumps({'user': USER, 'films': items}, ensure_ascii=False, separators=(',', ':'))
    old = open(out, encoding='utf-8').read() if os.path.exists(out) else ''
    if new != old:
        open(out, 'w', encoding='utf-8').write(new)
        print(len(items), 'films written to films/recent.json')
    else:
        print('no change')

if __name__ == '__main__':
    main()
