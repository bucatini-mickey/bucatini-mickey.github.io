/* Shared by both sites (keep identical). Keeps the files that never change, the fonts and the photographs, on the
   device after their first download, so later visits don't wait for them (GitHub Pages lets browsers keep files
   for only ten minutes). Pages, scripts and styles always come from the network, so an update is never hidden. */
const STORE='fonts-photos-v1';
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==STORE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
  const u=new URL(e.request.url);
  if(e.request.method!=='GET'||u.origin!==location.origin||!/\.(woff2|webp)$/.test(u.pathname)) return;
  e.respondWith(caches.open(STORE).then(c=>c.match(e.request).then(hit=>hit||fetch(e.request).then(r=>{ if(r.ok) c.put(e.request,r.clone()); return r }))));
});
