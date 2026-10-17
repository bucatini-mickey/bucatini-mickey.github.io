/* Shared by both sites (keep identical). Following the other site's name in the bar first plays the change
   described in bar.css, then goes there; the page that opens already shows the end of it. Also registers sw.js,
   keeps a small picture of a Bucatini room's backdrop when it is left (for the hub to open on) and, with ?diag in
   the address, loads the diagnostics panel. */
(function(){
  // keep fonts and photographs on the device after the first visit (sw.js at the site's root)
  if('serviceWorker' in navigator&&location.protocol==='https:'){ const sw=new URL('../sw.js',document.currentScript.src); addEventListener('load',()=>navigator.serviceWorker.register(sw).catch(()=>{})) }
  if(/[?&]diag(=|&|$)/.test(location.search)){ const d=document.createElement('script'); d.src=new URL('diag.js',document.currentScript.src).href; document.body.appendChild(d) }   // the diagnostics panel
  // on Bucatini Mickey's rooms, keep a small picture of the backdrop as the page is left, so the hub can open on it
  if(document.querySelector('.sites .bm.here')&&!document.getElementById('fractal')) addEventListener('pagehide',()=>{
    try{ const src=document.querySelector('canvas.backdrop')||document.getElementById('hero'); if(!src) return;
      const w=src.width||src.naturalWidth, h=src.height||src.naturalHeight; if(!w||!h) return;
      const k=Math.min(1,480/w), c=document.createElement('canvas'); c.width=Math.round(w*k); c.height=Math.round(h*k);
      c.getContext('2d').drawImage(src,0,0,c.width,c.height);
      sessionStorage.setItem('bm-last-bg',JSON.stringify({src:c.toDataURL('image/jpeg',.72),at:Date.now()})) }catch(e){} });
  const s=document.querySelector('.sites'), a=s&&s.querySelector('.away'); if(!a) return;
  a.addEventListener('pointerenter',()=>{ if(a.dataset.pf) return; a.dataset.pf=1; const l=document.createElement('link'); l.rel='prefetch'; l.href=a.href; document.head.appendChild(l) },{once:true});
  if(matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  a.addEventListener('click',e=>{
    if(e.button||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey) return;
    e.preventDefault(); s.classList.add('swap'); setTimeout(()=>{location.href=a.href},560);
  });
  addEventListener('pageshow',e=>{ if(e.persisted) s.classList.remove('swap') });   // coming back via the back button
})();
