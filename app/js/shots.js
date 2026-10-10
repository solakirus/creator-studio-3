/* Every shot you have planned, wherever it lives.

   A shot is written on a task or on an episode beat, which is right — that is
   where you plan. But when you are standing somewhere with a camera, the useful
   question is not "which task is this" but "what can I get while I am here".
   This gathers them all into one list you can cut by place, by framing, or by
   what is still outstanding. */
(function(global){

  /* Places you shoot. Yours, added as you go, because nobody else's list of
     locations is any use to you. */
  async function locations(){
    try { return (await Store.get('settings', 'shot-locations')) || []; }
    catch(e){ return []; }
  }
  async function addLocation(name){
    const n = String(name || '').trim();
    if(!n) return null;
    const list = await locations();
    if(!list.some(x => x.toLowerCase() === n.toLowerCase())) list.push(n);
    await Store.put('settings', list, 'shot-locations');
    return n;
  }
  /* Locations actually in use, so the filter never offers an empty one. */
  async function usedLocations(){
    const all = await gather();
    return [...new Set(all.map(s => s.location).filter(Boolean))].sort();
  }

  /* Pull every shot out of tasks and episodes into one shape. */
  async function gather(){
    const out = [];

    let tasks = [];
    try { tasks = await Data.tasks(); } catch(e){ tasks = []; }
    tasks.forEach(t => {
      (t.shots || []).forEach((s, i) => {
        const angles = s.angles || [];
        out.push({
          key: `task:${t.id}:${i}`,
          name: s.name || 'Shot',
          location: s.location || '',
          framing: (angles[0] || {}).n || '',
          movement: s.movement || '',
          refs: s.refs || [],
          angles,
          captured: angles.length ? angles.every(a => a.done) : false,
          partly: angles.some(a => a.done) && !angles.every(a => a.done),
          source: 'task', sourceId: t.id, sourceName: t.title,
          day: t.day, at: t.at || '',
          kind: t.kind || ''
        });
      });
    });

    let vlogs = [];
    try { const { values } = await Store.all('vlogs'); vlogs = values; }
    catch(e){ vlogs = []; }
    vlogs.forEach(v => (v.acts || []).forEach(a => (a.beats || []).forEach(b => {
      (b.shots || []).forEach((s, i) => {
        out.push({
          key: `beat:${b.id}:${i}`,
          name: s.text || s.name || 'Shot',
          location: s.location || '',
          framing: s.framing || '',
          movement: s.movement || '',
          refs: s.refs || [],
          angles: [],
          captured: !!s.done,
          partly: false,
          source: 'beat', sourceId: b.id, vlogId: v.id,
          sourceName: `${v.title} · ${b.title}`,
          day: b.day || null, at: b.at || '',
          kind: 'shoot'
        });
      });
    })));

    return out;
  }

  /* Grouped by place, because that is how a shoot day is actually planned.
     Anything without a location sorts last rather than pretending to be a place. */
  function byLocation(shots){
    const map = {};
    shots.forEach(s => {
      const k = s.location || '';
      (map[k] = map[k] || []).push(s);
    });
    return Object.entries(map)
      .sort((a, b) => a[0] === '' ? 1 : b[0] === '' ? -1 : a[0].localeCompare(b[0]))
      .map(([location, items]) => ({
        location, items,
        outstanding: items.filter(s => !s.captured).length
      }));
  }

  function stats(shots){
    const captured = shots.filter(s => s.captured).length;
    return {
      total: shots.length, captured,
      outstanding: shots.length - captured,
      pct: shots.length ? Math.round(captured / shots.length * 100) : 0
    };
  }

  /* Writing a location back onto whichever thing owns the shot. */
  async function setLocation(shot, location){
    if(shot.source === 'task'){
      const tasks = await Data.tasks();
      const t = tasks.find(x => x.id === shot.sourceId);
      if(!t) return false;
      const i = +shot.key.split(':')[2];
      if(!t.shots[i]) return false;
      t.shots[i].location = location;
      await Store.put('tasks', t);
      Data.invalidate('tasks');
      return true;
    }
    const { values } = await Store.all('vlogs');
    const v = values.find(x => x.id === shot.vlogId);
    if(!v) return false;
    for(const a of (v.acts || [])){
      const b = (a.beats || []).find(x => x.id === shot.sourceId);
      if(!b) continue;
      const i = +shot.key.split(':')[2];
      if(!b.shots[i]) return false;
      b.shots[i].location = location;
      await Store.put('vlogs', v);
      return true;
    }
    return false;
  }

  global.Shots = { gather, byLocation, stats, locations, addLocation,
                   usedLocations, setLocation };
})(window);
