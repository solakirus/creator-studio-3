/* Week board — the week as seven columns, Sunday to Saturday.

   From the laptop Planner: every task on its day, coloured by what it is
   (shoot, edit, publish, workout), and dragged to another day to move it.
   On a phone the days scroll sideways a column at a time; on a wide screen
   all seven sit side by side. Tap a card to open the task.

   Lives in the Month tab as its third section. */
(function(){

  const KIND = { shoot:['#FB6900','Shoot'], edit:['#A855F7','Edit'], publish:['#5BBE6A','Publish'], workout:['#3F8A88','Workout'] };
  const esc = s => String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
  const DOW = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

  function fmtTime(t){
    if(!t) return '';
    const [h, m] = String(t).split(':').map(Number);
    if(isNaN(h)) return t;
    const ap = h >= 12 ? 'pm' : 'am', hh = ((h + 11) % 12) + 1;
    return m ? `${hh}:${String(m).padStart(2, '0')}${ap}` : `${hh}${ap}`;
  }

  /* how far along a task is: steps, or angles on its shot list */
  function progress(t){
    const subs = t.subs || [];
    const angles = (t.shots || []).flatMap(s => s.angles || []);
    if(angles.length) return [angles.filter(a => a.done).length, angles.length, 'angles'];
    if(subs.length) return [subs.filter(s => s.done).length, subs.length, 'steps'];
    return null;
  }

  async function mount(el, params){
    const o = params || {};
    let week = o.week || await Data.currentWeek();
    let days = [];

    async function render(){
      const [range, tasks, today] = await Promise.all([Data.weekDates(week), Data.tasks(), Data.currentDay()]);
      days = [];
      for(let i = 0; i < 7; i++){
        const ts = range.from + i * 864e5;
        days.push({ ts, n: await Data.dateToDay(ts), d: new Date(ts) });
      }
      const on = n => tasks.filter(t => t.day === n)
        .sort((a, b) => String(a.at || '99').localeCompare(String(b.at || '99')) || String(a.title).localeCompare(String(b.title)));

      el.innerHTML = `${o.embedded ? '' : Screens.bar({ kicker:'Month', title:'Week board' })}
      <div class="view wk-view">
        <div class="wk-head">
          <button class="btn-sm" data-wk="-1" aria-label="Previous week">‹</button>
          <div class="wk-t"><b>Week ${week}</b><small>${range.label}</small></div>
          <button class="btn-sm" data-wk="1" aria-label="Next week">›</button>
          ${week !== await Data.currentWeek() ? `<button class="btn-sm" data-wk="0">This week</button>` : ''}
        </div>
        <div class="wk-cols">
          ${days.map(day => {
            const list = on(day.n);
            return `<section class="wk-col${day.n === today ? ' today' : ''}" data-day="${day.n}">
              <header><b>${DOW[day.d.getDay()]}</b><span>${day.d.getDate()}</span><small>Day ${day.n}</small></header>
              <div class="wk-list">
                ${list.map(t => {
                  const k = KIND[t.kind];
                  const pr = progress(t);
                  return `<button type="button" class="wk-card${t.view === 'done' ? ' done' : ''}" data-task="${t.id}"
                    style="--kc:${k ? k[0] : 'var(--line)'}">
                    <span class="wk-top">${t.at ? `<span class="wk-at">${fmtTime(t.at)}</span>` : ''}${
                      k ? `<span class="wk-kind">${k[1]}</span>` : ''}</span>
                    <span class="wk-title">${esc(t.title)}</span>
                    ${pr ? `<span class="wk-prog"><i style="width:${Math.round(pr[0] / pr[1] * 100)}%"></i></span>
                      <small>${pr[0]}/${pr[1]} ${pr[2]}</small>` : ''}
                  </button>`;
                }).join('') || '<p class="wk-empty">Nothing yet</p>'}
              </div>
            </section>`;
          }).join('')}
        </div>
        <p class="hintline wk-hint">Drag a card to another day to move it. Tap it to open.</p>
      </div>`;

      const todayCol = el.querySelector('.wk-col.today');
      if(todayCol && !o.keepScroll) todayCol.scrollIntoView({ block:'nearest', inline:'start' });
    }

    /* ---------------------------------------------------------- drag to move */
    let drag = null;
    const colAt = (x, y) => {
      const hit = document.elementFromPoint(x, y);
      return hit && hit.closest ? hit.closest('.wk-col') : null;
    };
    function start(card, e){
      const r = card.getBoundingClientRect();
      const ghost = card.cloneNode(true);
      ghost.classList.add('wk-ghost');
      ghost.style.width = r.width + 'px';
      document.body.appendChild(ghost);
      card.classList.add('wk-lifted');
      drag = { card, ghost, dx: e.clientX - r.left, dy: e.clientY - r.top, moved: true };
      move(e);
    }
    function move(e){
      if(!drag || !drag.ghost) return;
      drag.ghost.style.transform = `translate(${e.clientX - drag.dx}px, ${e.clientY - drag.dy}px)`;
      el.querySelectorAll('.wk-col.over').forEach(c => c.classList.remove('over'));
      const col = colAt(e.clientX, e.clientY);
      if(col) col.classList.add('over');
      /* near the edge on a phone: scroll to the next day */
      const cols = el.querySelector('.wk-cols');
      const cr = cols.getBoundingClientRect();
      if(e.clientX > cr.right - 30) cols.scrollLeft += 12;
      if(e.clientX < cr.left + 30) cols.scrollLeft -= 12;
    }
    async function end(e){
      const d = drag; drag = null;
      if(!d) return;
      clearTimeout(d.hold);
      if(!d.ghost) return;
      d.ghost.remove();
      d.card.classList.remove('wk-lifted');
      el.querySelectorAll('.wk-col.over').forEach(c => c.classList.remove('over'));
      const col = colAt(e.clientX, e.clientY);
      if(!col) return;
      const to = +col.dataset.day, id = d.card.dataset.task;
      const t = (await Data.tasks()).find(x => String(x.id) === id);
      if(!t || t.day === to) return;
      t.day = to;
      await Store.put('tasks', t);
      Data.invalidate('tasks');
      o.keepScroll = true;
      await render();
      o.keepScroll = false;
      U.toast(`Moved to ${DOW[new Date(days.find(x => x.n === to).ts).getDay()]}`);
      o.onChange && o.onChange();
    }

    el.addEventListener('pointerdown', e => {
      const card = e.target.closest('.wk-card');
      if(!card || e.button > 0) return;
      /* a mouse drags at once; a finger holds first, so swiping still scrolls */
      const touch = e.pointerType !== 'mouse';
      drag = { card, sx: e.clientX, sy: e.clientY, ghost: null };
      if(touch) drag.hold = setTimeout(() => { if(drag && !drag.ghost){ start(card, e); if(navigator.vibrate) navigator.vibrate(12); } }, 280);
    });
    el.addEventListener('pointermove', e => {
      if(!drag) return;
      if(!drag.ghost){
        const far = Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 6;
        if(far && e.pointerType === 'mouse') start(drag.card, e);
        else if(far){ clearTimeout(drag.hold); drag = null; }   /* it was a scroll */
        return;
      }
      e.preventDefault();
      move(e);
    }, { passive:false });
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', () => { if(drag){ clearTimeout(drag.hold); if(drag.ghost) drag.ghost.remove(); drag.card.classList.remove('wk-lifted'); } drag = null; });

    el.addEventListener('click', async e => {
      const w = e.target.closest('[data-wk]');
      if(w){ week = +w.dataset.wk === 0 ? await Data.currentWeek() : week + (+w.dataset.wk); return render(); }
      const card = e.target.closest('.wk-card');
      if(card && !card.classList.contains('wk-lifted')){
        const id = card.dataset.task;
        const t = (await Data.tasks()).find(x => String(x.id) === id);
        if(t) Screens.push('task', { id: t.id, onChange: async () => { o.keepScroll = true; await render(); o.keepScroll = false; } });
      }
    });

    await render();
  }

  Screens.register('week-board', mount);
})();
