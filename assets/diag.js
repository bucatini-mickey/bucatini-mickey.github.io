/* Shared by both sites (keep identical). Loaded by bar.js only when the address has ?diag in it. A small panel
   lists what the browser reports about the device and its graphics, so a rendering fault seen on one device can be
   compared with a device where it is fine; "Copy" puts the report on the clipboard to paste into a message.
   Buttons reload the page with the backdrop simplified (?gfx=lowp forces low precision, which is what a fault of
   that kind would look like; ?gfx=still stops the animation), to narrow down the cause. */
(function(){
  const q=new URLSearchParams(location.search), lines=[];
  const add=(k,v)=>lines.push([k,String(v)]);
  add('page',location.pathname+location.search);
  add('browser',navigator.userAgent);
  add('screen',`${screen.width}x${screen.height} @${devicePixelRatio}, window ${innerWidth}x${innerHeight}`);
  add('motion',matchMedia('(prefers-reduced-motion: reduce)').matches?'reduced':'normal');
  add('scheme',matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');
  const probe=document.createElement('canvas'), gl=probe.getContext('webgl2');
  if(!gl) add('webgl2','not available');
  else {
    const info=gl.getExtension('WEBGL_debug_renderer_info');
    add('gpu',info?gl.getParameter(info.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER));
    add('vendor',info?gl.getParameter(info.UNMASKED_VENDOR_WEBGL):gl.getParameter(gl.VENDOR));
    const pf=(s,p)=>{const f=gl.getShaderPrecisionFormat(s,p);return f?`${f.precision} bits, 2^${f.rangeMin}..2^${f.rangeMax}`:'?'};
    add('frag highp',pf(gl.FRAGMENT_SHADER,gl.HIGH_FLOAT)); add('frag mediump',pf(gl.FRAGMENT_SHADER,gl.MEDIUM_FLOAT));
    add('max texture',gl.getParameter(gl.MAX_TEXTURE_SIZE));
    add('extensions',['KHR_parallel_shader_compile','EXT_color_buffer_float','OES_texture_float_linear'].map(e=>e.split('_').slice(1).join('_')+(gl.getExtension(e)?' yes':' no')).join(', '));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  }
  const box=document.createElement('div');
  box.style.cssText='position:fixed;z-index:99;left:8px;bottom:8px;max-width:min(560px,calc(100vw - 16px));max-height:60vh;overflow:auto;background:rgba(0,0,0,.86);color:#e8e8e8;font:12px/1.45 ui-monospace,monospace;padding:10px 12px;border-radius:6px;white-space:pre-wrap;word-break:break-word';
  document.body.appendChild(box);
  let fps='measuring…', n=0, t0=performance.now();
  (function count(t){ n++; if(t-t0>2000){ fps=Math.round(n*1000/(t-t0))+' fps'; n=0; t0=t; render() } requestAnimationFrame(count) })(t0);
  const go=v=>{const u=new URL(location.href); u.searchParams.set('diag',''); if(v) u.searchParams.set('gfx',v); else u.searchParams.delete('gfx'); location.href=u.href};
  function render(){
    const g=window.__gfx||{}, extra=Object.entries(g).map(([k,o])=>`${k}: quality ${o.quality?o.quality():'?'}, canvas ${o.canvas?o.canvas():'?'}`);
    const cvs=[...document.querySelectorAll('canvas.backdrop,canvas.print')].map(c=>('canvas #'+(c.id||c.className)).padEnd(13)+`${c.width}x${c.height} drawn, shown ${c.clientWidth}x${c.clientHeight}`);
    box.textContent=[...lines.map(([k,v])=>k.padEnd(13)+v),...cvs,'frame rate'.padEnd(13)+fps,...extra].join('\n')+'\n';
    for(const [label,v] of [['Copy',null],['normal',''],['low precision','lowp'],['still','still']]){
      const b=document.createElement('button'); b.textContent=label; b.style.cssText='margin:6px 6px 0 0;font:inherit;padding:3px 8px';
      b.onclick=v===null?()=>navigator.clipboard?.writeText(box.textContent).then(()=>b.textContent='Copied'):()=>go(v);
      box.appendChild(b);
    }
  }
  render();
})();
