/* More pictures for the hub's datamosh to work on, cut together like a video.
   Scenes: the Mandelbrot zoom (drawn by mandel.js); a Julia set whose shape keeps changing (its c travels slowly
   round a circle just inside the main cardioid, where the shapes are richest); pastel marbling (warped noise,
   folding over itself); and photographs, if the library has any (assets/library.json, written by
   tools/photos.py: each slowly pushed in and panned, the Ken Burns way, washed a little towards pastel).
   Every 12 to 16 seconds it cuts to the next scene, and asks the mosh to bleed the cut: for two or three seconds
   the old picture is dragged along the new one's motion and the new one shows through block by block, which is
   what a datamosh does to a cut. HubScenes(gl, mosh) -> {draw(t, drawMandel)}. */
(function(){
  const VS=`#version 300 es
in vec2 a; void main(){ gl_Position=vec4(a,0.,1.); }`;
  const HEAD=`#version 300 es
precision highp float;
uniform vec2 res; uniform float t; out vec4 o;
vec3 pal(float x){ return .5+.5*cos(6.2831*(x+vec3(.0,.12,.3))); }
vec3 pastel(vec3 c){ return mix(c,vec3(.95,.92,.96),.5); }
float hash(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
float noise(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*f*(f*(f*6.-15.)+10.);
  return mix(mix(hash(i),hash(i+vec2(1,0)),u.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x),u.y); }
float fbm(vec2 p){ float s=0., a=.5; for(int i=0;i<5;i++){ s+=a*noise(p); p=mat2(.8,.6,-.6,.8)*p*2.02+1.7; a*=.5; } return s; }
`;
  const JULIA=HEAD+`
void main(){
  vec2 p=(gl_FragCoord.xy-.5*res)/res.y*2.6;
  float a=t*.045; vec2 c=.7885*vec2(cos(a),sin(a));                       // c on a circle just inside the cardioid
  p=mat2(cos(t*.02),-sin(t*.02),sin(t*.02),cos(t*.02))*p;
  vec2 z=p; float n=0.;
  for(int i=0;i<160;i++){ z=vec2(z.x*z.x-z.y*z.y,2.*z.x*z.y)+c; if(dot(z,z)>64.) break; n+=1.; }
  vec3 col;
  if(n>=159.) col=vec3(.12,.1,.16);
  else { float l=log(n+1.-log2(log2(dot(z,z)))*.5+1.); col=pastel(pal(l*1.3-t*.004)); col*=.8+.2*smoothstep(.0,.6,fract(l*6.)); }
  vec2 v=gl_FragCoord.xy/res-.5; o=vec4(col*(1.-dot(v,v)*.6),1.);
}`;
  const MARBLE=HEAD+`
void main(){
  vec2 uv=gl_FragCoord.xy/res.y*1.6; float T=t*.05;
  vec2 q=vec2(fbm(uv+T),fbm(uv+vec2(5.2,1.3)-T));
  vec2 r=vec2(fbm(uv+3.*q+vec2(1.7,9.2)+T*.6),fbm(uv+3.*q+vec2(8.3,2.8)-T*.5));
  float f=fbm(uv+3.5*r);
  vec3 col=pastel(pal(f*1.6+length(q)*.8+T*.2));
  col*=.78+.22*smoothstep(.2,.8,f);
  vec2 v=gl_FragCoord.xy/res-.5; o=vec4(col*(1.-dot(v,v)*.6),1.);
}`;
  const PHOTO=`#version 300 es
precision highp float;
uniform vec2 res, isz; uniform float k; uniform vec2 pan; uniform sampler2D img; out vec4 o;
void main(){
  vec2 uv=gl_FragCoord.xy/res; uv.y=1.-uv.y;
  float sr=res.x/res.y, ir=isz.x/isz.y; vec2 s=sr>ir?vec2(1.,ir/sr):vec2(sr/ir,1.);   // cover the screen
  float z=1.06+.1*k; vec2 q=(uv-.5)*s/z+.5+pan*k*.04;
  vec3 c=texture(img,q).rgb; c=mix(c,vec3(.95,.93,.96),.18);
  vec2 v=gl_FragCoord.xy/res-.5; o=vec4(c*(1.-dot(v,v)*.5),1.);
}`;
  window.HubScenes=function(gl,mosh){
    const sh=(type,src)=>{const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);return s};
    const prog=fs=>{const p=gl.createProgram();gl.attachShader(p,sh(gl.VERTEX_SHADER,VS));gl.attachShader(p,sh(gl.FRAGMENT_SHADER,fs));gl.bindAttribLocation(p,0,'a');gl.linkProgram(p);return gl.getProgramParameter(p,gl.LINK_STATUS)?p:null};
    const pj=prog(JULIA), pm=prog(MARBLE), pp=prog(PHOTO);
    const U=(p,n)=>gl.getUniformLocation(p,n);
    const scenes=[{kind:'mandel'}];
    if(pj) scenes.push({kind:'shader',p:pj});
    if(pm) scenes.push({kind:'shader',p:pm});
    // photographs, if there are any, interleaved with the rest
    let photos=[], loaded=[];
    if(pp) fetch(new URL('assets/library.json',document.baseURI)).then(r=>r.ok?r.json():[]).then(list=>{
      photos=(Array.isArray(list)?list:list.photos||[]).filter(x=>x&&x.src).sort(()=>Math.random()-.5).slice(0,12);
      photos.forEach((ph,i)=>{ const im=new Image(); im.decoding='async'; im.onload=()=>{
        const tx=gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D,tx); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);
        gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,im);
        for(const [a,b] of [[gl.TEXTURE_MIN_FILTER,gl.LINEAR],[gl.TEXTURE_MAG_FILTER,gl.LINEAR],[gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE],[gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D,a,b);
        loaded.push({kind:'photo',tx,w:im.naturalWidth,h:im.naturalHeight,pan:[Math.random()-.5,Math.random()-.5]});
      }; im.src=new URL(ph.src,document.baseURI).href });
    }).catch(()=>{});
    let idx=0, cutT=0, next=14, n=0;
    function pickNext(){
      // alternate: a photograph (if any have loaded) between the generated scenes
      n++;
      if(loaded.length&&n%2===0) return loaded[(n/2|0)%loaded.length];
      idx=(idx+1)%scenes.length; return scenes[idx];
    }
    let cur=scenes[0];
    return {
      draw(t,drawMandel){
        if(t>next){ cur=pickNext(); cutT=t; next=t+12+Math.random()*4;
          const a=Math.random()*Math.PI*2; mosh.cut(t,[Math.cos(a)*(1.2+Math.random()*1.6),Math.sin(a)*(1.2+Math.random()*1.6)],Math.random()<.5?(Math.random()-.5)*4:0) }
        if(cur.kind==='mandel') return drawMandel();
        if(cur.kind==='shader'){ gl.useProgram(cur.p); gl.uniform2f(U(cur.p,'res'),...mosh.size()); gl.uniform1f(U(cur.p,'t'),t); gl.drawArrays(gl.TRIANGLES,0,3); return }
        gl.useProgram(pp); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D,cur.tx); gl.uniform1i(U(pp,'img'),0);
        gl.uniform2f(U(pp,'res'),...mosh.size()); gl.uniform2f(U(pp,'isz'),cur.w,cur.h); gl.uniform1f(U(pp,'k'),Math.min(1,(t-cutT)/16)); gl.uniform2f(U(pp,'pan'),cur.pan[0],cur.pan[1]);
        gl.drawArrays(gl.TRIANGLES,0,3);
      }
    };
  };
})();
