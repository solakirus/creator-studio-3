/* One task, opened up: its steps, its timing, and whatever it is attached to. */
(function(){
  const { ICON } = U;
  const CADENCES = ['Daily','Weekly','Shoot day','One-off'];
  const PRI = [['low','Low'],['med','Medium'],['high','High']];
  const PRI_LABEL = { low:'Low', med:'Medium', high:'High' };

  function fmtTime(hhmm){
    if(!hhmm) return null;
    const [h,m] = hhmm.split(':').map(Number);
    const ap = h >= 12 ? 'P' : 'A', hr = h % 12 === 0 ? 12 : h % 12;
    return m ? `${hr}:${String(m).padStart(2,'0')}${ap}` : `${hr}${ap}`;
  }

  /* Thumbnails for every reference linked anywhere on this task. Loaded once,
     so a task with twenty shots does not hit storage twenty times. */
  let REFTHUMBS = {}, REFKIND = {};
  async function loadRefThumbs(t){
    const ids = [...new Set((t.shots || []).flatMap(s2 => s2.refs || []))];
    for(const id of ids){
      if(REFTHUMBS[id] === undefined) REFTHUMBS[id] = await Refs.thumb(id);
      if(REFKIND[id] === undefined){
        const r = await Refs.get(id);
        REFKIND[id] = r ? r.kind : null;
      }
    }
  }

  async function mount(el, params){
    let t, startDate = null, kit = [], lib = [];
    let allTasks = [];      /* the whole set, so a repeat can be counted and rewritten */
    /* which sections are open — a long task should not be a wall of text */
    const fold = { steps:true, shots:true, cov:true, details:true };
    let planning = null;   /* which shot is showing the angle strip */
    let clipRec = null;    /* the clip this task belongs to, for its references and versions */
    let planRec = null;    /* the program plan that wrote this task, for its videos */
    let refsOpen = null;
    let angQ = '';         /* search inside that strip */

    async function load(){
      const map = await Store.allMap('tasks');
      allTasks = Object.values(map);
      t = allTasks.find(x => x.id === +params.id);
      startDate = (await Data.program()).start;
      kit = Coverage.kitFor(t, await Coverage.kit());
      lib = await ShotLib.all();
      clipRec = null;
      if(t && t.clipId){ try { clipRec = await Store.get('clips', t.clipId); } catch(e){} }
      /* a task a program plan wrote carries the plan's videos */
      planRec = null;
      if(t && t.planId){ try { planRec = await Store.get('plans', t.planId); } catch(e){} }
    }
    /* swipes linked to this task itself — the old single swipeId counts too */
    const ownRefs = () => {
      const ids = (t && t.swipeIds) ? t.swipeIds.slice() : [];
      if(t && t.swipeId && !ids.includes(t.swipeId)) ids.unshift(t.swipeId);
      return ids;
    };
    const clipRefs = () => (clipRec && clipRec.plan && clipRec.plan.swipeIds) || [];
    const planRefs = () => (planRec && planRec.swipeIds) || [];
    /* Photos pinned to this task — a reference shot, a diagram, a photo of the
       thing you are fixing. Keyed <taskId>:<n> so a task can hold several;
       the inbox keeps one per note and that was not enough here. */
    let shots = [];
    async function loadShots(){
      try {
        const blobs = await Store.allMap('task-media');
        shots.forEach(x => URL.revokeObjectURL(x.url));
        shots = Object.entries(blobs)
          .filter(([k]) => k.split(':')[0] === String(t.id))
          .sort((a, b) => (+a[0].split(':')[1] || 0) - (+b[0].split(':')[1] || 0))
          .map(([k, b]) => ({ key:k, url:URL.createObjectURL(b) }));
      } catch(e){ shots = []; }
    }

    async function save(){
      await Store.put('tasks', t);
      Data.invalidate('tasks');
      Notify.update();
      Reminders.sync();
      params.onChange && params.onChange();
    }
    const dayLabel = n => {
      if(!startDate) return `Day ${n}`;
      const d = new Date(startDate);
      d.setDate(d.getDate() + (n - 1));
      return d.toLocaleDateString(undefined, { weekday:'short', month:'short', day:'numeric' });
    };

    const typeLabel = id => {
      const k = lib.find(x => x.id === id);
      return k ? k.label : id;
    };

    /* Every angle in the library, in one horizontal run. */
    function stripHTML(planned){
      const rows = angQ
        ? lib.filter(k => (k.label + ' ' + (k.hint || '')).toLowerCase().includes(angQ))
        : lib;
      if(!rows.length) return `<span class="grp">Nothing matches</span>`;
      const groups = {};
      rows.forEach(k => { (groups[k.group || 'Other'] = groups[k.group || 'Other'] || []).push(k); });
      return Object.entries(groups).map(([g, items]) =>
        `<span class="grp">${g}</span>` +
        items.map(k => `<span class="ang${planned.has(k.id) ? ' got' : ''}" data-toggleang="${k.id}">${
          planned.has(k.id) ? '✓ ' : ''}${k.label}</span>`).join('')
      ).join('');
    }

    function shotsBlock(){
      const shots = t.shots || [];
      const tt = Coverage.shotTotals(t);
      const covered = shots.filter(Coverage.shotDone).length;
      return `
      <div class="block fold${fold.shots ? ' open' : ''}" data-fold="shots">
        <h4><svg class="fcv" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>
          Shot list<span class="cnt">${shots.length ? `${covered}/${shots.length} covered · ${tt.got} angles` : 'none yet'}</span></h4>
        <div class="fbody">
          ${shots.length ? `<div class="track" style="margin:0 0 14px"><i class="ok" style="width:${tt.pct}%"></i></div>` : ''}
          ${shots.length ? shots.map((s2,i) => {
            const got = Coverage.shotGot(s2), want = Coverage.shotTarget(s2);
            const full = got >= want;
            const planned = new Set((s2.angles || []).map(a => a.type));
            const sNo = stepNo(s2);
            return `
            <div class="shotrow${full ? ' done' : ''}${planning === i ? ' planning' : ''}${sNo ? ' isstep' : ''}">
              <span class="sn${sNo ? '' : ' blank'}">${sNo || ''}</span>
              <span class="tx" data-shotedit="${i}">${s2.text}${s2.note ? `<small>${s2.note}</small>` : ''}
                ${(s2.angles || []).length ? `<span class="angles">
                  ${s2.angles.map((a,ai) => `<span class="ang${a.done ? ' got' : ''}" data-ang="${i}:${ai}"
                    ${a.doneAt ? `title="Shot at ${new Date(a.doneAt).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' })}"` : ''}>${
                    a.done ? '✓ ' : ''}${typeLabel(a.type)}${
                    a.doneAt ? `<i>${new Date(a.doneAt).toLocaleTimeString([], { hour:'numeric', minute:'2-digit' })}</i>` : ''}</span>`).join('')}
                </span>` : `<span class="angles"><span class="ang plan">No angles planned</span></span>`}
                <span class="refstrip">
                  ${(s2.refs || []).map((rid, ri) => `<span class="refchip" data-refopen="${i}:${ri}">
                    ${REFTHUMBS[rid] ? `<img src="${REFTHUMBS[rid]}" alt="">` : ''}
                    ${REFKIND[rid] === 'video' ? `<span class="pl">
                      <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5l11 7-11 7z"/></svg></span>` : ''}
                    <span class="x" data-refdel="${i}:${ri}">×</span>
                  </span>`).join('')}
                  <button class="refadd" data-reflink="${i}" aria-label="Link a reference">+</button>
                </span>
              </span>
              <span class="ring2${full ? ' full' : ''}" data-shotedit="${i}">${got}/${want}</span>
              <button class="mini rm" data-shotdel="${i}" aria-label="Remove this shot">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
              <span class="shotmv">
                <button class="mini" data-shotmv="up:${i}" ${i===0?'disabled':''} aria-label="Move up">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 15l6-6 6 6"/></svg></button>
                <button class="mini" data-shotmv="down:${i}" ${i===shots.length-1?'disabled':''} aria-label="Move down">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg></button>
              </span>
              <button class="addang" data-plan="${i}" aria-label="Plan the angles">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px"><path d="M4 20l4-1 10-10-3-3L5 16z"/><path d="M14.5 6.5l3 3"/></svg>
              </button>
            </div>
            ${planning === i ? `
              <div class="angsearch">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.6-3.6"/></svg>
                <input id="angq" type="text" placeholder="Find an angle…" value="${angQ}">
                ${angQ ? `<button class="angclear" data-angclear aria-label="Clear">×</button>` : ''}
              </div>
              <div class="angstrip">${stripHTML(planned)}</div>
              <p class="striphint">${angQ ? 'Filtered' : 'Scroll for more'} · tap to add or remove — ${planned.size} planned.</p>` : ''}`;
          }).join('')
            : `<p style="margin:0;color:var(--muted);font-size:14.5px;line-height:1.55">
                 The actual shots you want — "me walking across the street", "hands on the drill".
                 Each one wants ${Coverage.ANGLE_TARGET} angles, and every angle you log counts toward
                 your coverage.</p>`}
          ${shots.some(x => stepNo(x)) && shots.length > 1 ? `<button class="btn-sm" data-a="sortshots"
            style="width:100%;margin-top:12px;justify-content:center">Sort by step order</button>` : ''}
          <div style="display:flex;gap:9px;margin-top:12px">
            <input id="newshot" type="text" placeholder="Add a shot and press Enter"
              style="flex:1;height:44px;background:var(--bg);border:1px solid var(--line);border-radius:var(--r);
              color:var(--cream);font-size:15px;padding:0 11px;outline:none">
            <button class="btn-sm" data-a="addshot" style="width:52px;justify-content:center">+</button>
          </div>
        </div>
      </div>`;
    }

    /* A step and a shot are linked when they share a name. Nothing is stored,
       so adding or removing either side keeps the other honest. */
    const norm = v => String(v || '').trim().toLowerCase();
    const hasShot = text => (t.shots || []).some(sh => norm(sh.text) === norm(text));
    const stepNo = sh => {
      const i = (t.subs || []).findIndex(x => norm(x.t) === norm(sh.text));
      return i === -1 ? null : i + 1;
    };

    function stepsBlock(){
      const steps = t.subs || [];
      const done = steps.filter(s2 => s2.done).length;
      return `
      <div class="block fold${fold.steps ? ' open' : ''}" data-fold="steps">
        <h4><svg class="fcv" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>
          Steps<span class="cnt">${steps.length ? `${done} of ${steps.length}` : 'none yet'}</span></h4>
        <div class="fbody">
          ${steps.length ? steps.map((s2,i) => `
            <div class="shotline${s2.done ? ' done' : ''}" data-step="${i}">
              <span class="bx">${ICON.check}</span>
              <span class="sn">${i + 1}</span>
              <span class="tx">${s2.t}${s2.note ? `<br><span style="color:var(--dim);font-size:12.5px">${s2.note}</span>` : ''}</span>
              <button class="mini" data-mv="up:${i}" ${i===0?'disabled':''} aria-label="Up">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 15l6-6 6 6"/></svg></button>
              <button class="mini" data-mv="down:${i}" ${i===steps.length-1?'disabled':''} aria-label="Down">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg></button>
              <button class="mini${hasShot(s2.t) ? ' lit' : ''}" data-tostep="${i}"
                aria-label="${hasShot(s2.t) ? 'On the shot list — tap to remove' : 'Add to the shot list'}">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7h4l1.5-2h7L17 7h4v12H3z"/><circle cx="12" cy="13" r="3.4"/></svg></button>
              <button class="mini" data-edit="${i}" aria-label="Edit">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20l4-1 10-10-3-3L5 16z"/><path d="M14.5 6.5l3 3"/></svg></button>
            </div>`).join('')
            : `<p style="margin:0;color:var(--muted);font-size:14.5px;line-height:1.55">
                 The jobs that make up this task — clear the ground, set the frame, build the walls.</p>`}
          <div style="display:flex;gap:9px;margin-top:12px">
            <input id="newstep" type="text" placeholder="Add a step and press Enter"
              style="flex:1;height:44px;background:var(--bg);border:1px solid var(--line);border-radius:var(--r);
              color:var(--cream);font-size:15px;padding:0 11px;outline:none">
            <button class="btn-sm" data-a="addstep" style="width:52px;justify-content:center">+</button>
          </div>
          ${steps.length ? `
          ${steps.some(s2 => !hasShot(s2.t)) ? `<button class="btn-sm" data-a="allshots"
            style="width:100%;margin-top:10px;justify-content:center">Add all steps to the shot list</button>` : ''}
          <div style="display:flex;gap:9px;margin-top:10px">
            <button class="btn-sm" data-a="allon" style="flex:1;justify-content:center">Tick all</button>
            <button class="btn-sm" data-a="alloff" style="flex:1;justify-content:center">Clear all</button>
          </div>` : ''}
        </div>
      </div>`;
    }

    function detailsBlock(){
      return `
      <div class="block fold${fold.details ? ' open' : ''}" data-fold="details">
        <h4><svg class="fcv" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>
          Details<span class="cnt">${[t.cad, PRI_LABEL[t.pri]]
            .filter(Boolean).join(' · ') || 'not set'}</span></h4>
        <div class="fbody">
          <div class="metaline" style="margin:0">
            <button class="btn-sm" data-a="when">${t.at ? fmtTime(t.at) : 'No time'} · ${dayLabel(t.day)}</button>
            <!-- these two stay visible even when unset — they are how you set
                 them — so they say so rather than naming a missing value -->
            <button class="btn-sm" data-a="cad">${t.cad || 'No cadence'}</button>
            <button class="btn-sm" data-a="pri">${PRI_LABEL[t.pri] || 'No priority'}</button>
          </div>
          ${t.prog ? `<p style="margin:12px 0 0;color:var(--muted);font-size:14px">Target · ${t.prog}</p>` : ''}
        </div>
      </div>`;
    }

    function render(){
      if(!t){ Screens.pop(); return; }
      /* pull in any thumbnails we do not have yet, then repaint just the strips */
      loadRefThumbs(t).then(() => {
        el.querySelectorAll('.refchip img').forEach(img => {
          if(!img.getAttribute('src')) render();
        });
      });
      /* rebuilding the screen would otherwise throw you back to the top */
      const prev = el.querySelector('.view');
      const keep = prev ? prev.scrollTop : 0;
      const steps = t.subs || [];
      const done = steps.filter(s => s.done).length;
      const pct = steps.length ? Math.round(done / steps.length * 100) : 0;

      el.innerHTML = Screens.bar({ kicker:'Today', title:t.title,
        actions:`<button class="btn-sm" data-a="rename">Rename</button>` }) + `
      <div class="view">
        ${t.series ? `<div style="display:flex;align-items:center;gap:10px;padding:12px 13px;
          border-radius:var(--r);background:var(--surface-2);border:1px solid #2B2822;margin:0 0 14px">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round"
            style="width:16px;height:16px;color:var(--orange);flex:0 0 16px">
            <path d="M4 10a8 8 0 0 1 14-5M20 14a8 8 0 0 1-14 5M18 4v5h-5M6 20v-5h5"/></svg>
          <span style="flex:1;font-size:13.5px;color:var(--muted);line-height:1.45">
            Repeats <b style="color:var(--orange)">${seriesFreq(t)}</b>. Edits to the
            steps or the time here affect this day only.</span>
          <button class="btn-sm accent" data-a="refreq">Change</button>
          <button class="btn-sm" data-endseries="${t.series}">End it</button>
        </div>` : ''}
        ${t.note ? `<div style="padding:13px;border-radius:var(--r);background:var(--surface-2);
          border:1px solid #2B2822;margin:0 0 14px">
          ${t.source ? `<p style="margin:0 0 7px;font-family:var(--display),sans-serif;font-weight:900;
            font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;color:var(--orange)">
            ${t.source}</p>` : ''}
          <p style="margin:0;font-size:14.5px;line-height:1.6;color:var(--muted)">${t.note}</p>
        </div>` : ''}

        <!-- Somewhere to explain the task to yourself: what "done" looks like,
             the measurement you took, a photo of the thing. Notes were read-only
             here and arrived only from whatever created the task. -->
        <div class="sec" style="margin-top:4px"><h2>Notes</h2><div class="rule"></div>
          ${shots.length ? `<span class="alt">${shots.length}</span>` : ''}</div>

        <textarea id="tk-note" class="tknote" rows="3"
          placeholder="What you need to remember when you get to this.">${
          String(t.notes || '').replace(/</g, '&lt;')}</textarea>

        ${shots.length ? `<div class="tkshots">
          ${shots.map(x => `<span class="tkshot" style="background-image:url(${x.url})">
            <button class="tkx" data-rmshot="${x.key}" aria-label="Remove">×</button>
          </span>`).join('')}
        </div>` : ''}

        <button class="btn-ghost" data-a="addshot" style="width:100%;margin:10px 0 16px">
          ${shots.length ? 'Add another photo' : 'Add a photo'}</button>
        ${t.planId ? `<div style="display:flex;align-items:center;gap:10px;padding:12px 13px;
          border-radius:var(--r);background:var(--surface-2);border:1px solid #2B2822;margin:0 0 14px">
          <span style="flex:1;font-size:13.5px;color:var(--muted);line-height:1.45">
            This one comes from a program plan, which is where its frequency and
            targets are set.</span>
          <button class="btn-sm accent" data-a="openplan">Edit plan</button>
        </div>` : ''}
        ${t.routineId
          ? `<button class="btn-primary" data-start-workout="${t.routineId}"
              style="width:100%;margin:0 0 14px">Start this workout</button>`
          : `<button class="btn-ghost" data-link-workout
              style="width:100%;margin:0 0 14px">Link a workout to this task</button>`}
        ${t.clipId ? (() => {
          const vl = (clipRec && clipRec.plan && clipRec.plan.versions) || [];
          if(!vl.length) return `<button class="btn-ghost" data-plan-clip="${t.clipId}"
            style="width:100%;margin:0 0 14px">Open the clip plan</button>`;
          const pr = Versions.progress(vl);
          return `<button class="btn-ghost" data-plan-clip="${t.clipId}"
            style="width:100%;margin:0 0 14px;display:block;text-align:left;padding:12px 14px">
            <span style="display:flex;justify-content:space-between;gap:10px;font-size:14.5px">
              <span>Open the clip plan</span>
              <span style="color:var(--muted)">${pr.edited}/${pr.total} versions edited · ${pr.posted} posted</span></span>
            <span style="position:relative;display:block;height:6px;margin-top:9px;border-radius:3px;
              background:var(--surface-1);overflow:hidden">
              <i style="position:absolute;left:0;top:0;bottom:0;width:${pr.pctEdited}%;background:rgba(245,158,11,.45)"></i>
              <i style="position:absolute;left:0;top:0;bottom:0;width:${pr.pctPosted}%;background:var(--green)"></i>
            </span>
          </button>`;
        })() : ''}
        <div class="block">
          <div class="metaline" style="margin:0">
            <!-- Not every path that makes a task sets these: one from a clip, a
                 shot, a quick capture or a vlog day has neither, and the tag
                 printed the missing value as a word on the detail page. -->
            ${t.cad ? `<span class="tg">${t.cad}</span>` : ''}
            ${PRI_LABEL[t.pri] ? `<span class="tg count" style="color:var(--${
              t.pri === 'low' ? 'low' : t.pri === 'med' ? 'med' : 'high'})">${
              PRI_LABEL[t.pri]}</span>` : ''}
            <span class="tg count">${dayLabel(t.day)}</span>
            ${t.at ? `<span class="tg count">${fmtTime(t.at)}</span>` : ''}
            ${t.view === 'done' ? `<span class="tg count" style="color:var(--green)">Done</span>` : ''}
          </div>
          ${steps.length ? `<div class="track" style="margin-top:13px">
            <i class="ok" style="width:${pct}%"></i></div>
            <p style="margin:9px 0 0;font-size:13.5px;color:var(--muted)">${done} of ${steps.length} done</p>` : ''}
        </div>

        ${stepsBlock()}
        ${shotsBlock()}
        ${Coverage.html(t, kit, { editable:true, fold:true, open:fold.cov })}
        ${detailsBlock()}

        ${(() => {
          const n = new Set(ownRefs().concat(clipRefs(), planRefs())).size;
          /* nothing linked yet: just the one quiet button. The section, with room
             for more, appears once the first swipe is in. */
          if(!n) return `<button class="btn-ghost" data-swr-add
            style="width:100%;margin:0 0 14px">+ Link a swipe</button>`;
          const open = refsOpen === null ? n > 0 : refsOpen;
          return `<details class="cp-sec" id="sec-refs"${open ? ' open' : ''} style="margin:0 0 14px">
            <summary>References<span class="n">${n ? `${n} swipe${n === 1 ? '' : 's'}` : 'none linked'}</span>
              <svg class="cv" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"
                stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg></summary>
            <div class="cp-body"><div id="swr-slot"></div></div>
          </details>`;
        })()}

        <div class="metaline">
          <button class="btn-sm accent" data-a="toggle" style="flex:1;justify-content:center">
            ${t.view === 'done' ? 'Mark not done' : 'Mark done'}</button>
        </div>
        <button class="btn-ghost" data-a="delete" style="width:100%;margin-top:12px;color:var(--red);border-color:rgba(226,86,74,.4)">Delete task</button>
      </div>`;

      const view = el.querySelector('.view');
      if(view && keep) view.scrollTop = keep;

      const refsSec = el.querySelector('#sec-refs');
      if(refsSec) refsSec.addEventListener('toggle', () => { refsOpen = refsSec.open; });
      if(el.querySelector('#swr-slot')) SwipeRefs.fill(el.querySelector('#swr-slot'), {
        own: ownRefs(),
        inherited: clipRefs().map(id => ({ id, from:'from clip' }))
          .concat(planRefs().filter(id => !clipRefs().includes(id)).map(id => ({ id, from:'from plan' }))),
        empty: t.clipId ? 'Nothing linked here or on the clip yet.' : 'Link the videos this task is borrowing from.'
      });

      const aq = el.querySelector('#angq');
      if(aq){
        aq.addEventListener('input', () => {
          angQ = aq.value.trim().toLowerCase();
          const strip = el.querySelector('.angstrip');
          const planned = new Set((t.shots[planning].angles || []).map(a => a.type));
          if(strip) strip.innerHTML = stripHTML(planned);
          const hint = el.querySelector('.striphint');
          if(hint) hint.textContent = `${angQ ? 'Filtered' : 'Scroll for more'} · tap to add or remove — ${planned.size} planned.`;
        });
        if(angQ){ aq.focus(); aq.setSelectionRange(angQ.length, angQ.length); }
      }

      const stepIn = el.querySelector('#newstep');
      if(stepIn) stepIn.addEventListener('keydown', async e => {
        if(e.key === 'Enter') await addStep(stepIn.value);
      });
      const shotIn = el.querySelector('#newshot');
      if(shotIn) shotIn.addEventListener('keydown', async e => {
        if(e.key === 'Enter') await addShot(shotIn.value);
      });
    }

    async function addStep(text){
      const v = String(text || '').trim();
      if(!v) return;
      t.subs = t.subs || [];
      t.subs.push({ t:v, done:false });
      if(t.view === 'done') t.view = 'todo';
      await save(); render();
      const i = el.querySelector('#newstep');
      if(i) i.focus();
    }

    /* Per-task coverage: start from the global kit, then change it for this piece only. */
    function editKit(){
      const working = (t.kit ? t.kit : kit).map(k => ({ ...k }));

      const body = () => `
        <h2>Coverage for this task</h2>
        <p style="margin:0 0 16px;color:var(--muted);font-size:14.5px;line-height:1.55">
          Changes here apply to this task alone. Your default kit stays as it is.</p>
        <div class="group" style="margin:0 0 14px">
          ${working.map((k,i) => `<div class="row" style="cursor:default">
            <span class="lbl">${k.label}${k.hint ? `<small>${k.hint}</small>` : ''}</span>
            <span style="display:flex;align-items:center;gap:8px">
              <button class="mini" data-kt="-:${i}" ${k.target <= 1 ? 'disabled' : ''}>−</button>
              <b style="font-family:var(--display),sans-serif;font-weight:900;min-width:22px;text-align:center">${k.target}</b>
              <button class="mini" data-kt="+:${i}">+</button>
              <button class="mini" data-krm="${i}" style="color:var(--red)" aria-label="Remove">×</button>
            </span>
          </div>`).join('') || '<div class="empty" style="padding:24px 8px"><b>Nothing in the kit</b>Add a shot type below.</div>'}
        </div>
        <button class="btn-sm accent" data-klib style="width:100%;justify-content:center;height:46px">
          Pick from the shot library</button>
        <div class="sheetcta">
          <button class="btn-primary" data-save>Save for this task</button>
          <button class="btn-ghost" data-cancel>Cancel</button>
        </div>
        ${t.kit ? `<button class="btn-ghost" data-reset style="width:100%;margin-top:10px">Back to the default kit</button>` : ''}`;

      App.sheet(body(), sheetEl => {
        const redraw = () => { sheetEl.innerHTML = body(); };
        sheetEl.addEventListener('click', async e => {
          const kt = e.target.closest('[data-kt]');
          if(kt){
            const [sign, i] = kt.dataset.kt.split(':');
            const k = working[+i];
            k.target = Math.max(1, k.target + (sign === '+' ? 1 : -1));
            return redraw();
          }
          const rm = e.target.closest('[data-krm]');
          if(rm){ working.splice(+rm.dataset.krm, 1); return redraw(); }

          if(e.target.closest('[data-klib]')){
            App.closeSheet();
            setTimeout(() => ShotLib.pick({
              title:'Coverage for this task',
              existing:working,
              onPick: async picked => {
                t.kit = picked;
                await save();
                kit = picked;
                render();
              }
            }), 260);
            return;
          }
          if(e.target.closest('[data-cancel]')) return App.closeSheet();
          if(e.target.closest('[data-reset]')){
            delete t.kit;
            await save();
            kit = Coverage.kitFor(t, await Coverage.kit());
            App.closeSheet(); return render();
          }
          if(!e.target.closest('[data-save]')) return;
          t.kit = working;
          await save();
          kit = working;
          App.closeSheet(); render();
        });
      });
    }

    function editStep(i){
      const s = t.subs[i];
      App.sheet(`
        <h2>Edit step</h2>
        <div class="field"><label for="sx">Step</label>
          <input id="sx" type="text" value="${(s.t||'').replace(/"/g,'&quot;')}"></div>
        <div class="field"><label for="sn">Note <span style="text-transform:none;letter-spacing:0;font-weight:400">(optional)</span></label>
          <input id="sn" type="text" value="${(s.note||'').replace(/"/g,'&quot;')}" placeholder="Tools needed, or how to frame it"></div>
        <div class="sheetcta">
          <button class="btn-primary" data-save>Save</button>
          <button class="btn-ghost" data-cancel>Cancel</button>
        </div>
        <button class="btn-ghost" data-delete style="width:100%;margin-top:10px;color:var(--red);border-color:rgba(226,86,74,.4)">Delete step</button>`,
      sheetEl => {
        sheetEl.addEventListener('click', async e => {
          if(e.target.closest('[data-cancel]')) return App.closeSheet();
          if(e.target.closest('[data-delete]')){
            if(t.slotKey){
              const base = t.slotKey.startsWith('post|') ? t.slotKey.slice(5) : t.slotKey;
              if(!base.startsWith('shoot|')){
                await Pipeline.removeSlot(base);
                App.closeSheet();
                U.toast('Piece and its tasks removed');
                params && params.onChange && params.onChange();
                return Screens.pop();
              }
            }
            t.subs.splice(i,1); await save(); App.closeSheet(); return render();
          }
          if(!e.target.closest('[data-save]')) return;
          const v = sheetEl.querySelector('#sx').value.trim();
          if(!v) return U.toast('Say what the step is');
          s.t = v; s.note = sheetEl.querySelector('#sn').value.trim();
          await save(); App.closeSheet(); render();
        });
        setTimeout(() => { const f = sheetEl.querySelector('#sx'); if(f) f.focus(); }, 180);
      });
    }

    async function addShot(text){
      const v = String(text || '').trim();
      if(!v) return;
      t.shots = t.shots || [];
      t.shots.push({ id:'sh_' + Date.now().toString(36), text:v, note:'',
                     angles: Coverage.DEFAULT_PLAN.map(type => ({ type, done:false })) });
      await save(); render();
      const i = el.querySelector('#newshot');
      if(i) i.focus();
    }

    function editShot(i){
      const sh = t.shots[i];
      App.sheet(`
        <h2>Edit shot</h2>
        <div class="field"><label for="sh-t">The shot</label>
          <input id="sh-t" type="text" value="${(sh.text||'').replace(/"/g,'&quot;')}"></div>
        <div class="field"><label for="sh-n">Note <span style="text-transform:none;letter-spacing:0;font-weight:400">(optional)</span></label>
          <input id="sh-n" type="text" value="${(sh.note||'').replace(/"/g,'&quot;')}" placeholder="Wait for the light"></div>
        <div class="field"><label>Planned angles</label>
          <div class="angles">${(sh.angles || []).length
            ? sh.angles.map(a => `<span class="ang${a.done ? ' got' : ''}">${a.done ? '✓ ' : ''}${typeLabel(a.type)}</span>`).join('')
            : '<span style="color:var(--muted);font-size:14px">None planned yet</span>'}</div>
          <button class="btn-sm" data-planstrip style="width:100%;margin-top:12px;justify-content:center">Plan the angles</button>
        </div>
        <div class="sheetcta">
          <button class="btn-primary" data-save>Save</button>
          <button class="btn-ghost" data-cancel>Cancel</button>
        </div>
        <button class="btn-ghost" data-delete style="width:100%;margin-top:10px;color:var(--red);border-color:rgba(226,86,74,.4)">Delete shot</button>`,
      sheetEl => {
        sheetEl.addEventListener('click', async ev => {
          const opt = ev.target.closest('.opt');
          if(opt){
            const was = opt.getAttribute('aria-pressed') === 'true';
            sheetEl.querySelectorAll('[data-group="ty"] .opt').forEach(o => o.setAttribute('aria-pressed','false'));
            opt.setAttribute('aria-pressed', String(!was));
            return;
          }
          if(ev.target.closest('[data-planstrip]')){
            App.closeSheet();
            planning = i;
            setTimeout(render, 240);
            return;
          }
          if(ev.target.closest('[data-cancel]')) return App.closeSheet();
          if(ev.target.closest('[data-delete]')){
            t.shots.splice(i,1); await save(); App.closeSheet(); return render();
          }
          if(!ev.target.closest('[data-save]')) return;
          const v = sheetEl.querySelector('#sh-t').value.trim();
          if(!v) return U.toast('Describe the shot');
          sh.text = v;
          sh.note = sheetEl.querySelector('#sh-n').value.trim();
          await save(); App.closeSheet(); render();
        });
        setTimeout(() => { const f = sheetEl.querySelector('#sh-t'); if(f) f.focus(); }, 180);
      });
    }

    /* What this repeat currently runs at, counted from its own tasks rather than
       the stored label, which was written once when the series was created. */
    function seriesFreq(task){
      const run = allTasks.filter(x => x.series === task.series);
      if(!run.length) return task.cad || 'Repeating';
      const first = Math.min(...run.map(x => x.day));
      const wk = Math.floor((task.day - first) / 7);
      const n = run.filter(x => Math.floor((x.day - first) / 7) === wk).length;
      return Program.freqLabel(n);
    }

    /* The weekdays this repeat currently lands on. */
    function seriesDays(task, dowOf){
      const run = allTasks.filter(x => x.series === task.series);
      return [...new Set(run.map(x => dowOf(x.day)))].sort((a,b) => a - b);
    }

    async function editFrequency(task){
      const all = await Data.tasks();
      allTasks = all;

      let dowOf = d => ((d - 1) % 7 + 7) % 7;
      try {
        const base = new Date(await Data.dayToDate(task.day)).getDay();
        dowOf = d => ((base + (d - task.day)) % 7 + 7) % 7;
      } catch(err){ /* keep the fallback */ }

      const run = all.filter(x => x.series === task.series);
      const lastDay = Math.max(...run.map(x => x.day));
      let days = seriesDays(task, dowOf);

      const NAMES = ['Su','Mo','Tu','We','Th','Fr','Sa'];
      const order = [1,2,3,4,5,6,0];

      App.sheet(`
        <h2>How often?</h2>
        <p style="margin:0 0 16px;color:var(--muted);font-size:14.5px;line-height:1.6">
          Changing this rewrites the days from here to the end of the run.
          Anything already done or skipped stays exactly where it is.</p>
        <div class="field"><label>Repeat on</label>
          <div class="opts" data-group="dow">${order.map(n =>
            `<button type="button" class="opt" data-dow="${n}"
              aria-pressed="${days.includes(n)}">${NAMES[n]}</button>`).join('')}</div>
          <p class="hintline" id="rf-n"></p>
        </div>
        <div class="sheetcta">
          <button class="btn-primary" data-save>Save</button>
          <button class="btn-ghost" data-cancel>Cancel</button>
        </div>`, sheet => {

        const line = () => sheet.querySelector('#rf-n').textContent =
          days.length ? Program.freqLabel(days.length) + ' from here on' : 'Pick at least one day.';
        line();

        sheet.addEventListener('click', async ev => {
          const b = ev.target.closest('[data-dow]');
          if(b){
            const n = +b.dataset.dow;
            days = days.includes(n) ? days.filter(x => x !== n) : days.concat(n);
            b.setAttribute('aria-pressed', String(days.includes(n)));
            return line();
          }
          if(ev.target.closest('[data-cancel]')) return App.closeSheet();
          if(!ev.target.closest('[data-save]')) return;
          if(!days.length) return line();

          const weeks = Math.max(1, Math.ceil((lastDay - task.day + 1) / 7));
          const shape = { id:task.series, title:task.title, days:days.slice(), startDay:task.day,
                          weeks, freqRamp:{ mode:'none', everyWeeks:3, max:days.length },
                          amountRamp:{ mode:'none', everyWeeks:3, max:null },
                          amount:null, add:[], skip:[], ended:false };
          const plan = Program.diff(shape, all, task.day, { dowOf, key:'series' });

          let nextId = Math.max(0, ...all.map(x => +x.id || 0)) + 1;
          for(const id of plan.remove) await Store.del('tasks', id);
          for(const u of plan.update){
            const x = all.find(y => y.id === u.id);
            if(!x) continue;
            x.cad = u.cad;
            await Store.put('tasks', x);
          }
          for(const c of plan.create){
            const copy = { ...task, id:nextId++, day:c.day, cad:c.cad, view:'todo',
                           subs:(task.subs || []).map(x => ({ ...x, done:false })) };
            await Store.put('tasks', copy);
          }
          Data.invalidate('tasks');
          allTasks = await Data.tasks();
          App.closeSheet();
          U.toast(Program.freqLabel(days.length) + ' from here on');
          render();
        });
      });
    }

    /* The note saves as you leave the field rather than on every keystroke —
       a task write also re-sorts Today and re-syncs reminders. */
    el.addEventListener('change', async e => {
      if(e.target.id !== 'tk-note') return;
      t.notes = e.target.value.trim();
      await save();
    });

    el.addEventListener('click', async e => {
      const rm = e.target.closest('[data-rmshot]');
      if(rm){
        e.stopPropagation();
        try { await Store.del('task-media', rm.dataset.rmshot); } catch(err){}
        await loadShots();
        return render();
      }

      if(e.target.closest('[data-a="addshot"]')){
        return App.pickImage(async file => {
          if(!file) return;
          /* next free slot, so removing one in the middle does not collide */
          let n = 0;
          try {
            const blobs = await Store.allMap('task-media');
            const mine = Object.keys(blobs)
              .filter(k => k.split(':')[0] === String(t.id))
              .map(k => +k.split(':')[1] || 0);
            n = mine.length ? Math.max(...mine) + 1 : 0;
          } catch(err){}
          await Store.put('task-media', file, t.id + ':' + n);
          await loadShots();
          render();
        });
      }

      if(e.target.closest('[data-a="refreq"]')) return editFrequency(t);
      if(e.target.closest('[data-a="openplan"]')){ Screens.pop(); return Screens.push('program', { onChange:() => render() }); }

      const es = e.target.closest('[data-endseries]');
      if(es){
        const key = es.dataset.endseries;
        const all = await Data.tasks();
        const future = all.filter(x => x.series === key && x.view === 'todo' && x.day >= t.day);
        App.sheet(`
          <h2>End the repeat?</h2>
          <p style="margin:0 0 18px;color:var(--muted);font-size:15px;line-height:1.6">
            ${future.length} upcoming one${future.length === 1 ? '' : 's'} would be removed,
            starting with this one. Anything already done stays on the record.</p>
          <div class="sheetcta">
            <button class="btn-primary" data-yes style="background:var(--red)">Remove them</button>
            <button class="btn-ghost" data-cancel>Keep them</button>
          </div>`, sheetEl => {
          sheetEl.addEventListener('click', async ev => {
            if(ev.target.closest('[data-cancel]')) return App.closeSheet();
            if(!ev.target.closest('[data-yes]')) return;
            for(const x of future) await Store.del('tasks', x.id);
            Data.invalidate('tasks');
            App.closeSheet();
            U.toast(`${future.length} removed`);
            params && params.onChange && params.onChange();
            Screens.pop();
          });
        });
        return;
      }

      if(e.target.closest('[data-link-workout]')){
        const rs = await Routines.all();
        if(!rs.length) return U.toast('Save a workout first');
        App.sheet(`
          <h2>Link a workout</h2>
          <p style="margin:0 0 14px;color:var(--muted);font-size:14.5px;line-height:1.55">
            The task will start it, and its lifts become the steps.</p>
          <div class="group" style="margin:0 0 14px;max-height:44vh;overflow-y:auto">
            ${rs.map(r => `<button class="row" data-pickrt="${r.id}">
              <span class="lbl">${r.name}<small>${r.type ? r.type + ' · ' : ''}${
                r.items.length} lifts · about ${Routines.estimateMinutes(r)} min</small></span>
            </button>`).join('')}
          </div>
          <div class="sheetcta"><button class="btn-ghost" data-cancel>Cancel</button></div>`,
        sheetEl => {
          sheetEl.addEventListener('click', async ev => {
            if(ev.target.closest('[data-cancel]')) return App.closeSheet();
            const p2 = ev.target.closest('[data-pickrt]');
            if(!p2) return;
            const r = rs.find(x => x.id === p2.dataset.pickrt);
            t.kind = 'workout';
            t.routineId = r.id;
            t.mins = t.mins || Routines.estimateMinutes(r);
            if(!(t.subs || []).length){
              t.subs = r.items.map(i => ({ t:`${i.name} · ${i.sets}×${i.reps}`, done:false }));
            }
            await save();
            App.closeSheet();
            U.toast(`${r.name} linked`);
            render();
          });
        });
        return;
      }

      const sw = e.target.closest('[data-start-workout]');
      if(sw){
        const r = await Routines.get(sw.dataset.startWorkout);
        if(!r) return U.toast('That workout has been deleted');
        const preset = await Routines.toSession(r);
        await Routines.markRun(r.id);
        return Screens.push('session', { preset, onChange: () => { load().then(render); } });
      }
      const pc = e.target.closest('[data-plan-clip]');
      if(pc) return Screens.push('clip', { id: pc.dataset.planClip,
        /* open the clip on the tab for the job this task is */
        tab: { shoot:'shoot', edit:'edit', publish:'post' }[t.kind] });
      const fd = e.target.closest('[data-fold] > h4');
      if(fd){
        const k = fd.parentElement.dataset.fold;
        fold[k] = !fold[k];
        fd.parentElement.classList.toggle('open', fold[k]);
        return;
      }
      const sdel = e.target.closest('[data-shotdel]');
      if(sdel){
        const i = +sdel.dataset.shotdel;
        const gone = t.shots[i];
        t.shots.splice(i, 1);
        if(planning === i) planning = null;
        await save();
        U.toast(stepNo(gone) ? 'Removed — the step is still there' : 'Shot removed');
        return render();
      }

      const smv = e.target.closest('[data-shotmv]');
      if(smv){
        const [dir, idx] = smv.dataset.shotmv.split(':');
        const i = +idx, j = dir === 'up' ? i-1 : i+1;
        if(j < 0 || j >= t.shots.length) return;
        [t.shots[i], t.shots[j]] = [t.shots[j], t.shots[i]];
        if(planning === i) planning = j; else if(planning === j) planning = i;
        await save(); return render();
      }

      const ang = e.target.closest('[data-ang]');
      if(ang){
        const [si, ai] = ang.dataset.ang.split(':').map(Number);
        const a = t.shots[si].angles[ai];
        a.done = !a.done;
        /* stamp when it was actually shot — the edit wants a timecode, not a tick */
        if(a.done) a.doneAt = Date.now(); else delete a.doneAt;
        await save(); return render();
      }
      /* references linked to a shot */
      const rd = e.target.closest('[data-refdel]');
      if(rd){
        e.stopPropagation();
        const [si, ri] = rd.dataset.refdel.split(':').map(Number);
        (t.shots[si].refs || []).splice(ri, 1);
        await save(); return render();
      }
      const ro = e.target.closest('[data-refopen]');
      if(ro){
        e.stopPropagation();
        const [si, ri] = ro.dataset.refopen.split(':').map(Number);
        return Refs.view(t.shots[si].refs || [], ri);
      }
      const rl = e.target.closest('[data-reflink]');
      if(rl){
        e.stopPropagation();
        const si = +rl.dataset.reflink;
        return Refs.pick(t.shots[si].refs || [], async ids => {
          t.shots[si].refs = ids;
          await loadRefThumbs(t);
          await save();
          render();
        });
      }

      const pl = e.target.closest('[data-plan]');
      if(pl){
        const i = +pl.dataset.plan;
        planning = planning === i ? null : i;
        angQ = '';
        return render();
      }
      if(e.target.closest('[data-angclear]')){ angQ = ''; return render(); }

      const tg = e.target.closest('[data-toggleang]');
      if(tg){
        const sh = t.shots[planning];
        if(!sh) return;
        const type = tg.dataset.toggleang;
        sh.angles = sh.angles || [];
        const has = sh.angles.some(a => a.type === type);
        sh.angles = has
          ? sh.angles.filter(a => a.type !== type)          /* planned twice? both go */
          : [...sh.angles, { type, done:false }];
        await save(); return render();
      }
      const se = e.target.closest('[data-shotedit]');
      if(se) return editShot(+se.dataset.shotedit);

      const ts = e.target.closest('[data-tostep]');
      if(ts){
        const step = t.subs[+ts.dataset.tostep];
        t.shots = t.shots || [];
        const at = t.shots.findIndex(sh => norm(sh.text) === norm(step.t));
        if(at !== -1){
          const had = Coverage.shotGot(t.shots[at]);
          if(had) return U.toast('That shot has angles captured — remove it from the shot list');
          t.shots.splice(at, 1);
          if(planning === at) planning = null;
          await save();
          U.toast('Taken off the shot list');
          return render();
        }
        t.shots.push({ id:'sh_' + Date.now().toString(36), text:step.t, note:'',
                       angles: Coverage.DEFAULT_PLAN.map(type => ({ type, done:false })) });
        await save();
        U.toast('Added with its default angles');
        return render();
      }

      const st = e.target.closest('[data-step]');
      if(st && !e.target.closest('.mini')){
        const s = t.subs[+st.dataset.step];
        s.done = !s.done;
        if(t.subs.every(x => x.done)) t.view = 'done';
        else if(t.view === 'done') t.view = 'todo';
        await save(); return render();
      }
      const mv = e.target.closest('[data-mv]');
      if(mv){
        const [dir, idx] = mv.dataset.mv.split(':');
        const i = +idx, j = dir === 'up' ? i-1 : i+1;
        if(j < 0 || j >= t.subs.length) return;
        [t.subs[i], t.subs[j]] = [t.subs[j], t.subs[i]];
        await save(); return render();
      }
      const ed = e.target.closest('[data-edit]');
      if(ed) return editStep(+ed.dataset.edit);

      const a = e.target.closest('[data-a]');
      if(!a) return;

      if(a.dataset.a === 'editkit') return editKit();
      if(a.dataset.a === 'addstep') return addStep(el.querySelector('#newstep').value);
      if(a.dataset.a === 'addshot') return addShot(el.querySelector('#newshot').value);
      if(a.dataset.a === 'sortshots'){
        /* step-linked shots first, in step order; everything else keeps its place after */
        const withNo = t.shots.map((sh,i) => ({ sh, n:stepNo(sh), i }));
        withNo.sort((x,y) => {
          if(x.n && y.n) return x.n - y.n;
          if(x.n) return -1;
          if(y.n) return 1;
          return x.i - y.i;
        });
        t.shots = withNo.map(x => x.sh);
        planning = null;
        await save(); return render();
      }
      if(a.dataset.a === 'allshots'){
        t.shots = t.shots || [];
        let n = 0;
        (t.subs || []).forEach(step => {
          if(hasShot(step.t)) return;
          t.shots.push({ id:'sh_' + Date.now().toString(36) + n, text:step.t, note:'', fromStep:true,
                         angles: Coverage.DEFAULT_PLAN.map(type => ({ type, done:false })) });
          n++;
        });
        await save();
        U.toast(n ? `Added ${n} shot${n===1?'':'s'}` : 'All steps were already there');
        return render();
      }
      if(a.dataset.a === 'allon'){ t.subs.forEach(s => s.done = true); t.view = 'done'; await save(); return render(); }
      if(a.dataset.a === 'alloff'){ t.subs.forEach(s => s.done = false); t.view = 'todo'; await save(); return render(); }
      if(a.dataset.a === 'toggle'){
        const nowDone = t.view !== 'done';
        t.view = nowDone ? 'done' : 'todo';
        (t.subs || []).forEach(s => s.done = nowDone);
        await save(); return render();
      }
      if(a.dataset.a === 'swipe') return Screens.push('swipe', { id:t.swipeId });

      if(a.dataset.a === 'rename'){
        App.sheet(`<h2>Rename task</h2>
          <div class="field"><label for="tt">Title</label>
            <input id="tt" type="text" value="${t.title.replace(/"/g,'&quot;')}"></div>
          <div class="sheetcta"><button class="btn-primary" data-save>Save</button>
            <button class="btn-ghost" data-cancel>Cancel</button></div>`, sheetEl => {
          sheetEl.addEventListener('click', async ev => {
            if(ev.target.closest('[data-cancel]')) return App.closeSheet();
            if(!ev.target.closest('[data-save]')) return;
            const v = sheetEl.querySelector('#tt').value.trim();
            if(!v) return U.toast('Give it a title');
            t.title = v; await save(); App.closeSheet(); render();
          });
        });
        return;
      }

      if(a.dataset.a === 'when'){
        const field = await U.dayField('td', t.day);
        App.sheet(`<h2>When</h2>
          ${field}
          <div class="field"><label for="tm">Time <span style="text-transform:none;letter-spacing:0;font-weight:400">(optional)</span></label>
            <input id="tm" type="time" value="${t.at || ''}"></div>
          <div class="sheetcta"><button class="btn-primary" data-save>Save</button>
            <button class="btn-ghost" data-cancel>Cancel</button></div>`, sheetEl => {
          U.wireDayField(sheetEl, 'td');
          sheetEl.addEventListener('click', async ev => {
            if(ev.target.closest('[data-cancel]')) return App.closeSheet();
            if(!ev.target.closest('[data-save]')) return;
            const n = await U.readDayField(sheetEl, 'td');
            if(n) t.day = n;
            t.at = sheetEl.querySelector('#tm').value || null;
            await save(); App.closeSheet(); render();
          });
        });
        return;
      }

      if(a.dataset.a === 'cad' || a.dataset.a === 'pri'){
        const isCad = a.dataset.a === 'cad';
        const opts = isCad ? CADENCES.map(c => [c,c]) : PRI;
        App.sheet(`<h2>${isCad ? 'Cadence' : 'Priority'}</h2>
          <div class="group compact" style="margin:0">
            ${opts.map(([v,n]) => `<button class="row" data-v="${v}">
              <span class="lbl">${n}</span>
              ${(isCad ? t.cad : t.pri) === v ? `<span style="color:var(--orange)">${ICON.check}</span>` : ''}
            </button>`).join('')}
          </div>
          <div class="sheetcta"><button class="btn-ghost" data-cancel style="flex:1">Cancel</button></div>`,
        sheetEl => {
          sheetEl.addEventListener('click', async ev => {
            if(ev.target.closest('[data-cancel]')) return App.closeSheet();
            const b = ev.target.closest('[data-v]');
            if(!b) return;
            if(isCad) t.cad = b.dataset.v; else t.pri = b.dataset.v;
            await save(); App.closeSheet(); render();
          });
        });
        return;
      }

      if(a.dataset.a === 'delete'){
        await Store.del('tasks', t.id);
        Data.invalidate('tasks');
        params.onChange && params.onChange();
        Screens.pop();
      }
    });

    await load();
    await loadShots();
    SwipeRefs.wire(el, {
      getOwn: () => ownRefs().concat(clipRefs(), planRefs()),
      add: async sid => {
        t.swipeIds = (t.swipeIds || []).concat(sid);
        refsOpen = true;
        await save(); render();
        U.toast('Swipe linked');
      },
      remove: async sid => {
        t.swipeIds = (t.swipeIds || []).filter(x => x !== sid);
        if(t.swipeId === sid) t.swipeId = null;
        await save(); render();
      },
      onOpenChange: () => render()
    });
    render();
  }

  Screens.register('task', mount);
})();
