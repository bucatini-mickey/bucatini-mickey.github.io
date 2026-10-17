/* Datamosh, as a pass over whatever the hub's backdrop draws.
   Video codecs store most frames as instructions to move blocks of the previous frame along motion vectors, plus a
   small correction. When the corrections are lost, old pixels keep getting pushed around: colours drag and smear,
   parts freeze while others move on, and a new picture bleeds out of the old one. This does that on purpose.
   The previous output is kept in a texture and fed back each frame (two textures, taking turns), so every push
   accumulates into a smear that heals slowly once it stops.
   What steers it is a field, not a picture: each "epoch" (one to four seconds) draws at random one of three
   functions and a random view of it: the Mandelbrot set's smooth escape time, a Julia set's, the stepped
   diamonds of Andean weaving, or the ink's domain-warped noise. None of these is ever shown; they only steer. Where the picture melts, its pixels flow along the field's contours (the curl of the
   field, so they circle its shapes rather than run off them) or down its slope; which parts melt is decided by
   the field's own bands. So the melting is random, but always shaped by one of these functions. The smear takes
   two taps along the motion (a little motion blur keeps it smooth) and pulls the colour channels apart along it;
   tiny shards of two or three pixels slip further than the rest, so the melt frays at small scale. Some epochs
   are calm, and some are short bursts of video feedback: the picture falls into itself, turning, with its hue
   drifting, as when a camera films its own monitor (the look of Adult Swim's Off the Air).
   A cut (from hub.js) melts into the next picture: the new picture is revealed along the field's contours, the
   lowest values first, while the old one flows away along it.
   Usage: const m=Mosh(gl); m.resize(w,h); each frame draw the clean picture into m.target(), then m.step(t). */
(function(){
  const VS=`#version 300 es
in vec2 a; void main(){ gl_Position=vec4(a,0.,1.); }`;
  const FS=`#version 300 es
precision highp float;
uniform sampler2D prev, src; uniform vec2 res; uniform float t, epoch, mode, first, bleed;
uniform float fk, fs, fr, melt, push, band, zoom, spin, huesh; uniform vec2 fc, jc;
out vec4 o;
float hash(vec2 p){ uvec2 v=floatBitsToUint(p)*1664525u+1013904223u; v.x+=v.y*1664525u; v.y+=v.x*1664525u; v^=v>>16u;
  v.x+=v.y*1664525u; v.y+=v.x*1664525u; v^=v>>16u; return float((v.x^v.y)>>8)/16777216.; }
float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y); }
float fbm(vec2 p){ float s=0., a=.5; for(int i=0;i<4;i++){ s+=a*noise(p); p=mat2(.8,.6,-.6,.8)*p*2.02+1.7; a*=.5; } return s; }
// the steering field, 0..1, at screen point q (height = 1)
float field(vec2 q){
  q=mat2(cos(fr),-sin(fr),sin(fr),cos(fr))*q;
  if(fk>2.5){                                                              // stepped diamonds, as in Andean weaving
    vec2 c=fract(q*fs+fc)-.5; float d=abs(c.x)+abs(c.y);                    // the diamonds' rings, smooth (no stair steps)
    return clamp(fract(d*3.)*.6+d*.8,0.,1.);
  }
  if(fk<.5||fk>1.5&&fk<2.5){
    vec2 z=fk<.5?vec2(0.):q*fs, c=fk<.5?fc+q*fs:jc; float n=0.;
    for(int i=0;i<36;i++){ z=vec2(z.x*z.x-z.y*z.y,2.*z.x*z.y)+c; if(dot(z,z)>64.) break; n+=1.; }
    if(n>=35.) return 1.;
    return clamp(log(n+1.-log2(log2(dot(z,z)))*.5+1.)/log(37.),0.,1.);
  }
  vec2 p=q*fs+fc, w=vec2(fbm(p+t*.03),fbm(p+vec2(5.2,1.3)-t*.03));
  return clamp((fbm(p+3.*w)-.25)*1.8,0.,1.);
}
vec3 hue(vec3 c,float a){ const mat3 toY=mat3(.299,.596,.211,.587,-.274,-.523,.114,-.322,.312); const mat3 toR=mat3(1.,1.,1.,.956,-.272,-1.106,.621,-.647,1.703);
  vec3 y=toY*c; float h=atan(y.z,y.y)+a, ch=length(y.yz); return toR*vec3(y.x,ch*cos(h),ch*sin(h)); }
// the previous picture, smeared along a motion: two taps (a little motion blur keeps the melt smooth) and the
// colour channels pulled apart along it (the chromatic tearing of analogue video)
vec4 smear(vec2 px,vec2 mv,float split){
  vec2 a=(px-mv)/res, b=(px-mv*.5)/res, d=mv*split/res;
  vec4 p=.5*(texture(prev,a)+texture(prev,b));
  p.r=.5*(texture(prev,a+d).r+texture(prev,b+d).r); p.b=.5*(texture(prev,a-d).b+texture(prev,b-d).b);
  return p;
}
void main(){
  vec2 px=gl_FragCoord.xy, uv=px/res;
  vec4 s=texture(src,uv);
  if(first>.5){ o=s; return; }
  vec2 q=(px-.5*res)/res.y, e=vec2(1.5/res.y,0.);
  float F=0.; vec2 flow=vec2(0.); float gl2=0.;
  if(mode>.5||bleed>0.){
    F=field(q); vec2 g=vec2(field(q+e.xy)-F,field(q+e.yx)-F)/e.x;
    gl2=length(g); vec2 n=gl2>1e-4?g/gl2:vec2(0.);
    flow=(vec2(-n.y,n.x)*melt+n*push)*smoothstep(.0,.6,gl2*.04);           // round the contours, eased in where the slope is gentle
  }
  vec4 p=texture(prev,uv); float fresh=.08;
  if(mode>.5&&mode<1.5){                                                    // a melt along the field
    float b=fract(F*band+t*.04), m=smoothstep(.05,.3,b)*smoothstep(.85,.6,b);
    // small fragments: within the melt, tiny shards (two or three pixels) slip a little further along the flow
    float shard=hash(floor(px/(2.+3.*hash(vec2(epoch,5.))))+epoch);
    vec2 mv=flow*m*(1.+1.4*step(.82,shard));
    p=smear(px,mv,.25+.5*m); fresh=mix(.08,0.,m);
  } else if(mode>1.5){                                                      // video feedback: the picture falls into itself
    vec2 c=px-.5*res, z=c*(1.-zoom)+vec2(-c.y,c.x)*spin+flow*.6;
    p=smear(px,px-(.5*res+z),.35);
    p.rgb=hue(p.rgb,huesh); fresh=.04;
  }
  if(bleed>0.){                                                             // a cut: reveal the new picture by field value, softly
    float edge=smoothstep(F-.12,F+.12,1.-bleed);
    float shard=hash(floor(px/3.)+epoch*1.7);
    vec4 old=smear(px,flow*1.6*(1.-edge)*(1.+step(.85,shard)),.5);
    p=mix(old,s,edge); fresh=0.;
  }
  o=mix(p,s,fresh);
}`;
  const BLIT=`#version 300 es
precision mediump float;
uniform sampler2D tex; uniform vec2 res; out vec4 o;
void main(){ o=texture(tex,gl_FragCoord.xy/res); }`;
  // views of the fields that look good: Mandelbrot centres with a scale, Julia constants
  const MVIEWS=[[-.62,0,1.3],[-.745,.11,.06],[-.1,.95,.12],[.28,.008,.03],[-1.25,.03,.15],[-.16,1.04,.05],[-.75,0,.6]];
  const JULIAS=[[-.8,.156],[-.7269,.1889],[.285,.01],[-.4,.6],[-.123,.745],[.355,.355]];
  const pick=a=>a[Math.floor(Math.random()*a.length)];
  window.Mosh=function(gl){
    const sh=(type,src)=>{const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);return s};
    const prog=fs=>{const p=gl.createProgram();gl.attachShader(p,sh(gl.VERTEX_SHADER,VS));gl.attachShader(p,sh(gl.FRAGMENT_SHADER,fs));gl.bindAttribLocation(p,0,'a');gl.linkProgram(p);return gl.getProgramParameter(p,gl.LINK_STATUS)?p:null};
    const pm=prog(FS), pb=prog(BLIT); if(!pm||!pb) return null;
    const U=(p,n)=>gl.getUniformLocation(p,n);
    let W=0,H=0,src=null,buf=[],cur=0,first=true,ep=0,epT=0,cutT=-99,cutLen=3;
    const S={mode:0,zoom:.01,spin:0,huesh:0,fk:0,fs:1,fr:0,melt:1,push:0,band:6,fc:[-.62,0],jc:[-.8,.156]};
    // a new field: one of the three functions, at a random view
    function newField(){
      S.fk=pick([0,0,1,1,2,2,3]); S.fr=Math.random()*6.283;
      if(S.fk===0){ const v=pick(MVIEWS); S.fc=[v[0],v[1]]; S.fs=v[2]*(.6+Math.random()*.9) }
      else if(S.fk===2){ S.jc=pick(JULIAS); S.fs=1.2+Math.random()*1.6 }
      else if(S.fk===3){ S.fc=[Math.random(),Math.random()]; S.fs=1.5+Math.random()*3 }
      else { S.fc=[Math.random()*40,Math.random()*40]; S.fs=.8+Math.random()*2.2 }
      S.melt=(Math.random()<.5?-1:1)*(.5+Math.random()*2.2); S.push=(Math.random()-.5)*1.2; S.band=3+Math.floor(Math.random()*7);
    }
    function newEpoch(t){
      ep++; epT=t+1.2+Math.random()*2.8;
      const r=Math.random(); S.mode=r<.28?0:r<.8?1:2;                              // calm, a field melt, or feedback
      if(S.mode===1) newField();
      if(S.mode===2){ newField(); S.zoom=.004+Math.random()*.012; S.spin=(Math.random()-.5)*.012; S.huesh=(Math.random()-.5)*.06; epT=t+.8+Math.random()*1.4 }   // short bursts
    }
    function tex(){const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,W,H,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
      for(const [k,v] of [[gl.TEXTURE_MIN_FILTER,gl.LINEAR],[gl.TEXTURE_MAG_FILTER,gl.LINEAR],[gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE],[gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D,k,v);
      const f=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,f);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,t,0);return {t,f}}
    function free(x){if(x){gl.deleteTexture(x.t);gl.deleteFramebuffer(x.f)}}
    return {
      resize(w,h){ if(w===W&&h===H) return; W=w;H=h; free(src); buf.forEach(free); src=tex(); buf=[tex(),tex()]; first=true; gl.bindFramebuffer(gl.FRAMEBUFFER,null) },
      size(){ return [W,H] },
      cut(t){ cutT=t; cutLen=2.5+Math.random()*3; newField(); ep++; epT=t+cutLen+.5; S.mode=0 },   // the melt into the next picture
      target(){ gl.bindFramebuffer(gl.FRAMEBUFFER,src.f); gl.viewport(0,0,W,H); return src.f },
      step(t){
        if(t>epT) newEpoch(t);
        const a=buf[cur], b=buf[1-cur];
        gl.useProgram(pm); gl.bindFramebuffer(gl.FRAMEBUFFER,b.f); gl.viewport(0,0,W,H);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D,a.t); gl.uniform1i(U(pm,'prev'),0);
        gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D,src.t); gl.uniform1i(U(pm,'src'),1);
        gl.uniform2f(U(pm,'res'),W,H); gl.uniform1f(U(pm,'t'),t); gl.uniform1f(U(pm,'epoch'),ep%997); gl.uniform1f(U(pm,'first'),first?1:0);
        gl.uniform1f(U(pm,'mode'),S.mode); gl.uniform1f(U(pm,'zoom'),S.zoom); gl.uniform1f(U(pm,'spin'),S.spin); gl.uniform1f(U(pm,'huesh'),S.huesh);
        gl.uniform1f(U(pm,'fk'),S.fk); gl.uniform1f(U(pm,'fs'),S.fs); gl.uniform1f(U(pm,'fr'),S.fr); gl.uniform1f(U(pm,'melt'),S.melt*Math.max(.6,H/500));
        gl.uniform1f(U(pm,'push'),S.push); gl.uniform1f(U(pm,'band'),S.band); gl.uniform2f(U(pm,'fc'),S.fc[0],S.fc[1]); gl.uniform2f(U(pm,'jc'),S.jc[0],S.jc[1]);
        gl.uniform1f(U(pm,'bleed'),Math.max(0,1-(t-cutT)/cutLen));
        gl.drawArrays(gl.TRIANGLES,0,3); first=false;
        gl.useProgram(pb); gl.bindFramebuffer(gl.FRAMEBUFFER,null); gl.viewport(0,0,W,H);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D,b.t); gl.uniform1i(U(pb,'tex'),0); gl.uniform2f(U(pb,'res'),W,H);
        gl.drawArrays(gl.TRIANGLES,0,3); cur=1-cur;
      }
    };
  };
})();
