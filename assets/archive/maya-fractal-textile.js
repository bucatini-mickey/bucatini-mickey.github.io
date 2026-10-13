/* Stored 2026-10-13: the hub's Maya backdrop. A self-similar stepped-diamond textile under a thread weave, framed
   by Barnsley ferns, recursive vines, two Brugmansia and a sword-billed hummingbird. To use it again: a
   <canvas class="backdrop" id="jungle"> and this script (it reads root.dataset.theme and the #mode button). */
/* The hub's backdrop, a Maya forest clearing built from fractals rather than drawings.
   Behind: a woven Maya textile whose stepped diamonds are self-similar, each holding four smaller ones, each of
   those four smaller still, in Maya blue, jade, ochre, cochineal and cacao, the colours flowing slowly outward:
   psychedelic, but only just. A thread weave lies over it all.
   Around the edges: ferns grown by Barnsley's iterated function system (the same four affine maps that make a
   real fern's fronds self-similar), and vines that branch recursively into curling tendrils.
   One bird: a sword-billed hummingbird in silhouette, its bill raised into a hanging Brugmansia.
   The textile drifts up more slowly than the page; the forest frame stays put. */
(function(){
  const cv=document.getElementById('jungle'), root=document.documentElement, still=matchMedia('(prefers-reduced-motion: reduce)').matches;
  function rng(seed){let s=seed>>>0;return()=>{s=s+0x6D2B79F5|0;let t=Math.imul(s^s>>>15,1|s);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
  const PAL=[[46,111,165],[42,145,133],[214,163,58],[176,52,45],[92,52,34],[232,214,170],[24,64,96]];   // maya blue, jade, ochre, cochineal, cacao, maize, indigo
  const css=(c,a=1)=>`rgba(${c.map(Math.round).join(',')},${a})`;
  let W=0,H=0,dpr=1,frame=null,weave=null;

  /* ---- a stepped diamond, the staircase outline of Maya fretwork ---- */
  function stepped(c,cx,cy,r,steps){
    const st=r/steps; c.beginPath();
    for(let q=0;q<4;q++){
      const sx=[1,-1,-1,1][q], sy=[1,1,-1,-1][q];
      for(let s=0;s<=steps;s++){
        const x=(r-s*st)*sx, y=s*st*sy;
        if(q===0&&s===0) c.moveTo(cx+x,cy+y); else c.lineTo(cx+x,cy+y);
        if(s<steps) c.lineTo(cx+(r-(s+1)*st)*sx,cy+y);
      }
    }
    c.closePath();
  }
  /* the fractal: a diamond, then four half-size diamonds at its quarter points, recursively */
  function motif(c,cx,cy,r,depth,phase,dark){
    const col=k=>{const ph=phase+k, i=((Math.floor(ph)%PAL.length)+PAL.length)%PAL.length, f=ph-Math.floor(ph), a=PAL[i], b=PAL[(i+1)%PAL.length];
      return a.map((v,n)=>(v+(b[n]-v)*f)*(dark?.5:.85)+(dark?8:30))};
    for(let k=0;k<3;k++){ c.fillStyle=css(col(k*.9)); stepped(c,cx,cy,r*(1-k*.3),Math.max(2,6-k*2)); c.fill() }
    if(depth>0) for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]) motif(c,cx+dx*r*.5,cy+dy*r*.5,r*.42,depth-1,phase+1.7,dark);
  }
  function textile(c,t,dark){
    const cell=W<700?150:210, cols=Math.ceil(W/cell)+2, rows=Math.ceil(H/(cell*.5))+3;
    c.fillStyle=dark?'#14110d':'#efe2c4'; c.fillRect(0,0,W,H);
    for(let j=-1;j<rows;j++) for(let i=-1;i<cols;i++){
      const cx=i*cell+(j%2?cell/2:0), cy=j*cell*.5, far=Math.hypot(cx-W/2,cy-H/2)/cell;
      motif(c,cx,cy,cell*.5,2,-far*.6+t*.1,dark);
    }
    c.save(); c.globalAlpha=dark?.55:.5; c.fillStyle=c.createPattern(weave,'repeat'); c.fillRect(0,0,W,H); c.restore();
    c.fillStyle=dark?'rgba(12,16,14,.42)':'rgba(246,238,218,.52)'; c.fillRect(0,0,W,H);   // a veil, so the textile stays a murmur
  }
  /* thread weave: alternate warp and weft floats, with a little irregularity in every thread */
  function makeWeave(dark){
    const r=rng(9); weave=document.createElement('canvas'); weave.width=weave.height=48;
    const c=weave.getContext('2d');
    for(let y=0;y<48;y+=4) for(let x=0;x<48;x+=4){
      const over=((x+y)/4)%2===0, l=.06+r()*.08;
      c.fillStyle=over?`rgba(255,250,235,${l})`:`rgba(0,0,0,${l*1.5})`;
      if(over) c.fillRect(x,y+.5,4,3); else c.fillRect(x+.5,y,3,4);
    }
  }

  /* ---- ferns: Barnsley's IFS, a few hundred thousand points per frond ---- */
  function fern(c,x,y,h,ang,col,seed,n){
    const r=rng(seed); let px=0,py=0;
    c.save(); c.translate(x,y); c.rotate(ang); c.fillStyle=col;
    const s=h/10;
    for(let i=0;i<n;i++){
      const p=r(); let nx,ny;
      if(p<.01){nx=0;ny=.16*py}
      else if(p<.86){nx=.85*px+.04*py;ny=-.04*px+.85*py+1.6}
      else if(p<.93){nx=.2*px-.26*py;ny=.23*px+.22*py+1.6}
      else{nx=-.15*px+.28*py;ny=.26*px+.24*py+.44}
      px=nx;py=ny;
      if(i>20) c.fillRect(px*s,-py*s,1.1,1.1);
    }
    c.restore();
  }
  /* ---- vines: a curving stem that branches recursively, each branch ending in a tendril spiral ---- */
  function vine(c,x,y,len,ang,w,depth,r,col){
    const ex=x+Math.cos(ang)*len, ey=y+Math.sin(ang)*len, bend=(r()-.5)*.9;
    c.strokeStyle=col; c.lineWidth=w; c.lineCap='round';
    c.beginPath(); c.moveTo(x,y); c.quadraticCurveTo(x+Math.cos(ang+bend)*len*.6,y+Math.sin(ang+bend)*len*.6,ex,ey); c.stroke();
    if(depth===0){
      c.lineWidth=Math.max(.6,w*.8); c.beginPath(); const dir=r()<.5?1:-1;
      for(let k=0;k<=1.0001;k+=.04){const a=ang+dir*k*Math.PI*3, rr=len*.35*(1-k); const px=ex+Math.cos(a)*rr-Math.cos(ang)*len*.35*0, py=ey+Math.sin(a)*rr; k?c.lineTo(px,py):c.moveTo(px,py)}
      c.stroke(); return;
    }
    vine(c,ex,ey,len*.72,ang+(.35+r()*.3),w*.7,depth-1,r,col);
    vine(c,ex,ey,len*.72,ang-(.35+r()*.3),w*.7,depth-1,r,col);
  }
  function trumpet(c,x,y,len,ang,col){   // a hanging angel's trumpet: a long tube flaring to a five-pointed mouth
    c.save(); c.translate(x,y); c.rotate(ang);
    c.strokeStyle='#2f4a24'; c.lineWidth=2; c.beginPath(); c.moveTo(0,-len*.3); c.lineTo(0,0); c.stroke();
    const g=c.createLinearGradient(0,0,0,len); g.addColorStop(0,'#e9e6c8'); g.addColorStop(1,col);
    c.fillStyle=g; c.beginPath(); c.moveTo(-len*.06,0); c.lineTo(len*.06,0); c.quadraticCurveTo(len*.08,len*.6,len*.3,len);
    for(let k=0;k<5;k++){const a=k/4; c.lineTo(len*(.3-.6*a)-(k%2?0:len*.02),len*(1+(k%2?.06:.12)))}
    c.quadraticCurveTo(-len*.08,len*.6,-len*.06,0); c.closePath(); c.fill();
    c.strokeStyle='rgba(120,70,40,.35)'; c.lineWidth=1; for(const dx of [-.12,0,.12]){c.beginPath(); c.moveTo(0,len*.1); c.lineTo(len*dx*1.8,len*.98); c.stroke()}
    c.restore();
    return [x-Math.sin(ang)*len*1.08, y+Math.cos(ang)*len*1.08];
  }
  /* the sword-billed hummingbird in silhouette, hovering upright, bill raised into the flower */
  function swordbill(c,mx,my,s,dark){
    const bl=46, ba=-1.25;                         // bill longer than the body, angled steeply up
    const hx=mx-Math.cos(ba)*bl*s, hy=my-Math.sin(ba)*bl*s;
    c.save(); c.translate(hx,hy); c.scale(s,s);
    const g=c.createLinearGradient(-6,-6,-14,30); g.addColorStop(0,dark?'#7fb27a':'#2f5e38'); g.addColorStop(1,dark?'#3a6a40':'#163022');
    c.fillStyle=g; c.strokeStyle=g;
    c.lineCap='round'; c.lineWidth=1.6; c.beginPath(); c.moveTo(0,0); c.lineTo(Math.cos(ba)*bl,Math.sin(ba)*bl); c.stroke();     // bill
    c.beginPath(); c.arc(-1.5,2,4.6,0,6.283); c.fill();                                                                         // head
    c.beginPath(); c.moveTo(1,4); c.bezierCurveTo(2,14,-4,26,-9,34); c.bezierCurveTo(-12,26,-9,12,-5,2); c.closePath(); c.fill();   // body
    c.beginPath(); c.moveTo(-9,32); c.lineTo(-15,44); c.lineTo(-9,40); c.lineTo(-5,45); c.lineTo(-6,33); c.closePath(); c.fill();  // tail
    // wings: hovering, they sweep wide either side of the shoulders; each is a sharp edge trailing into blur
    for(const side of [-1,1]){
      for(const [sw,al] of [[0,.85],[.35,.35],[.7,.15]]){
        c.save(); c.translate(-2,9); c.rotate(side*(1.15+sw)); c.globalAlpha=al;
        c.beginPath(); c.moveTo(0,0); c.quadraticCurveTo(-4,-14,2,-30); c.quadraticCurveTo(5,-14,4,0); c.closePath(); c.fill(); c.restore();
      }
    }
    c.globalAlpha=1; c.fillStyle=dark?'#e8f0e0':'#f5f2e6'; c.beginPath(); c.arc(0,1,.8,0,6.283); c.fill();                          // eye glint
    c.restore();
  }

  /* the frame, painted once: ferns and vines along the edges, two trumpets, the bird */
  function paintFrame(dark){
    const r=rng(1492); frame=document.createElement('canvas'); frame.width=cv.width; frame.height=cv.height;
    const c=frame.getContext('2d'); c.setTransform(dpr,0,0,dpr,0,0);
    const M=Math.max(60,(W-980)/2), big=Math.min(W,H), pts=W<700?60000:140000;
    const G=dark?['rgba(76,140,84,.55)','rgba(52,110,66,.55)','rgba(98,160,96,.5)']:['rgba(40,96,52,.55)','rgba(30,80,42,.55)','rgba(62,118,60,.5)'];
    // ferns rising from the bottom corners and reaching in from the sides
    fern(c,M*.25,H+10,big*.42,-.35,G[0],1,pts);
    fern(c,W-M*.25,H+10,big*.42,.35,G[1],2,pts);
    fern(c,-10,H*.55,big*.3,.95,G[2],3,pts*.7);
    fern(c,W+10,H*.5,big*.3,-.95,G[0],4,pts*.7);
    fern(c,M*.1,-10,big*.26,Math.PI-.5,G[1],5,pts*.5);
    fern(c,W-M*.1,-10,big*.26,Math.PI+.5,G[2],6,pts*.5);
    // vines hanging from the top
    const vc=dark?'rgba(120,170,110,.55)':'rgba(46,92,46,.6)';
    for(const [x,len] of [[M*.55,big*.12],[W-M*.5,big*.14]]) vine(c,x,-6,len,Math.PI/2+(r()-.5)*.3,2.6,5,r,vc);
    // a trumpet on the left, and on the right the swordbill's, which it feeds from
    trumpet(c,M*.82,H*.28,Math.min(80,H*.09),.1,'#f0d27a');
    const mouth=trumpet(c,W-M*.42,H*.34,Math.min(84,H*.1),-.05,'#f2b27a');
    if(M>70) swordbill(c,mouth[0],mouth[1]-3,M>150?2.3:1.5,dark);
  }

  function size(){dpr=Math.min(2,devicePixelRatio||1); W=cv.clientWidth; H=innerHeight; cv.width=Math.round(W*dpr); cv.height=Math.round(H*dpr); const dark=root.dataset.theme!=='light'; makeWeave(dark); paintFrame(dark)}
  function draw(t){
    const c=cv.getContext('2d'), dark=root.dataset.theme!=='light';
    c.setTransform(dpr,0,0,dpr,0,0);
    textile(c,t,dark);
    c.setTransform(1,0,0,1,0,0); c.drawImage(frame,0,0);
  }
  let last=0,t0=performance.now();
  function loop(ts){ if(!document.hidden&&ts-last>120){last=ts;draw((ts-t0)/1000)} requestAnimationFrame(loop) }
  let rt; addEventListener('resize',()=>{clearTimeout(rt);rt=setTimeout(()=>{size();draw((performance.now()-t0)/1000)},200)});

  /* dark by default; light only when the visitor picks it (remembered in this browser) */
  const btn=document.getElementById('mode');
  const set=m=>{if(m==='light')root.dataset.theme='light';else delete root.dataset.theme;if(btn)btn.textContent=m==='light'?'Dark':'Light';size();draw((performance.now()-t0)/1000)};
  let m='dark';try{m=localStorage.getItem('bm-theme')||'dark'}catch(e){}
  if(btn)btn.onclick=()=>{m=m==='dark'?'light':'dark';try{localStorage.setItem('bm-theme',m)}catch(e){}set(m)};
  set(m); if(!still) requestAnimationFrame(loop);
})();

