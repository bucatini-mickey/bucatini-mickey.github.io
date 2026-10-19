/* Datamosh, as a pass over whatever the hub's backdrop draws.
   Video codecs store most frames as instructions to move blocks of the previous frame along motion vectors, plus a
   small correction. When the corrections are lost, old pixels keep getting pushed around: colours drag and smear,
   parts freeze while others move on, and a new picture bleeds out of the old one. This does that on purpose.
   The previous output is kept in a texture and fed back each frame (two textures, taking turns), so every push
   accumulates into a smear, always healing a little towards the clean picture so the picture stays itself.
   Three motions run all the time, each swelling and fading on its own slow cycle (one to two minutes), so the whole
   never stops and never pulses back to normal:
   - a melt: pixels flow round the contours of a field (the Mandelbrot set's smooth escape time, a Julia set's, or the
     ink's domain-warped noise, chosen for the visit and turning slowly; never shown, it only steers) where its bands say;
   - a datamosh: small blocks carried along vectors taken from the shapes in the picture, so pixels stream round the
     outlines of things; colour moves on bigger blocks and slips loose of the detail, turning as it travels; a few
     blocks freeze;
   - video feedback: the picture falling slowly into itself, turning, its hue drifting, as when a camera films its own
     monitor (the look of Adult Swim's Off the Air).
   A cut (from hub.js) is a datamosh over 14 to 20 seconds: the new picture's shapes push the old picture's pixels, so
   it appears drawn in the old one's colours, then it seeps in and melts over the old one along the field's contours.
   Usage: const m=Mosh(gl); m.resize(w,h); each frame draw the clean picture into m.target(), then m.step(t). */
(function(){
  const VS=`#version 300 es
in vec2 a; void main(){ gl_Position=vec4(a,0.,1.); }`;
  const FS=`#version 300 es
precision highp float;
uniform sampler2D prev, src; uniform vec2 res; uniform float t, epoch, first, bleed, blk, wm, wd, wf;
uniform float fk, fs, fr, melt, push, band, zoom, spin, huesh; uniform vec2 fc, jc;
out vec4 o;
float hash(vec2 p){ uvec2 v=floatBitsToUint(p)*1664525u+1013904223u; v.x+=v.y*1664525u; v.y+=v.x*1664525u; v^=v>>16u;
  v.x+=v.y*1664525u; v.y+=v.x*1664525u; v^=v>>16u; return float((v.x^v.y)>>8)/16777216.; }
float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y); }
float fbm(vec2 p){ float s=0., a=.5; for(int i=0;i<4;i++){ s+=a*noise(p); p=mat2(.8,.6,-.6,.8)*p*2.02+1.7; a*=.5; } return s; }
// the steering field, 0..1, at screen point q (height = 1)
float field(vec2 q){
  float a=fr+t*.012; q=mat2(cos(a),-sin(a),sin(a),cos(a))*q;                  // the field turns slowly, so the flow keeps changing
  if(fk<.5||fk>1.5&&fk<2.5){
    vec2 z=fk<.5?vec2(0.):q*fs, c=fk<.5?fc+q*fs:jc; float n=0.;
    for(int i=0;i<36;i++){ z=vec2(z.x*z.x-z.y*z.y,2.*z.x*z.y)+c; if(dot(z,z)>64.) break; n+=1.; }
    if(n>=35.) return 1.;
    return clamp(log(n+1.-log2(log2(dot(z,z)))*.5+1.)/log(37.),0.,1.);
  }
  vec2 p=q*fs+fc, w=vec2(fbm(p+t*.015),fbm(p+vec2(5.2,1.3)-t*.015));
  return clamp((fbm(p+3.*w)-.25)*1.8,0.,1.);
}
const mat3 toY=mat3(.299,.596,.211,.587,-.274,-.523,.114,-.322,.312), toR=mat3(1.,1.,1.,.956,-.272,-1.106,.621,-.647,1.703);
vec3 hue(vec3 c,float a){ vec3 y=toY*c; float h=atan(y.z,y.y)+a, ch=length(y.yz); return toR*vec3(y.x,ch*cos(h),ch*sin(h)); }
float lum(sampler2D tx,vec2 p){ return dot(texture(tx,p/res).rgb,vec3(.3,.59,.11)); }
// a datamoshed read: brightness and colour are carried separately, as a codec stores them (colour on blocks twice the
// size), so colour slides further than the detail and comes apart from it; the colour also turns a little with the
// distance it travels, leaving rainbow trails
vec4 moshRead(vec2 px,vec2 mv,vec2 mvc,float turn){
  vec3 a=toY*texture(prev,(px-mv)/res).rgb, b=toY*texture(prev,(px-mvc)/res).rgb;
  float h=atan(b.z,b.y)+turn*length(mvc), ch=length(b.yz);
  return vec4(toR*vec3(a.x,ch*cos(h),ch*sin(h)),1.);
}
// the motion vector of a block, from the shapes in the picture: along the edges around the block's centre (so pixels
// stream round the outlines of things) and a little across them
vec2 shapeFlow(sampler2D tx,vec2 bc,float d,float dir){
  vec2 g=vec2(lum(tx,bc+vec2(d,0))-lum(tx,bc-vec2(d,0)),lum(tx,bc+vec2(0,d))-lum(tx,bc-vec2(0,d)));
  float gm=length(g); vec2 n=gm>1e-3?g/gm:vec2(0.);
  return (vec2(-n.y,n.x)*dir*2.6+n*.9)*smoothstep(.015,.12,gm);
}
void main(){
  vec2 px=gl_FragCoord.xy, uv=px/res;
  vec4 s=texture(src,uv);
  if(first>.5){ o=s; return; }
  vec2 bid=floor(px/blk), bc=(bid+.5)*blk, q=(px-.5*res)/res.y, e=vec2(1.5/res.y,0.);
  // the steering field and its flow here: round its contours (melt) and a little down its slope (push)
  float F=field(q); vec2 g=vec2(field(q+e.xy)-F,field(q+e.yx)-F)/e.x;
  float gl2=length(g); vec2 n=gl2>1e-4?g/gl2:vec2(0.);
  vec2 flow=(vec2(-n.y,n.x)*melt+n*push)*smoothstep(.0,.6,gl2*.04);
  float dir=melt<0.?-1.:1.;
  // the three motions, always all present in some measure (wm, wd, wf), added together. The melt, along the field's bands:
  float b=fract(F*band+t*.015), m=smoothstep(.0,.35,b)*smoothstep(1.,.55,b);
  vec2 mv=flow*m*wm;
  // the datamosh: blocks carried round the outlines of things in the picture (as it was and as it is); a few freeze
  vec2 v=mix(shapeFlow(prev,bc,blk*1.5,dir),shapeFlow(src,bc,blk*1.5,dir),.6);
  mv+=(v+flow*.25)*wd*(hash(bid+epoch*.13)>.96?0.:1.);
  // the feedback: the picture falling slowly into itself, turning
  vec2 c=px-.5*res; mv+=(c*zoom-vec2(-c.y,c.x)*spin)*wf;
  // a cut: the new picture's shapes push the old picture's pixels, so it appears drawn in the old colours
  float pr=1.-bleed, k=bleed>0.?sin(3.1416*min(1.,pr*1.05)):0.;
  if(bleed>0.) mv+=(shapeFlow(src,bc,blk*1.5,dir)*1.6+flow*.5)*k;
  vec2 bid2=floor(px/(blk*2.)); float hc=hash(bid2+epoch*.7);
  vec2 mvc=mv+(mv*.7+(vec2(hc,hash(bid2+9.1))-.5)*1.6*step(.7,hc))*max(wd,k);     // colour on bigger blocks, slipping loose
  vec4 p=moshRead(px,mv,mvc,.012*dir*max(wd,k));
  p.rgb=hue(p.rgb,huesh*wf);
  if(bleed>0.){                                                             // ...then it seeps in and melts over the old one, slowly
    float r=smoothstep(.3,1.,pr)*1.35, edge=smoothstep(F-.3,F+.3,r);
    o=mix(p,s,edge*.03+smoothstep(.92,1.,pr)*.1); return;
  }
  float act=clamp(wm*m+wd+wf,0.,1.);
  o=mix(p,s,.012+.025*(1.-act));                                           // always healing a little, so the picture stays itself
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
    let W=0,H=0,src=null,buf=[],cur=0,first=true,ep=0,cutT=-99,cutLen=16,t00=null;
    const ph=[0,1,2,3,4,5,6].map(()=>Math.random()*6.283);
    // the field: one of the three functions at a random view, kept for the visit (it turns slowly, and the ink one moves)
    const S={fk:pick([0,0,1,1,2,2]),fs:1,fr:Math.random()*6.283,band:2+Math.floor(Math.random()*4),fc:[-.62,0],jc:[-.8,.156]};
    if(S.fk===0){ const v=pick(MVIEWS); S.fc=[v[0],v[1]]; S.fs=v[2]*(.6+Math.random()*.9) }
    else if(S.fk===2){ S.jc=pick(JULIAS); S.fs=1.2+Math.random()*1.6 }
    else { S.fc=[Math.random()*40,Math.random()*40]; S.fs=.8+Math.random()*2.2 }
    function tex(){const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,W,H,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
      for(const [k,v] of [[gl.TEXTURE_MIN_FILTER,gl.LINEAR],[gl.TEXTURE_MAG_FILTER,gl.LINEAR],[gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE],[gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D,k,v);
      const f=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,f);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,t,0);return {t,f}}
    function free(x){if(x){gl.deleteTexture(x.t);gl.deleteFramebuffer(x.f)}}
    const wave=(t,period,i)=>.5+.5*Math.sin(t*6.283/period+ph[i]);
    return {
      resize(w,h){ if(w===W&&h===H) return; W=w;H=h; free(src); buf.forEach(free); src=tex(); buf=[tex(),tex()]; first=true; gl.bindFramebuffer(gl.FRAMEBUFFER,null) },
      size(){ return [W,H] },
      cut(t){ cutT=t; cutLen=14+Math.random()*6; ep++ },                        // every cut is the datamosh one
      target(){ gl.bindFramebuffer(gl.FRAMEBUFFER,src.f); gl.viewport(0,0,W,H); return src.f },
      step(t){
        if(t00===null) t00=t; const warm=Math.min(1,(t-t00)/8);                 // eases in over the first seconds
        const u=Math.max(0,1-(t-cutT)/cutLen), bleed=u*u*(3-2*u), dip=bleed>0?1-.45*Math.sin(Math.PI*(1-bleed)):1;   // the cut leads; the rest eases back under it
        // the three motions swell and fade on their own slow cycles; together they never fall below a floor
        let wm=.15+.55*wave(t,83,0), wd=.12+.55*wave(t,61,1)**1.5, wf=.7*wave(t,109,2)**2;
        const tot=wm+wd+wf; if(tot<.6){ const f=.6/tot; wm*=f; wd*=f; wf*=f }
        wm*=warm*dip; wd*=warm*dip; wf*=warm*dip;
        const melt=(.35+.6*wave(t,47,3))*Math.max(.6,H/500)*(Math.sin(t*6.283/170+ph[4])<0?-1:1), push=.4*(wave(t,71,5)-.5);
        const a=buf[cur], b=buf[1-cur], f1=(n,v)=>gl.uniform1f(U(pm,n),v);
        gl.useProgram(pm); gl.bindFramebuffer(gl.FRAMEBUFFER,b.f); gl.viewport(0,0,W,H);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D,a.t); gl.uniform1i(U(pm,'prev'),0);
        gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D,src.t); gl.uniform1i(U(pm,'src'),1);
        gl.uniform2f(U(pm,'res'),W,H); f1('t',t); f1('epoch',(ep*31+Math.floor(t/23))%997); f1('first',first?1:0); f1('bleed',bleed);
        f1('blk',Math.max(3,Math.round(6*H/900))); f1('wm',wm); f1('wd',wd); f1('wf',wf);
        f1('zoom',.0015+.0045*wave(t,37,6)); f1('spin',.0035*Math.sin(t*6.283/93+ph[3])); f1('huesh',.004*Math.sin(t*6.283/57+ph[5]));
        f1('fk',S.fk); f1('fs',S.fs*(1+.15*Math.sin(t*.013))); f1('fr',S.fr); f1('melt',melt); f1('push',push); f1('band',S.band);
        gl.uniform2f(U(pm,'fc'),S.fc[0],S.fc[1]); gl.uniform2f(U(pm,'jc'),S.jc[0],S.jc[1]);
        gl.drawArrays(gl.TRIANGLES,0,3); first=false;
        gl.useProgram(pb); gl.bindFramebuffer(gl.FRAMEBUFFER,null); gl.viewport(0,0,W,H);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D,b.t); gl.uniform1i(U(pb,'tex'),0); gl.uniform2f(U(pb,'res'),W,H);
        gl.drawArrays(gl.TRIANGLES,0,3); cur=1-cur;
      }
    };
  };
})();
