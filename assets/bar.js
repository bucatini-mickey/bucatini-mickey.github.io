/* Shared by both sites (keep identical). Following the other site's name in the bar first plays the change
   described in bar.css, then goes there; the page that opens already shows the end of it. Also registers sw.js
   and, with ?diag in the address, loads the diagnostics panel. */
(function(){
  // keep fonts and photographs on the device after the first visit (sw.js at the site's root)
  if('serviceWorker' in navigator&&location.protocol==='https:'){ const sw=new URL('../sw.js',document.currentScript.src); addEventListener('load',()=>navigator.serviceWorker.register(sw).catch(()=>{})) }
  if(/[?&]diag(=|&|$)/.test(location.search)){ const d=document.createElement('script'); d.src=new URL('diag.js',document.currentScript.src).href; document.body.appendChild(d) }   // the diagnostics panel
  const s=document.querySelector('.sites'), a=s&&s.querySelector('.away'); if(!a) return;
  a.addEventListener('pointerenter',()=>{ if(a.dataset.pf) return; a.dataset.pf=1; const l=document.createElement('link'); l.rel='prefetch'; l.href=a.href; document.head.appendChild(l) },{once:true});
  if(matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  a.addEventListener('click',e=>{
    if(e.button||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey) return;
    e.preventDefault(); s.classList.add('swap'); setTimeout(()=>{location.href=a.href},560);
  });
  addEventListener('pageshow',e=>{ if(e.persisted) s.classList.remove('swap') });   // coming back via the back button
})();
