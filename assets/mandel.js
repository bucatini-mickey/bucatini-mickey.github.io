/* The hub's backdrop: an endless zoom into the Mandelbrot set, driven by scrolling.
   The zoom is centred on a Misiurewicz point c0: a point whose orbit of 0 falls, after a few steps, onto a
   repelling cycle. Around such a point the set repeats itself exactly, scaled and turned by the cycle's
   multiplier rho, so zooming in by |rho| while turning by arg(rho) brings back the same picture: the loop has
   no seam. Scrolling (and a slow drift) moves along that loop.
   It runs on the GPU in single precision by perturbation: the orbit of c0 itself is known exactly (a few values,
   then a repeating cycle) and each pixel only tracks its small difference from it, so the zoom can go far
   deeper than single precision would otherwise allow. Drawn at reduced resolution; on machines without a
   graphics card it draws one small still frame. Everything else about the page is untouched. */
(function(){
  const cv=document.getElementById('fractal'); if(!cv) return;
  const still=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fallback=()=>{cv.style.background='radial-gradient(120% 90% at 50% 40%,#2b1d4a,#0a0812 70%)'};

  /* candidate points, each found by Newton's method on f^(k+p)(0) = f^k(0); ?pt= picks one for comparison */
  const PTS={
    branch:{c:[-0.101096363845622,0.956286510809142],k:4,p:1,r0:6e-3},    // three arms meeting, turning 120 degrees a step
    seahorse:{c:[-0.775683768009054,0.136467368294690],k:24,p:2,r0:1.2e-3},// Seahorse Valley: spirals of spirals
    tip:{c:[-0.228155493653962,1.115142508039937],k:3,p:2,r0:2.5e-3},     // the end of a branch
  };
  const pick=PTS[new URLSearchParams(location.search).get('pt')]||PTS.seahorse;
  const C0=pick.c, K=pick.k, P=pick.p;
  const orbit=[[0,0]]; for(let n=0;n<K+P;n++){const [x,y]=orbit[n]; orbit.push([x*x-y*y+C0[0],2*x*y+C0[1]])}
  let rho=[1,0]; for(let n=K;n<K+P;n++){const [x,y]=orbit[n]; rho=[rho[0]*2*x-rho[1]*2*y, rho[0]*2*y+rho[1]*2*x]}
  const LOGR=Math.log(Math.hypot(rho[0],rho[1])), ARG=Math.atan2(rho[1],rho[0]);
  const STEPS=Math.max(1,Math.round(Math.log(8)/LOGR));   // whole steps of rho per loop, so one loop is about an 8x zoom

  const VS=`#version 300 es
in vec2 a; void main(){ gl_Position=vec4(a,0.,1.); }`;
  const FS=`#version 300 es
precision highp float;
uniform vec2 res; uniform float u; uniform float t; uniform vec2 ref[${K+P}];
uniform float logr; uniform float arg; uniform float r0; uniform float steps;
out vec4 o;
vec2 cmul(vec2 a, vec2 b){ return vec2(a.x*b.x-a.y*b.y, a.x*b.y+a.y*b.x); }
vec2 Z(int n){ return n<${K+P} ? ref[n] : ref[${K}+((n-${K})%${P})]; }
vec3 pal(float x){ return .5+.5*cos(6.2831*(x+vec3(.0,.12,.3))); }
float shade(vec2 pix, float u){
  // the view at loop position u: scaled by |rho|^-u and turned by -u*arg(rho), so whole steps of u look alike
  float s=r0*exp(-logr*u), th=-arg*u;
  vec2 dc=s*vec2(pix.x*cos(th)-pix.y*sin(th), pix.x*sin(th)+pix.y*cos(th));
  vec2 d=vec2(0.);
  for(int n=0;n<900;n++){
    vec2 zr=Z(n);
    d=2.*cmul(zr,d)+cmul(d,d)+dc;
    vec2 z=Z(n+1)+d;
    float m=dot(z,z);
    if(m>1e4){ return float(n)+1.-log2(.5*log(m)/log(2.)) - logr*u/log(2.)*0.; }
  }
  return -1.;
}
vec3 paint(float n){
  if(n<0.) return vec3(.012,.008,.02);                               // inside: near black
  float l=log(n+1.);
  vec3 col=pal(l*.9 - t*.012);
  col=mix(col,col*col*1.2,.45);                                      // deeper, jewel colours
  float band=fract(l*5.);                                            // fine contour bands, like grain in agate
  col*=.62+.38*smoothstep(.0,.6,band)*smoothstep(1.,.75,band);
  return col*(.35+.65*smoothstep(1.2,3.6,l));                        // the far exterior falls away to dark
}
void main(){
  vec2 pix=(gl_FragCoord.xy-.5*res)/res.y;
  vec3 col=paint(shade(pix,u));
  // near the end of a loop, dissolve into the same view one loop shallower, which is where the next loop begins
  float f=u/steps, w=smoothstep(.7,1.,f);
  if(w>0.) col=mix(col,paint(shade(pix,u-steps)),w);
  vec2 c=gl_FragCoord.xy/res-.5; col*=1.-dot(c,c)*.6;
  o=vec4(col,1.);
}`;
  function start(){
    const gl=cv.getContext('webgl2',{antialias:false}); if(!gl){fallback(); return}
    const info=gl.getExtension('WEBGL_debug_renderer_info'), soft=/swiftshader|llvmpipe|software|basic render/i.test(info?gl.getParameter(info.UNMASKED_RENDERER_WEBGL):'');
    const par=gl.getExtension('KHR_parallel_shader_compile'), pr=gl.createProgram();
    const vs=gl.createShader(gl.VERTEX_SHADER), fs=gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(vs,VS); gl.shaderSource(fs,FS); gl.compileShader(vs); gl.compileShader(fs);
    gl.attachShader(pr,vs); gl.attachShader(pr,fs); gl.linkProgram(pr);
    (function wait(){ if(par&&!gl.getProgramParameter(pr,par.COMPLETION_STATUS_KHR)) return requestAnimationFrame(wait);
      if(!gl.getProgramParameter(pr,gl.LINK_STATUS)){ console.warn('fractal shader:',gl.getShaderInfoLog(fs)||gl.getProgramInfoLog(pr)); fallback(); return }
      go() })();
    function go(){
      gl.useProgram(pr);
      gl.bindBuffer(gl.ARRAY_BUFFER,gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);
      const loc=gl.getAttribLocation(pr,'a'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc,2,gl.FLOAT,false,0,0);
      const U=n=>gl.getUniformLocation(pr,n);
      gl.uniform2fv(U('ref'),new Float32Array(orbit.slice(0,K+P).flat()));
      gl.uniform1f(U('logr'),LOGR); gl.uniform1f(U('arg'),ARG); gl.uniform1f(U('r0'),pick.r0); gl.uniform1f(U('steps'),STEPS);
      let quality=soft&&!location.search.includes('fq')?.2:1;
      function size(){
        const k=Math.min(1,(innerWidth<700?.45:.55)*Math.min(2,devicePixelRatio||1))*quality;
        cv.width=Math.round(cv.clientWidth*k); cv.height=Math.round(cv.clientHeight*k);
        gl.viewport(0,0,cv.width,cv.height); gl.uniform2f(U('res'),cv.width,cv.height);
      }
      const t0=performance.now();
      let lastU=-1;
      function frame(ts){
        const t=(ts-t0)/1000, u=(((scrollY/innerHeight*.9+(still?0:t*.025))%1+1)%1)*STEPS;   // a loop is STEPS whole steps of rho, so it joins up seamlessly
        gl.uniform1f(U('u'),u); gl.uniform1f(U('t'),t); gl.drawArrays(gl.TRIANGLES,0,3); lastU=u;
      }
      let last=0, slow=0, run=true;
      function loop(ts){
        if(!document.hidden&&ts-last>33){ const gap=ts-last; last=ts; frame(ts);
          if(gap>80&&gap<1000){ if(++slow>20){ slow=0; if(quality>.3){quality/=2; size()} else run=false } } else slow=Math.max(0,slow-1) }
        if(run) requestAnimationFrame(loop)
      }
      addEventListener('resize',()=>{size();frame(performance.now())});
      if(still||quality<1) addEventListener('scroll',()=>requestAnimationFrame(frame),{passive:true});
      size(); frame(performance.now()); if(!still&&quality===1) requestAnimationFrame(loop);
    }
  }
  requestAnimationFrame(()=>setTimeout(start,0));
})();
