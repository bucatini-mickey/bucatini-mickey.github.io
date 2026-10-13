/* Stored 2026-10-13: the Starry Night brushstroke field that was the hub's backdrop.
   To use it again: a <canvas class="swirl backdrop" data-seed="57" data-density=".8"> and this script.
   It reads the colour tokens --kaki --kuchiba --koke --ai --fuji --beni from :root. */
/* Impressionist brushstroke field: short strokes follow a swirling flow (a few vortices, Starry Night style), coloured from the theme's autumn tokens. Drawn once; redrawn on resize or theme change. */
(function(){
  function rng(seed){let s=seed>>>0||1;return()=>((s=Math.imul(s^s>>>15,1|s)+0x6D2B79F5|0,((s^s>>>14)>>>0)/4294967296))}
  function draw(cv){
    const seed=+cv.dataset.seed||7, dens=+cv.dataset.density||1;
    const r=rng(seed), dpr=Math.min(2,window.devicePixelRatio||1);
    const W=cv.clientWidth,H=cv.clientHeight; cv.width=W*dpr; cv.height=H*dpr;
    const c=cv.getContext('2d'); c.setTransform(dpr,0,0,dpr,0,0); c.clearRect(0,0,W,H);
    const cs=getComputedStyle(document.documentElement);
    const pal=['--kaki','--kuchiba','--koke','--ai','--fuji','--beni'].map(v=>cs.getPropertyValue(v).trim());
    const vort=Array.from({length:4},()=>({x:r()*W,y:r()*H*.8,s:(r()<.5?-1:1)*(.6+r()*.8),rad:80+r()*160}));
    const field=(x,y)=>{let a=Math.sin(x*.006+Math.sin(y*.009)*1.6)+Math.cos(y*.005-x*.002)*1.1;
      let vx=Math.cos(a),vy=Math.sin(a)*.6;
      for(const v of vort){const dx=x-v.x,dy=y-v.y,d=Math.hypot(dx,dy)+1,w=Math.exp(-d/v.rad)*2.2*v.s;vx+=-dy/d*w;vy+=dx/d*w}
      const m=Math.hypot(vx,vy)||1;return [vx/m,vy/m]};
    const n=Math.floor(W*H/260*dens);
    c.lineCap='round';
    for(let i=0;i<n;i++){
      let x=r()*W,y=r()*H;
      const t=Math.min(.999,Math.max(0,x/W*.75+y/H*.25+(r()-.5)*.35));
      c.strokeStyle=pal[Math.floor(t*pal.length)];
      c.globalAlpha=.22+r()*.5; c.lineWidth=1.2+r()*3.4;
      c.beginPath();c.moveTo(x,y);
      const len=5+Math.floor(r()*9);
      for(let k=0;k<len;k++){const [dx,dy]=field(x,y);x+=dx*3.2;y+=dy*3.2;c.lineTo(x,y)}
      c.stroke();
    }
    c.globalAlpha=1;
  }
  function all(){document.querySelectorAll('canvas.swirl').forEach(draw)}
  let t;window.addEventListener('resize',()=>{clearTimeout(t);t=setTimeout(all,200)});
  /* dark by default; light only when the visitor picks it (remembered in this browser) */
  const root=document.documentElement,btn=document.getElementById('mode');
  const set=m=>{if(m==='light')root.dataset.theme='light';else delete root.dataset.theme;if(btn)btn.textContent=m==='light'?'Dark':'Light';};
  let m='dark';try{m=localStorage.getItem('bm-theme')||'dark'}catch(e){}
  set(m);
  if(btn)btn.onclick=()=>{m=m==='dark'?'light':'dark';try{localStorage.setItem('bm-theme',m)}catch(e){}set(m);all()};
  document.fonts?.ready.then(all); all();
})();

