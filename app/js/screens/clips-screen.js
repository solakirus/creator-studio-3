/* Clips as a pushed screen, now that the tab bar belongs to Profile. */
(function(){
  async function mount(el, params){
    /* hosted in the Content tab there is no stack to go back to */
    const embedded = !!(params && params.embedded);
    el.innerHTML = (embedded ? '' : Screens.bar({ kicker:'Creator studio', title:'Clips' })) +
                   '<div class="view" id="clipsHost"></div>';
    const host = el.querySelector('#clipsHost');
    /* reuse the tab view wholesale — it already knows how to render itself */
    await ViewClips.mount(host);
  }
  Screens.register('clips-screen', mount);
})();
