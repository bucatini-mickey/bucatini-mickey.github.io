/* "Pick for me": filter the films I've rated 3.5★ or more by genre, decade, feel and where they're from.
   films/picks-by-mood.json comes from my Reel Atlas (E:\Claude\Personal\Letterboxd\atlas, `py tools/site.py`). Each film
   has three 0–1 scales worked out from my own tags first, then MovieLens and Wikidata: surreal (grounded → surreal),
   dark (light → dark subject matter) and hard (easy → hard watching: dense, long or artsy). */
(function(){
  const $=id=>document.getElementById(id), esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const stars=r=>r==null?'':'★'.repeat(Math.floor(r))+(r%1?'½':'');
  const FEEL=[['surreal','Grounded','Surreal'],['dark','Light','Dark'],['hard','Easy watch','Hard watch']];
  const LO=.4, HI=.6;                                       // "Grounded" means under 0.4, "Surreal" over 0.6, and so on
  let D=null, F=null, PJ=null, seed=0, shown=6;
  const S={g:new Set(), dec:new Set(), from:new Set(), surreal:0, dark:0, hard:0};   // scales: -1 low end, 0 either, 1 high end
  function load(){
    if(D) return Promise.resolve(D);
    return Promise.all([fetch('picks-by-mood.json').then(r=>r.ok?r.json():null),
                        fetch('posters.json').then(r=>r.ok?r.json():null).catch(()=>null)])
      .then(([d,p])=>{ D=d; PJ=p; if(d) F=d.F.map(r=>Object.fromEntries(d.cols.map((c,k)=>[c,r[k]]))); return d });
  }
  const PB='https://a.ltrbxd.com/resized/';
  const poster=f=>{ const c=PJ&&f.lb&&PJ.f[f.lb]; return c&&c[1]?PB+c[1].replace('~','-0-230-0-345-crop.jpg'):'' };
  const dec=y=>Math.floor(y/10)*10;
  function match(f){
    if(S.g.size&&!f.g.some(x=>S.g.has(x))) return false;
    if(S.dec.size&&!S.dec.has(dec(f.y))) return false;
    if(S.from.size&&![f.c,...f.mv].some(x=>S.from.has(x))) return false;
    for(const [k] of FEEL){ if(S[k]>0&&f[k]<HI) return false; if(S[k]<0&&f[k]>LO) return false }
    return true;
  }
  function draw(){
    if(!F){ $('pk-out').innerHTML='<p class="empty">Not loaded.</p>'; return }
    let rnd=seed*7919+13; const r=()=>((rnd=(rnd*9301+49297)%233280)/233280);
    const xs=F.filter(match).map(f=>{
      let s=f.r+(f.liked?.25:0);
      for(const [k] of FEEL) if(S[k]) s+=S[k]*(f[k]-.5)*1.5;                    // lean further into the chosen end
      return [s+(seed?r()*1.2:0),f]}).sort((a,b)=>b[0]-a[0]).map(x=>x[1]);
    $('pk-count').textContent=xs.length===F.length?`All ${F.length} films`:`${xs.length} of ${F.length} films match`;
    $('pk-out').innerHTML=xs.slice(0,shown).map(f=>{
      const url=f.lb?`https://letterboxd.com/film/${encodeURIComponent(f.lb)}/`:`https://letterboxd.com/imdb/${f.id}/`, p=poster(f);
      const tags=[...f.mv,...f.g].slice(0,4);
      return `<article class="pk"><a href="${esc(url)}" class="pkp" tabindex="-1" aria-hidden="true"><span class="pst">${p?`<img src="${esc(p)}" alt="" loading="lazy" width="230" height="345">`:`<span class="pkn">${esc(f.t)}</span>`}</span></a>
        <div><h3><a href="${esc(url)}">${esc(f.t)}</a> <small>${esc(f.y)}</small></h3>
        <div class="meta"><span class="stars">${stars(f.r)}</span>${f.liked?'<span class="lk">♥</span>':''}<span>${[f.rt?f.rt+' min':'',f.dir,f.c].filter(Boolean).map(esc).join(' · ')}</span></div>
        ${tags.length?`<p class="pkt">${tags.map(esc).join(' · ')}</p>`:''}</div></article>`}).join('')
      ||'<p class="empty">Nothing matches.</p>';
    $('pk-more').hidden=xs.length<=shown;
  }
  const chip=(set,v,label)=>`<button type="button" class="pkc" data-set="${set}" data-v="${esc(v)}" aria-pressed="${S[set].has(v)}">${esc(label??v)}</button>`;
  function controls(){
    const count=(key)=>{const c=new Map(); F.forEach(f=>[].concat(key(f)).forEach(x=>x&&c.set(x,(c.get(x)||0)+1))); return [...c].sort((a,b)=>b[1]-a[1])};
    const gens=count(f=>f.g).filter(([,n])=>n>=3).map(([g])=>g);
    const decs=[...new Set(F.map(f=>dec(f.y)))].sort();
    const mvs=count(f=>f.mv).filter(([,n])=>n>=2).map(([m])=>m);
    const cts=count(f=>f.c).filter(([c,n])=>c&&n>=2).map(([c])=>c);
    $('pk-genre').innerHTML=gens.map(g=>chip('g',g)).join('');
    $('pk-dec').innerHTML=decs.map(d=>chip('dec',d,d+'s')).join('');
    $('pk-feel').innerHTML=FEEL.map(([k,lo,hi])=>`<div class="pkseg" role="group" aria-label="${esc(lo)} or ${esc(hi)}">${[[-1,lo],[0,'Either'],[1,hi]].map(([v,l])=>`<button type="button" data-k="${k}" data-v="${v}" aria-pressed="${S[k]===v}">${esc(l)}</button>`).join('')}</div>`).join('');
    $('pk-mv').innerHTML=mvs.map(m=>chip('from',m)).join('');
    $('pk-ct').innerHTML=cts.map(c=>chip('from',c)).join('');
    document.querySelectorAll('#v-pick .pkc').forEach(b=>b.onclick=()=>{ const set=S[b.dataset.set], v=b.dataset.set==='dec'?+b.dataset.v:b.dataset.v;
      set.has(v)?set.delete(v):set.add(v); b.setAttribute('aria-pressed',set.has(v)); seed=0; shown=6; draw() });
    document.querySelectorAll('#pk-feel button').forEach(b=>b.onclick=()=>{ S[b.dataset.k]=+b.dataset.v;
      b.parentNode.querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',x===b)); seed=0; shown=6; draw() });
    $('pk-again').onclick=()=>{seed=(seed%997)+1;draw()};
    $('pk-more').onclick=()=>{shown+=6;draw()};
    $('pk-clear').onclick=()=>{S.g.clear();S.dec.clear();S.from.clear();FEEL.forEach(([k])=>S[k]=0);seed=0;shown=6;controls();draw()};
    $('pk-note').textContent=`Data: MovieLens, Wikidata. Updated ${D.built||''}`;
  }
  window.lbPicker=()=>load().then(d=>{ if(!d){draw();return} if(!$('pk-genre').children.length) controls(); draw() });
  if(location.hash==='#pick') window.lbPicker();          // opened straight on the tab, before this file had loaded
})();
