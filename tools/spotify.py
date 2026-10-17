# Fill in the Music page: names and covers for the playlists and artists listed in music/showcase.json.
#
#   python tools/spotify.py            (run from the repo root; a GitHub Action also runs it weekly)
#
# music/showcase.json is edited by hand: "featured" is the playlist at the top, "showcase" the playlists I want to
# show off, "profile" a few more from my public profile and "artists" the artists I've been playing. Spotify's public
# oEmbed endpoint gives each one's title and cover without an API key; they are written to music/playlists.json.
import json, os, urllib.parse, urllib.request

def oembed(kind, sid):
    url = 'https://open.spotify.com/oembed?url=' + urllib.parse.quote(f'https://open.spotify.com/{kind}/{sid}')
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (music page for bucatini-mickey.github.io)'})
    try:
        d = json.load(urllib.request.urlopen(req, timeout=30))
    except Exception as e:
        print('skipped', kind, sid, e); return None
    return {'id': sid, 't': d.get('title', ''), 'img': d.get('thumbnail_url', '')}

def main():
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    src = json.load(open(os.path.join(root, 'music', 'showcase.json'), encoding='utf-8'))
    cache = {}
    def get(kind, sid):
        if (kind, sid) not in cache: cache[kind, sid] = oembed(kind, sid)
        return cache[kind, sid]
    out = {'user': src['user'], 'featured': get('playlist', src['featured'])}
    for key, kind in (('showcase', 'playlist'), ('profile', 'playlist'), ('artists', 'artist')):
        out[key] = [x for x in (get(kind, s) for s in src.get(key, [])) if x]
    path = os.path.join(root, 'music', 'playlists.json')
    new = json.dumps(out, ensure_ascii=False, separators=(',', ':'))
    old = open(path, encoding='utf-8').read() if os.path.exists(path) else ''
    if new != old:
        open(path, 'w', encoding='utf-8').write(new); print('music/playlists.json written')
    else:
        print('no change')

if __name__ == '__main__':
    main()
