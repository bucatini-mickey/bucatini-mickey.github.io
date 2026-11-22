/* "Pick for me": a small recommender for visitors, made only from films I've rated 3.5★ or more.
   films/picks-by-mood.json comes from my Reel Atlas build (E:\Claude\Personal\Letterboxd\atlas, `py atlas.py build`):
   each film carries how well it fits each mood, as one character per mood (A = 0 … _ = 63), worked out from my own
   lists and tags. No notes, ratings beyond the public ones, or private lists are in it. */
(function(){
  const $=id=>document.getElementById(id), esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const B64='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  const stars=r=>r==null?'':'★'.repeat(Math.floor(r))+(r%1?'½':'');
  const RT=[['any','Any length',0,999],['short','Under 100 min',0,99],['mid','100–130',100,130],['long','Long haul',131,999]];
  let D=null, sel=new Set(), rt='any', deep=.5, seed=0, PJ=null;
  function load(){
    if(D) return Promise.resolve(D);
    return Promise.all([fetch('picks-by-mood.json').then(r=>r.ok?r.json():null),
                        fetch('posters.json').then(r=>r.ok?r.json():null).catch(()=>null)])
      .then(([d,p])=>{ D=d; PJ=p; return d });
  }
  const PB='https://a.ltrbxd.com/resized/';
  const poster=f=>{ const c=PJ&&f.lb&&PJ.f[f.lb]; return c&&c[1]?PB+c[1].replace('~','-0-230-0-345-crop.jpg'):'' };
  function rows(){
    const C=D.cols; return D.F.map(r=>Object.fromEntries(C.map((c,k)=>[c,r[k]])));
  }
  let F=null;
  function score(f,ms){
    const fits=ms.map(i=>B64.indexOf(f.moods[i])/63);
    const m=fits.length?fits.reduce((a,b)=>a+b,0)/fits.length-(fits.length>1?.35*(Math.max(...fits)-Math.min(...fits)):0):.5;
    const r=(f.r-3.5)/1.5;                                  // 3.5★ → 0, 5★ → 1
    const o=f.obsc==null?.5:f.obsc;
    return .62*m+.26*r-.22*Math.abs(o-deep)+(f.liked?.03:0);
  }
  function draw(){
    if(!D){ $('pk-out').innerHTML='<p class="empty">The picker hasn’t loaded.</p>'; return }
    F=F||rows();
    const ids=D.moods.map(m=>m.id), ms=[...sel].map(i=>ids.indexOf(i)).filter(i=>i>=0);
    const [,,lo,hi]=RT.find(x=>x[0]===rt);
    const xs=F.filter(f=>f.rt==null||(f.rt>=lo&&f.rt<=hi)).map(f=>[score(f,ms),f]).sort((a,b)=>b[0]-a[0]);
    // a little shuffle among the best twenty, so "another" gives new films
    const top=xs.slice(0,20); let rnd=seed*9301+49297;
    const r=()=>((rnd=(rnd*9301+49297)%233280)/233280);
    const pick=seed?top.map(x=>[x[0]+r()*.12,x[1]]).sort((a,b)=>b[0]-a[0]):top;
    $('pk-out').innerHTML=pick.slice(0,6).map(([,f])=>{
      const url=f.lb?`https://letterboxd.com/film/${encodeURIComponent(f.lb)}/`:`https://letterboxd.com/imdb/${f.id}/`, p=poster(f);
      const tags=(f.tags||'').split('|').filter(Boolean).slice(0,4);
      return `<article class="pk"><a href="${esc(url)}" class="pkp" tabindex="-1" aria-hidden="true"><span class="pst">${p?`<img src="${esc(p)}" alt="" loading="lazy" width="230" height="345">`:`<span class="pkn">${esc(f.t)}</span>`}</span></a>
        <div><h3><a href="${esc(url)}">${esc(f.t)}</a> <small>${esc(f.y)}</small></h3>
        <div class="meta"><span class="stars">${stars(f.r)}</span>${f.liked?'<span class="lk">♥</span>':''}<span>${[f.rt?f.rt+' min':'',f.dir,f.c].filter(Boolean).map(esc).join(' · ')}</span></div>
        ${tags.length?`<p class="pkt">${tags.map(esc).join(' · ')}</p>`:''}</div></article>`}).join('')||'<p class="empty">Nothing fits all of that. Try fewer moods or any length.</p>';
  }
  function chips(){
    const groups=[...new Set(D.moods.map(m=>m.grp))];
    $('pk-moods').innerHTML=groups.map(g=>`<div class="pkg"><span class="pkgl">${esc(g)}</span>${D.moods.filter(m=>m.grp===g).map(m=>
      `<button type="button" class="pkc" data-m="${esc(m.id)}" aria-pressed="${sel.has(m.id)}" title="${esc(m.blurb)}">${esc(m.name)}</button>`).join('')}</div>`).join('');
    $('pk-moods').querySelectorAll('.pkc').forEach(b=>b.onclick=()=>{ const m=b.dataset.m;
      if(sel.has(m)) sel.delete(m); else { if(sel.size>=2) sel.delete([...sel][0]); sel.add(m) }
      $('pk-moods').querySelectorAll('.pkc').forEach(x=>x.setAttribute('aria-pressed',sel.has(x.dataset.m))); seed=0; draw() });
    $('pk-rt').innerHTML=RT.map(([id,l])=>`<button type="button" data-rt="${id}" aria-pressed="${rt===id}">${l}</button>`).join('');
    $('pk-rt').querySelectorAll('button').forEach(b=>b.onclick=()=>{rt=b.dataset.rt;$('pk-rt').querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',x===b));seed=0;draw()});
    $('pk-deep').oninput=e=>{deep=+e.target.value/100;draw()};
    $('pk-again').onclick=()=>{seed=(seed%997)+1;draw()};
    $('pk-note').textContent=`${D.F.length} films I’ve rated 3½★ or more · moods learned from my own lists · updated ${D.built.slice(0,10)}`;
  }
  window.lbPicker=()=>load().then(d=>{ if(!d){draw();return} if(!$('pk-moods').children.length) chips(); draw() });
  if(location.hash==='#pick') window.lbPicker();          // opened straight on the tab, before this file had loaded
})();
