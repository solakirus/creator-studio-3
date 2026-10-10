/* Board — the canvas, full screen, over whatever opened it.

   A thin bar with the way back, then the frame. Everything inside the frame —
   cards, lines, views, the boards list, undo — is the canvas's own. */
(function(){

  function mount(el, params){
    const o = params || {};
    const title = o.name || (o.side ? 'Boards' : 'Board');
    el.classList.add('bd-screen');
    el.innerHTML = Screens.bar({ kicker: o.kicker || 'Board', title }) +
      `<div class="bd-host"></div>`;
    const host = el.querySelector('.bd-host');
    host.appendChild(BoardLink.frame(o));
  }

  Screens.register('board', mount);
})();

/* Content → Boards: every board and folder, the boards list open. */
(function(){
  function mount(el){
    el.innerHTML = '<div class="bd-embed"></div>';
    el.querySelector('.bd-embed').appendChild(BoardLink.frame({ side:true }));
  }
  Screens.register('boards-home', mount);
})();
