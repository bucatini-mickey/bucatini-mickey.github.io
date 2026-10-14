/* A world for the Games page, made fresh in the browser on every visit (a few tens of milliseconds), in the
   manner of Tachyon's world editor: mountains in the north falling to a coast and the sea in the south.
   Height: a broad slope from north to south, rolling noise, and ridged noise for the ranges; the land is pressed
   down along the southern edge so the sea is always there to scroll down to.
   Rivers: springs on high, wet ground, each following the steepest way down to the sea; where one is caught in a
   hollow it fills a small lake and spills over its lowest side; they widen as they gather length, and join.
   Ground: beaches and shallows along the coast; snow and bare rock on the heights; moor on dry hills; marsh by
   the lowland rivers; forest in clusters where it is wet, single trees out on the grass; meadows of flowers.
   Light falls from the north-west, so every slope is shaded. WorldGen(seed, w, h) -> {w, h, seed, cells}. */
(function(){
  function rng(seed){let s=seed>>>0;return()=>{s=s+0x6D2B79F5|0;let t=Math.imul(s^s>>>15,1|s);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
  function noise(seed){const r=rng(seed),T=new Float32Array(4096);for(let i=0;i<4096;i++)T[i]=r();
    const h=(x,y)=>T[(Math.imul(x,374761393)^Math.imul(y,668265263))>>>20&4095], f=t=>t*t*t*(t*(t*6-15)+10);
    const n=(x,y)=>{const X=Math.floor(x),Y=Math.floor(y),u=f(x-X),v=f(y-Y);return (h(X,Y)*(1-u)+h(X+1,Y)*u)*(1-v)+(h(X,Y+1)*(1-u)+h(X+1,Y+1)*u)*v};
    return (x,y,o=5)=>{let s=0,a=.5,w=0;for(let i=0;i<o;i++){s+=a*n(x,y);w+=a;x=x*2.03+17.1;y=y*2.03+3.7;a*=.5}return s/w}}
  const sm=(a,b,x)=>{const t=Math.min(1,Math.max(0,(x-a)/(b-a)));return t*t*(3-2*t)};
  window.WorldGen=function(seed,W,H){
    const r=rng(seed), nE=noise(seed), nR=noise(seed+1), nM=noise(seed+2), nF=noise(seed+3), nT=noise(seed+4);
    const E=new Float32Array(W*H), M=new Float32Array(W*H), SEA=.34;
    for(let y=0;y<H;y++) for(let x=0;x<W;x++){
      const v=y/H, north=1-v, ridge=1-Math.abs(2*nR(x/22,y/18,4)-1);
      let e=.42*nE(x/34,y/26)+.5*Math.pow(north,1.15)+.3*ridge*ridge*sm(.35,.9,north)-.12;
      e-=.42*sm(.62,.97,v)*(.55+.9*nE(x/16+40,3,3));                       // the coast and the sea along the south, with bays and headlands
      const lift=sm(.5,.3,v); if(lift>0&&e<SEA+.03) e+=lift*(SEA+.03+(.6-v)*.3+(e-SEA)*.1-e);   // no inland seas: low ground in the north stays land, still sloping south
      E[y*W+x]=e; M[y*W+x]=nM(x/26+90,y/22);
    }
    const kind=new Uint8Array(W*H);                                         // 0 land, 1 river, 2 lake
    const at=(x,y)=>y*W+x, inb=(x,y)=>x>=0&&y>=0&&x<W&&y<H;
    // rivers
    const springs=[];
    for(let tries=0;tries<4000&&springs.length<Math.round(W*H/2200);tries++){
      const x=Math.floor(r()*W), y=Math.floor(r()*H*.45), i=at(x,y);
      if(E[i]>.62&&E[i]<.86&&M[i]>.45&&!springs.some(s=>Math.hypot(s[0]-x,s[1]-y)<14)) springs.push([x,y]);
    }
    for(const [sx,sy] of springs){
      let x=sx,y=sy,len=0,lakes=0; const seen=new Set(), own=new Set();
      while(inb(x,y)&&E[at(x,y)]>=SEA&&len<600){
        const i=at(x,y); seen.add(i);
        if(kind[i]&&!own.has(i)&&len>3) break;                              // joined another river
        kind[i]=kind[i]||1; own.add(i); len++;
        if(len>22){ const px=x+(len%2?1:0), py=y+(len%2?0:1); if(inb(px,py)&&kind[at(px,py)]===0){ kind[at(px,py)]=1; own.add(at(px,py)) } }   // wider downstream
        let bx=-1,by=-1,be=1e9;
        for(const [dx,dy] of [[0,1],[1,0],[-1,0],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]]){
          const nx=x+dx, ny=y+dy; if(!inb(nx,ny)||seen.has(at(nx,ny))) continue;
          const ne=E[at(nx,ny)]+(dx&&dy?.002:0)-dy*.0015+(r()-.5)*.004;   // a slight pull south, so they never wander on flats
          if(ne<be){be=ne;bx=nx;by=ny}
        }
        if(bx<0) break;
        if(be>=E[i]){                                                        // caught in a hollow: a small lake the first time, then cut through
          if(!lakes++&&len>10&&r()<.6){ const rad=1+Math.floor(r()*2);
          for(let dy=-rad;dy<=rad;dy++) for(let dx=-rad*2;dx<=rad*2;dx++){ const nx=x+dx,ny=y+dy; if(inb(nx,ny)&&(dx*dx/4+dy*dy)<=rad*rad+.5) kind[at(nx,ny)]=2 } }
          E[at(bx,by)]=E[i]-.001;
        }
        x=bx; y=by;
      }
    }
    // ground, colour and light
    const cells=new Array(W*H), FLOW=[[236,206,92],[214,120,168],[244,240,232],[168,146,232],[232,140,74]];
    const tint=(c,k)=>c.map(v=>Math.max(0,Math.min(255,v*k)));
    for(let y=0;y<H;y++) for(let x=0;x<W;x++){
      const i=at(x,y), e=E[i], m=M[i], q=r();
      const light=Math.max(.62,Math.min(1.3,1+(E[at(Math.max(0,x-1),Math.max(0,y-1))]-e)*9));   // light from the north-west
      let g,fg,bg=[0,0,0];
      if(e<SEA){ const deep=e<SEA-.07; g=deep?'~':'-'; fg=deep?[70,120,200]:[130,196,226]; bg=deep?[18,44,104]:[40,104,150] }
      else if(kind[i]){ g='~'; fg=kind[i]===2?[96,150,214]:[120,182,232]; bg=kind[i]===2?[26,62,126]:[34,84,150] }
      else if(e<SEA+.022){ g='.'; fg=tint([226,208,150],light) }
      else if(e>.88){ g='*'; fg=tint([238,242,248],light) }
      else if(e>.76){ g='^'; fg=tint([150,144,140].map(v=>v+(q-.5)*20),light) }
      else {
        const nearRiver=[[1,0],[-1,0],[0,1],[0,-1],[2,0],[-2,0]].some(([dx,dy])=>inb(x+dx,y+dy)&&kind[at(x+dx,y+dy)]);
        const forest=nF(x/9,y/7,4)+m*.5;
        if(e<SEA+.1&&(m>.6||nearRiver&&m>.48)&&q<.85){ g='Y'; fg=tint([96,146,112],light) }
        else if(e>.62&&m<.42){ g=','; fg=tint([150,112,156],light) }
        else if(forest>.9){ g='&'; fg=tint([38+q*30,104+q*40,48],light) }
        else if(nT(x/5,y/4,3)>.67&&m<.62){ g='%'; fg=FLOW[Math.floor(q*FLOW.length)] }
        else if(q<.035+.06*m){ g='&'; fg=tint([52,122,58],light) }           // a single tree out on the grass
        else { g='"'; fg=tint([92+q*30,160+q*25,72],light) }
      }
      cells[i]={g,fg,bg};
    }
    return {w:W,h:H,seed,cells};
  };
})();
