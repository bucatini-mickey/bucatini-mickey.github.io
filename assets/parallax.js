/* Shared by both sites. A .backdrop with data-parallax="k" drifts up at k times the scroll speed, so the scene
   moves more slowly than the page. A .tall backdrop has room to drift; it never runs past its own bottom edge.
   Pages that draw their backdrop themselves can listen for the 'parallax' event, which carries that offset. */
(function(){
  const els=[...document.querySelectorAll('.backdrop[data-parallax]')];
  if(!els.length) return;
  let q=false;
  function move(){
    q=false;
    for(const el of els){
      const k=+el.dataset.parallax||0, room=Math.max(0,el.offsetHeight-innerHeight), y=Math.min(room,Math.max(0,scrollY*k));
      el.style.transform=`translate3d(0,${-y}px,0)`;
      el.dispatchEvent(new CustomEvent('parallax',{detail:y}));
    }
  }
  addEventListener('scroll',()=>{if(!q){q=true;requestAnimationFrame(move)}},{passive:true});
  addEventListener('resize',move);
  move();
})();
