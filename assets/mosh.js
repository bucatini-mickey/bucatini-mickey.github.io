/* Datamosh, as a pass over whatever the hub's backdrop draws (the Mandelbrot zoom now; photographs later).
   Video codecs store most frames as instructions to move blocks of the previous frame along motion vectors,
   plus a small correction. When the corrections are lost, or the vectors are applied to the wrong picture,
   old pixels keep getting pushed around: colours drag and smear in streaks, some blocks freeze while others
   move on, and a new picture bleeds out of the old one block by block. This does that on purpose, gently.
   The screen is cut into cells, a new tiling each epoch (squares, bricks, honeycomb, diamonds, triangles or scanline
   strips, from a few pixels to two dozen across, the finer ones more often). Every so often (an "epoch", a second or two) each block draws
   a fate: most simply follow the picture; in a few drifting patches, blocks drag their old pixels along a
   shared direction, or freeze, or snap back to the true picture. Some epochs are calm and nothing happens.
   The previous output is kept in a texture and fed back in each frame (two textures, taking turns), so drags
   accumulate into smears and heal slowly when the patch moves on.
   The new picture's outlines lead: a small edge finder marks them, glitches gather along them, and at a cut
   they come through first, traced over the smear. A cut (from hub.js) is bled the way a datamosh bleeds one: for a few seconds the old picture is pushed
   along the new scene's motion and the new picture shows through block by block.
   Usage: const m=Mosh(gl); m.resize(w,h); each frame draw the clean picture into m.target(), then m.step(t). */
(function(){
  const VS=`#version 300 es
in vec2 a; void main(){ gl_Position=vec4(a,0.,1.); }`;
  const FS=`#version 300 es
precision highp float;
uniform sampler2D prev, src; uniform vec2 res; uniform float t, epoch, calm, first, bleed, swirl, tile, bs; uniform vec2 flow;
out vec4 o;
float hash(vec2 p){ uvec2 v=floatBitsToUint(p)*1664525u+1013904223u; v.x+=v.y*1664525u; v.y+=v.x*1664525u; v^=v>>16u;
  v.x+=v.y*1664525u; v.y+=v.x*1664525u; v^=v>>16u; return float((v.x^v.y)>>8)/16777216.; }
// which cell a pixel belongs to, in this epoch's tiling: squares, wide bricks, honeycomb, diamonds, triangles or
// scanline strips, at this epoch's size
vec2 cell(vec2 px){
  float B=bs;
  if(tile<.5) return floor(px/B);
  if(tile<1.5) return floor(px/vec2(B*2.,B));
  if(tile<2.5){ vec2 s=vec2(1.,1.7320508)*B, a=mod(px,s)-s*.5, b=mod(px-s*.5,s)-s*.5;
    return dot(a,a)<dot(b,b)?floor(px/s):floor((px-s*.5)/s)+.5; }
  if(tile<3.5) return floor(vec2(px.x+px.y,px.x-px.y)*.7071/B)+vec2(.25,.75);
  if(tile<4.5){ vec2 r=vec2(px.x-px.y*.57735,px.y*1.1547)/B, f=floor(r); return f*2.+step(1.,fract(r.x)+fract(r.y)); }
  return vec2(.5,floor(px.y/(B*.4)));
}
float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y); }
void main(){
  vec2 px=gl_FragCoord.xy, uv=px/res;
  vec4 s=texture(src,uv);
  // the outlines of the true picture: a cheap edge finder (luminance gradient from four neighbours)
  vec2 dx=vec2(1.5/res.x,0.), dy=vec2(0.,1.5/res.y); const vec3 Y=vec3(.299,.587,.114);
  float edge=smoothstep(.04,.18,length(vec2(dot(texture(src,uv+dx).rgb-texture(src,uv-dx).rgb,Y),dot(texture(src,uv+dy).rgb-texture(src,uv-dy).rgb,Y))));
  if(first>.5){ o=s; return; }
  vec2 blk=cell(px);
  float e=epoch, r=hash(blk+e*13.1), r2=hash(blk*1.7+e*7.3);
  // where the trouble is this epoch: a few soft patches, drifting
  float zone=smoothstep(.58,.8,noise(px/res.y*6.+vec2(e*3.1,e*1.7)+t*.02));
  float g=zone*(1.-calm)*(.6+.8*edge);                                     // trouble gathers along the picture's outlines
  vec2 dir=normalize(vec2(hash(vec2(e,1.))-.5,hash(vec2(e,2.))-.5)+1e-4);   // the epoch's shared direction
  vec2 mv=vec2(0.); float fresh=.07;                                       // ordinary blocks: follow the picture
  if(r<g*.55){ mv=normalize(dir+(vec2(r2,hash(blk+3.))-.5)*.5)*(.6+2.2*r2); fresh=0.; }   // drag
  else if(r<g*.85){ fresh=0.; }                                            // frozen
  else if(r<g*.9){ fresh=1.; }                                             // snapped back to the true picture
  // a cut being bled: the old picture is pushed along the new scene's motion, and the new one shows through block
  // by block as the bleed runs out
  if(bleed>0.){
    vec2 c=(px-.5*res)/res.y;
    if(hash(blk*3.1+e*.7)>bleed-edge*.5){ mv=vec2(0.); fresh=1.; }   // blocks on the new picture's outlines come through first
    else { mv=flow*(.6+r2)+vec2(-c.y,c.x)*swirl+(vec2(r,r2)-.5)*.8; fresh=0.; }
  }
  vec4 p=texture(prev,(px-mv)/res);
  if(fresh==0.&&dot(mv,mv)>0.) p.r=texture(prev,(px-mv*1.35)/res).r;      // a little colour slips in a drag
  o=mix(p,s,fresh);
  if(bleed>0.) o=mix(o,s,edge*smoothstep(0.,.35,bleed)*.85);               // and its outlines are traced over the smear, then the rest builds round them
}`;
  const BLIT=`#version 300 es
precision mediump float;
uniform sampler2D tex; uniform vec2 res; out vec4 o;
void main(){ o=texture(tex,gl_FragCoord.xy/res); }`;
  window.Mosh=function(gl){
    const sh=(type,src)=>{const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);return s};
    const prog=fs=>{const p=gl.createProgram();gl.attachShader(p,sh(gl.VERTEX_SHADER,VS));gl.attachShader(p,sh(gl.FRAGMENT_SHADER,fs));gl.bindAttribLocation(p,0,'a');gl.linkProgram(p);return gl.getProgramParameter(p,gl.LINK_STATUS)?p:null};
    const pm=prog(FS), pb=prog(BLIT); if(!pm||!pb) return null;
    const U=(p,n)=>gl.getUniformLocation(p,n);
    let W=0,H=0,src=null,buf=[],cur=0,first=true,ep=0,epT=0,calm=0,cutT=-99,flow=[0,0],swirl=0,tile=0,bs=8;
    const shape=()=>{ tile=Math.floor(Math.random()*6); bs=[4,5,6,8,8,12,16,24][Math.floor(Math.random()*8)]*Math.max(.6,H/500) };   // finer glitches more often
    function tex(){const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,W,H,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
      for(const [k,v] of [[gl.TEXTURE_MIN_FILTER,gl.LINEAR],[gl.TEXTURE_MAG_FILTER,gl.LINEAR],[gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE],[gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D,k,v);
      const f=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,f);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,t,0);return {t,f}}
    function free(x){if(x){gl.deleteTexture(x.t);gl.deleteFramebuffer(x.f)}}
    return {
      resize(w,h){ if(w===W&&h===H) return; W=w;H=h; free(src); buf.forEach(free); src=tex(); buf=[tex(),tex()]; first=true; gl.bindFramebuffer(gl.FRAMEBUFFER,null) },
      size(){ return [W,H] },
      cut(t,f,s){ cutT=t; flow=f; swirl=s; ep++; shape() },
      target(){ gl.bindFramebuffer(gl.FRAMEBUFFER,src.f); gl.viewport(0,0,W,H); return src.f },
      step(t){
        if(t>epT){ ep++; epT=t+.9+Math.random()*1.8; calm=Math.random()<.4?1:Math.random()*.4; shape() }   // a new epoch: calm, or a little trouble
        const a=buf[cur], b=buf[1-cur];
        gl.useProgram(pm); gl.bindFramebuffer(gl.FRAMEBUFFER,b.f); gl.viewport(0,0,W,H);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D,a.t); gl.uniform1i(U(pm,'prev'),0);
        gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D,src.t); gl.uniform1i(U(pm,'src'),1);
        gl.uniform2f(U(pm,'res'),W,H); gl.uniform1f(U(pm,'t'),t); gl.uniform1f(U(pm,'epoch'),ep%997); gl.uniform1f(U(pm,'calm'),calm); gl.uniform1f(U(pm,'first'),first?1:0);
        gl.uniform1f(U(pm,'tile'),tile); gl.uniform1f(U(pm,'bs'),bs);
        gl.uniform1f(U(pm,'bleed'),Math.max(0,1-(t-cutT)/2.6)); gl.uniform2f(U(pm,'flow'),flow[0],flow[1]); gl.uniform1f(U(pm,'swirl'),swirl);
        gl.drawArrays(gl.TRIANGLES,0,3); first=false;
        gl.useProgram(pb); gl.bindFramebuffer(gl.FRAMEBUFFER,null); gl.viewport(0,0,W,H);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D,b.t); gl.uniform1i(U(pb,'tex'),0); gl.uniform2f(U(pb,'res'),W,H);
        gl.drawArrays(gl.TRIANGLES,0,3); cur=1-cur;
      }
    };
  };
})();
