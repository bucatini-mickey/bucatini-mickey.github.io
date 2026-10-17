/* The hub's backdrop: a slow cut-up of patterns and photographs, datamoshed (assets/mosh.js).
   Scenes, each a small shader:
   - the whole Mandelbrot set, symmetrical about its axis, breathing slowly in and out (the page opens on it);
   - stepped diamonds, as woven in Andean textiles: concentric stepped rings in cochineal, indigo, jade, ochre
     and maize, the diamonds alternating colourways like a checker; the corners between them hold the same
     pattern three times smaller, and so on down, so the view can sink into it forever (a loop of exactly one
     3x zoom joins up with no seam);
   - Julia sets, symmetrical, their shape changing as their c travels a slow path (a different path each time);
   - ink: pastel marbling folding over itself;
   - photographs from jsonsummers.github.io's assets/library.json (made by its tools/photos.py) tagged for the hub, slowly pushed in and
     panned, with one of the joke photographs slipped in now and then.
   Every 12 to 16 seconds it cuts to the next, and the cut is bled the datamosh way. Nothing heavy loads first:
   the stepped diamonds start at once, and photographs are fetched one at a time, just before they are shown,
   small on phones. Slow machines lose the mosh, then resolution; reduced motion shows one still frame.
   Every shader hashes with integers, so it looks the same whatever a GPU does with float precision. */
(function(){
  const cv=document.getElementById('fractal'); if(!cv) return;
  const q=new URLSearchParams(location.search), gfx=q.get('gfx')||'';
  const still=matchMedia('(prefers-reduced-motion: reduce)').matches||gfx==='still';
  cv.style.background='radial-gradient(120% 90% at 50% 40%,#c9b9d8,#7d6f99 45%,#2b2440)';   // shown until the first frame
  const VS=`#version 300 es
in vec2 a; void main(){ gl_Position=vec4(a,0.,1.); }`;
  const HEAD=`#version 300 es
precision highp float;
uniform vec2 res; uniform float t; out vec4 o;
float hash(vec2 p){ uvec2 v=floatBitsToUint(p)*1664525u+1013904223u; v.x+=v.y*1664525u; v.y+=v.x*1664525u; v^=v>>16u;
  v.x+=v.y*1664525u; v.y+=v.x*1664525u; v^=v>>16u; return float((v.x^v.y)>>8)/16777216.; }
float noise(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*f*(f*(f*6.-15.)+10.);
  return mix(mix(hash(i),hash(i+vec2(1,0)),u.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x),u.y); }
float fbm(vec2 p){ float s=0., a=.5; for(int i=0;i<5;i++){ s+=a*noise(p); p=mat2(.8,.6,-.6,.8)*p*2.02+1.7; a*=.5; } return s; }
vec3 pal(float x){ return .5+.5*cos(6.2831*(x+vec3(.0,.12,.3))); }
vec3 pastel(vec3 c){ return mix(c,vec3(.95,.92,.96),.45); }
vec3 vig(vec3 c){ vec2 v=gl_FragCoord.xy/res-.5; return c*(1.-dot(v,v)*.6); }
`;
  const FRET=HEAD+`
const vec3 C[6]=vec3[6](vec3(.71,.25,.27),vec3(.2,.31,.55),vec3(.2,.55,.5),vec3(.84,.64,.25),vec3(.93,.86,.68),vec3(.45,.26,.38));
vec3 col6(float i){ return C[int(mod(i,6.))]; }
void main(){
  vec2 p=(gl_FragCoord.xy-.5*res)/res.y;
  p+=.012*sin(p.yx*7.+t*.35);                                             // a slight, slow swim
  float u=fract(t*.03), k=pow(3.,-u)*.9;                                   // one loop is exactly one 3x zoom
  vec3 col=vec3(.62,.55,.6);
  for(int L=-3;L<8;L++){
    vec2 qq=p*k*pow(3.,float(L)), id=floor(qq), c=fract(qq)-.5, a=abs(c);
    float N=10., gx=a.x*2.*N, gy=a.y*2.*N, s=floor(gx)+floor(gy);        // cells of the staircase
    if(s<N){
      float ring=floor(s*.5), par=mod(id.x+id.y,2.), shift=float(L)+floor(t*.03);   // two cell-diagonals make one band; colours move on a step with each level and each loop, so the loop still joins
      col=mod(ring,2.)>.5?mix(C[4],vec3(1.),.25):col6(floor(ring*.5)*(par>.5?2.:-1.)+par*3.+shift);
      // a darker line only where one band meets the next (outward edges of odd cells, inward edges of even ones)
      vec2 f=fract(vec2(gx,gy)); float e=mod(s,2.)>.5?min(1.-f.x,1.-f.y):min(f.x,f.y);
      col*=.84+.16*smoothstep(.0,.14,e);
      if(ring<.5) col=mix(C[4],vec3(1.),.4);                               // a pale heart to every diamond
      break;
    }
  }
  col=mix(col,vec3(.95,.92,.96),.28);
  o=vec4(vig(col),1.);
}`;
  const MANDEL=HEAD+`
void main(){
  vec2 p=(gl_FragCoord.xy-.5*res)/res.y;
  float s=2.5*(1.+.07*sin(t*.06));
  vec2 c=vec2(-.62,0.)+p*s, z=vec2(0.); float n=0.;
  for(int i=0;i<160;i++){ z=vec2(z.x*z.x-z.y*z.y,2.*z.x*z.y)+c; if(dot(z,z)>64.) break; n+=1.; }
  vec3 col;
  if(n>=159.) col=vec3(.13,.11,.17);
  else { float l=log(n+1.-log2(log2(dot(z,z)))*.5+1.); col=pastel(pal(l*1.1-t*.005)); col*=.8+.2*smoothstep(.0,.6,fract(l*6.)); }
  o=vec4(vig(col),1.);
}`;
  const JULIA=HEAD+`
uniform vec2 c; uniform float rot;
void main(){
  vec2 p=(gl_FragCoord.xy-.5*res)/res.y*2.5;
  p=mat2(cos(rot),-sin(rot),sin(rot),cos(rot))*p;
  vec2 z=p; float n=0.;
  for(int i=0;i<140;i++){ z=vec2(z.x*z.x-z.y*z.y,2.*z.x*z.y)+c; if(dot(z,z)>64.) break; n+=1.; }
  vec3 col;
  if(n>=139.) col=vec3(.14,.12,.18);
  else { float l=log(n+1.-log2(log2(dot(z,z)))*.5+1.); col=pastel(pal(l*1.3-t*.004)); col*=.8+.2*smoothstep(.0,.6,fract(l*6.)); }
  o=vec4(vig(col),1.);
}`;
  const INK=HEAD+`
uniform float hue;
void main(){
  vec2 uv=gl_FragCoord.xy/res.y*1.6; float T=t*.05;
  vec2 q=vec2(fbm(uv+T),fbm(uv+vec2(5.2,1.3)-T));
  vec2 r=vec2(fbm(uv+3.*q+vec2(1.7,9.2)+T*.6),fbm(uv+3.*q+vec2(8.3,2.8)-T*.5));
  float f=fbm(uv+3.5*r);
  vec3 col=pastel(pal(f*1.6+length(q)*.8+T*.2+hue));
  col*=.74+.26*smoothstep(.2,.8,f);
  o=vec4(vig(col),1.);
}`;
  const PHOTO=`#version 300 es
precision highp float;
uniform vec2 res, isz; uniform float k; uniform vec2 pan; uniform sampler2D img; out vec4 o;
void main(){
  vec2 uv=gl_FragCoord.xy/res; uv.y=1.-uv.y;
  float sr=res.x/res.y, ir=isz.x/isz.y; vec2 s=sr>ir?vec2(1.,ir/sr):vec2(sr/ir,1.);   // cover the screen
  vec2 q=(uv-.5)*s/(1.06+.1*k)+.5+pan*k*.04;
  vec3 c=texture(img,q).rgb; c=mix(c,vec3(.95,.93,.96),.16);
  vec2 v=gl_FragCoord.xy/res-.5; o=vec4(c*(1.-dot(v,v)*.5),1.);
}`;
  const lowp=s=>gfx==='lowp'?s.replace('precision highp float','precision mediump float'):s;

  function start(){
    const gl=cv.getContext('webgl2',{antialias:false,alpha:false}); if(!gl) return;
    const info=gl.getExtension('WEBGL_debug_renderer_info'), gpu=info?gl.getParameter(info.UNMASKED_RENDERER_WEBGL):'';
    const soft=/swiftshader|llvmpipe|software|basic render/i.test(gpu);
    const par=gl.getExtension('KHR_parallel_shader_compile');
    const sh=(type,src)=>{const s=gl.createShader(type);gl.shaderSource(s,lowp(src));gl.compileShader(s);return s};
    const prog=fs=>{const p=gl.createProgram();gl.attachShader(p,sh(gl.VERTEX_SHADER,VS));gl.attachShader(p,sh(gl.FRAGMENT_SHADER,fs));gl.bindAttribLocation(p,0,'a');gl.linkProgram(p);return p};
    const P={mandel:prog(MANDEL),fret:prog(FRET),julia:prog(JULIA),ink:prog(INK),photo:prog(PHOTO)};   // all compile in parallel where the browser can
    const ok=p=>gl.getProgramParameter(p,gl.LINK_STATUS), done=p=>!par||gl.getProgramParameter(p,par.COMPLETION_STATUS_KHR);
    gl.bindBuffer(gl.ARRAY_BUFFER,gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);
    const U=(p,n)=>gl.getUniformLocation(p,n);
    let quality=soft?.25:1;
    let mosh=!still&&!soft&&window.Mosh&&q.get('mosh')!=='0'?Mosh(gl):null;
    window.__gfx=Object.assign(window.__gfx||{},{hub:{gpu,soft,quality:()=>quality+(mosh?' +mosh':''),canvas:()=>cv.width+'x'+cv.height}});
    function size(){
      const k=Math.min(1,(innerWidth<700?.45:.55)*Math.min(2,devicePixelRatio||1))*quality;
      cv.width=Math.max(2,Math.round(cv.clientWidth*k)); cv.height=Math.max(2,Math.round(cv.clientHeight*k));
      if(mosh) mosh.resize(cv.width,cv.height);
    }
    // photographs live on jsonsummers.github.io (with the Photos and Art pages); fetched one at a time, just before they are needed
    const LIB='https://jsonsummers.github.io/';
    let list=[], jokes=[], next=null, pi=0, ji=0;
    fetch(LIB+'assets/library.json').then(r=>r.ok?r.json():{}).then(d=>{ const all=(d.photos||[]).filter(x=>x.files), tag=t=>all.filter(x=>(x.tags||['home']).includes(t)).sort(()=>Math.random()-.5); list=[...new Map([...tag('home'),...tag('gallery')].map(p=>[p.id,p])).values()].sort(()=>Math.random()-.5); jokes=tag('joke'); load() }).catch(()=>{});
    function load(){
      if(!list.length||next) return;
      const ph=jokes.length&&Math.random()<.18?jokes[ji++%jokes.length]:list[pi++%list.length], im=new Image(); im.decoding='async'; im.crossOrigin='anonymous';   // from the other site, which allows it   // now and then, a joke
      im.onload=()=>{ const tx=gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D,tx); gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,im);
        for(const [a,b] of [[gl.TEXTURE_MIN_FILTER,gl.LINEAR],[gl.TEXTURE_MAG_FILTER,gl.LINEAR],[gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE],[gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D,a,b);
        next={kind:'photo',tx,w:im.naturalWidth,h:im.naturalHeight,pan:[Math.random()-.5,Math.random()-.5],alt:ph.alt||''} };
      im.src=LIB+ph.files[innerWidth<700?640:1280];
    }
    // the running order is random: a photograph about half the time, otherwise a generated scene, never the same
    // kind twice running; the page opens on the room you came from (bar.js keeps a small picture of it), or on the
    // Mandelbrot set
    // what is shown: photographs, mostly, and now and then the ink. The Mandelbrot, Julia and stepped-diamond
    // patterns are never shown; mosh.js uses them only to steer the melting between pictures
    const GEN=['ink'];
    const JPATH=[t=>[.7885*Math.cos(t*.045),.7885*Math.sin(t*.045)], t=>[-.8+.12*Math.sin(t*.05),.156+.04*Math.cos(t*.07)], t=>[-.745+.02*Math.sin(t*.06),.113+.03*Math.cos(t*.05)], t=>[.285+.02*Math.sin(t*.05),.01+.02*Math.cos(t*.04)]];
    const t0=performance.now();
    let cur={kind:'ink',hue:Math.random()}, cutAt=2.5,  old=null, waitLast=false;
    try{ const last=JSON.parse(sessionStorage.getItem('bm-last-bg')||'null'); sessionStorage.removeItem('bm-last-bg');
      if(last&&Date.now()-last.at<120000){ waitLast=true; cv.style.background=`center/cover no-repeat url(${last.src})`; setTimeout(()=>{waitLast=false},1500);
        const im=new Image(); im.onload=()=>{ waitLast=false; if(cur.kind!=='ink'||performance.now()-t0>4000) return;
        const tx=gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D,tx); gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,im);
        for(const [a,b] of [[gl.TEXTURE_MIN_FILTER,gl.LINEAR],[gl.TEXTURE_MAG_FILTER,gl.LINEAR],[gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE],[gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D,a,b);
        cur={kind:'photo',tx,w:im.naturalWidth,h:im.naturalHeight,pan:[0,0],still:true,t0:0}; cutAt=(performance.now()-t0)/1000+1.5+Math.random()*1.5 }; im.src=last.src } }catch(e){}
    function pick(t){
      if(next&&(cur.kind!=='photo'||Math.random()<.82)){ const s=next; next=null; setTimeout(load,1500); return s }   // photo after photo, with the odd ink between
      if(cur.kind==='ink') return null;
      const k='ink';
      return k==='julia'?{kind:k,path:JPATH[Math.floor(Math.random()*JPATH.length)],rot:Math.random()*6.28}:k==='ink'?{kind:k,hue:Math.random()}:{kind:k};
    }
    function draw(t){
      if(t>cutAt){ const s=pick(t); if(s){ if(old&&old.tx&&old!==s) gl.deleteTexture(old.tx); old=cur; cur=s; cur.t0=t; dispatchEvent(new CustomEvent('hubscene',{detail:cur.kind==='photo'?(cur.alt||''):'Ink, folding over itself'})) }
        else { cutAt=t+1; return draw.call(this,t) }
        cutAt=t+8+Math.random()*14;                                            // irregular: 8 to 22 seconds
        if(mosh) mosh.cut(t) }
      const p=P[cur.kind]; if(!done(p)||!ok(p)) { if(cur.kind!=='ink'&&done(P.ink)&&ok(P.ink)) cur={kind:'ink',hue:0}; else return false }
      if(mosh) mosh.target(); else { gl.bindFramebuffer(gl.FRAMEBUFFER,null); gl.viewport(0,0,cv.width,cv.height) }
      gl.useProgram(p); gl.uniform2f(U(p,'res'),cv.width,cv.height);
      if(cur.kind==='photo'){ gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D,cur.tx); gl.uniform1i(U(p,'img'),0);
        gl.uniform2f(U(p,'isz'),cur.w,cur.h); gl.uniform1f(U(p,'k'),cur.still?0:Math.min(1,(t-(cur.t0||t))/16)); gl.uniform2f(U(p,'pan'),cur.pan[0],cur.pan[1]) }
      else gl.uniform1f(U(p,'t'),t);
      if(cur.kind==='julia'){ gl.uniform2f(U(p,'c'),...cur.path(t)); gl.uniform1f(U(p,'rot'),cur.rot+t*.01) }
      if(cur.kind==='ink') gl.uniform1f(U(p,'hue'),cur.hue);
      gl.drawArrays(gl.TRIANGLES,0,3);
      if(mosh) mosh.step(t);
      return true;
    }
    let last=0, slow=0, run=!still, shown=false;
    function loop(ts){
      if(!document.hidden&&ts-last>33){ const gap=ts-last; last=ts;
        if(!waitLast&&draw((ts-t0)/1000)&&!shown){ shown=true; cv.style.background='' }
        if(gap>80&&gap<1000){ if(++slow>20){ slow=0; if(mosh){mosh=null} else if(quality>.3){quality/=2} else run=false; size() } } else slow=Math.max(0,slow-1) }
      if(run||!shown) requestAnimationFrame(loop);
    }
    addEventListener('resize',size);
    size(); requestAnimationFrame(loop);
  }
  requestAnimationFrame(()=>setTimeout(start,0));
})();
