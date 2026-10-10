"""Ports Storyboard's www/index.html into Creator Studio 3 as app/board/board.html.

Run once (kept for the record of exactly what changed):
    python3 scripts/port-board.py path/to/storyboard/www/index.html
Every edit is an exact-match replace that must hit exactly once, so a changed
source fails loudly instead of half-porting."""
import sys, re
src = open(sys.argv[1], encoding='utf-8').read()
out = src

def rep(old, new, count=1):
    global out
    n = out.count(old)
    if n != count:
        sys.exit(f'expected {count} match(es), found {n}: {old[:80]!r}')
    out = out.replace(old, new)

# --- title, theme comes from Creator Studio, its fonts load locally
rep('<title>Storyboard</title>', '<title>Board · Creator Studio 3</title>')
rep('<script>try{var t=localStorage.getItem("storyboard-theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}</script>',
    '''<script>
/* Creator Studio 3: this page runs inside the app (an iframe on the Board
   screen). The theme and colours follow Creator Studio's, read from the
   page around it; on its own it falls back to Storyboard's look. */
(function(){
  var r = document.documentElement;
  try {
    var P = window.parent !== window ? window.parent : null;
    if (P && P.document) {
      var cs = P.getComputedStyle(P.document.documentElement);
      var v = function(n){ return cs.getPropertyValue(n).trim(); };
      if (v('--bg')) {
        r.dataset.cs3 = '1';
        var map = { '--table':'--bg', '--chrome':'--surface-1', '--card':'--surface-2', '--ink':'--cream',
          '--muted':'--muted', '--line':'--line', '--field':'--surface-2', '--field-hover':'--line',
          '--slate':'--orange', '--slate-bar':'--surface-1', '--frame':'--surface-1', '--wire':'--muted',
          '--danger':'--red' };
        for (var k in map) if (v(map[k])) r.style.setProperty(k, v(map[k]));
        r.style.setProperty('--on-slate', v('--bg'));
        r.style.setProperty('--dot', 'color-mix(in srgb, ' + v('--cream') + ' 10%, transparent)');
        var mode = P.document.documentElement.dataset.mode;
        r.dataset.theme = mode === 'light' ? 'light' : 'dark';
      }
    }
  } catch (e) {}
})();
</script>
<link rel="stylesheet" href="../fonts/fonts.css">''')
rep('font-family:"Instrument Sans",system-ui,', 'font-family:"DM Sans","Instrument Sans",system-ui,', count=3)

# CS3 look: square corners, hard offset shadow on the chrome, no theme button
rep('</style>', ''':root[data-cs3] #themeBtn{display:none}
:root[data-cs3] #studioBack{display:none!important}
:root[data-cs3] .crumb-name,:root[data-cs3] #boardTitle{font-family:"Red Hat Display","DM Sans",sans-serif;font-weight:900}
</style>''')

# --- the Capacitor plugins live on the app's window, not the iframe's
rep("""<script>
(() => {
const $ = s => document.querySelector(s);""", """<script>
if (!window.Capacitor && window.parent !== window) { try { window.Capacitor = window.parent.Capacitor; } catch (e) {} }
(() => {
const $ = s => document.querySelector(s);""")

# --- storage: the app's own database, store 'board-items'
rep("""  async open() {
    try {
      this.db = await new Promise((res, rej) => {
        const r = indexedDB.open('storyboard-canvas', 1);
        r.onupgradeneeded = () => r.result.createObjectStore('items', { keyPath: 'id' });
        r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
      });
    } catch (e) { this.mem = true; }
  },
  store(mode) { return this.db.transaction('items', mode).objectStore('items'); },""",
"""  /* Creator Studio 3: boards live in the app's database ('creator-studio-3',
     store 'board-items'), so Export everything carries them. Inside the app the
     page borrows the app's open connection; on its own it opens the database
     at whatever version the app made. */
  async open() {
    try {
      const P = window.parent !== window ? window.parent : null;
      if (P && P.Store && P.Store.db) this.db = await P.Store.db();
      else this.db = await new Promise((res, rej) => {
        const r = indexedDB.open('creator-studio-3');
        r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
      });
      if (!this.db.objectStoreNames.contains('board-items')) throw new Error('no board store');
    } catch (e) { this.mem = true; }
  },
  store(mode) { return this.db.transaction('board-items', mode).objectStore('board-items'); },""")

# --- the app has its own Export everything; this one only covers boards
rep('<button id="sideExportAll" class="txt-btn" type="button">Export everything</button>',
    '<button id="sideExportAll" class="txt-btn" type="button">Export all boards</button>')
rep("exportBackup(); } }, 'Export everything'),", "exportBackup(); } }, 'Export all boards'),")

# --- links: cs3://board/<id>, no trip back to another app
rep("const boardLink = id => `storyboard://board/${id}`;", "const boardLink = id => `cs3://board/${id}`;")
rep("copied. Paste it into Creator Studio.`", "copied.`")
rep("  StudioLink.start();\n", "")

# --- weekly template: Day 1 is 1 Oct 2026; episodes count from the Sunday of that week
rep("""  const DAY1 = new Date(2026, 8, 27);
  const dayNo = n => Math.round((addD(n) - DAY1) / 864e5) + 1;
  const epNo = Math.floor(Math.round((sun - DAY1) / 864e5) / 7) + 1;""",
"""  const DAY1 = new Date(2026, 9, 1);                 /* Day 1 = Thu 1 Oct 2026 */
  const WEEK1 = new Date(DAY1); WEEK1.setDate(DAY1.getDate() - DAY1.getDay());   /* its Sunday */
  const dayNo = n => Math.round((addD(n) - DAY1) / 864e5) + 1;
  const epNo = Math.floor(Math.round((sun - WEEK1) / 864e5) / 7) + 1;""")

# --- an episode's board is its shots (see app/js/boardsync.js)
rep("""function save(item, now) {
  markDirty(item.id);""", """function save(item, now) {
  markDirty(item.id); cs3Changed(item);""")
rep("function add(item) { state.items.set(item.id, item); DB.put(item); markDirty(item.id); return item; }",
    "function add(item) { state.items.set(item.id, item); DB.put(item); markDirty(item.id); cs3Changed(item); return item; }")
rep("""function deleteCards(ids) {
  const items = collect(ids);""", """function deleteCards(ids) {
  cs3Deleting(ids);
  const items = collect(ids);""")
rep("""  else if (!b.view) requestAnimationFrame(() => requestAnimationFrame(fit));
}""", """  else if (!b.view) requestAnimationFrame(() => requestAnimationFrame(fit));
  cs3AfterOpen(id);
}""")
rep("""  const choose = () => pickFile('image/*', async f => { c.data[key] = await imageToData(f); save(c, true); render(); });""",
"""  const fromFile = () => pickFile('image/*', async f => { c.data[key] = await imageToData(f); delete c.data.refId; save(c, true); render(); });
  /* Creator Studio 3: the stills picker first — your Reference Library, one
     still at a time — with files one tap away inside it */
  const choose = async () => {
    const P = cs3Parent();
    if (!P || !P.StillsPicker) return fromFile();
    const r = await P.StillsPicker.open({ title: String(c.data.desc || c.data.cap || 'Reference').slice(0, 60) });
    if (!r) return;
    if (r.file) return fromFile();
    const data = await P.BoardSync.stillData(r.refId);
    if (!data) { toast("Couldn't load that still."); return; }
    c.data[key] = data; c.data.refId = r.refId; save(c, true); render();
    cs3Still(c, r.refId);
  };""")
rep("""      txt(c, 'desc', 'What happens in this shot'), txt(c, 'vo', 'Voiceover or dialogue', 'vo'), txt(c, 'trans', 'Transition to the next shot', 'trans'));""",
"""      txt(c, 'desc', 'What happens in this shot'), txt(c, 'vo', 'Voiceover or dialogue', 'vo'), txt(c, 'trans', 'Transition to the next shot', 'trans'));
    if (c.data.ref) body.querySelector('.row').append(cs3Badge(c));""")
rep("""(async function init() {""", r"""/* ---------- Creator Studio 3: an episode's board is its shots ----------
   Each of the episode's sequences is a Section (data.beat = its id) and each
   of its shots a shot card inside it (data.ref = { beat, id }). The episode
   owns the shots; app/js/boardsync.js reads and writes them. On opening, the
   board catches up with the episode (new sections go below what is there,
   new shots at the end of their row — nothing you placed is moved). Edits to
   a linked card go back to the episode half a second later. */
const cs3Parent = () => { try { return window.parent !== window ? window.parent : null; } catch (e) { return null; } };
const cs3Api = () => { const P = cs3Parent(); return P && P.BoardSync ? P.BoardSync : null; };
const cs3Video = boardId => { const b = state.items.get(boardId); return b && b.video && b.video.type === 'vlog' ? b.video : null; };
const CS3 = { SHOT_W: 300, GAP: 30, ROW_H: 470, PAD: 24, HEAD: 64 };
let cs3Pulling = false;
function frameOfCard(c) {
  const cx = c.x + (c.w || CS3.SHOT_W) / 2, cy = c.y + 40;
  return cardsOf(c.board).filter(f => f.type === 'frame' && f.data && f.data.beat)
    .find(f => cx >= f.x && cx <= f.x + f.w && cy >= f.y && cy <= f.y + (f.h || 380)) || null;
}
function cs3Quiet(c) { cs3Pulling = true; try { save(c, true); } finally { cs3Pulling = false; } }
function cs3Rebuild(c) { const el = cardEl(c.id); if (el) { el.replaceWith(buildCard(c)); scheduleWires(); } }
function cs3Badge(c) {
  const p = c.data.prog || {};
  const t = p.done ? 'In the can' : p.sent ? `${p.got}/${p.want} angles` : 'Not shot';
  return h('span', { class: 'cs3-prog' + (p.done ? ' done' : p.got ? ' part' : ''), title: 'This shot is in the episode. Progress comes from Shoot mode.' }, t);
}
async function cs3FillStill(c, refId) {
  const api = cs3Api(); if (!api) return;
  const d = await api.stillData(refId);
  if (!d || c.data.img) return;
  c.data.img = d; c.data.refId = refId; cs3Quiet(c); cs3Rebuild(c);
}
function cs3Still(c, refId) {
  const api = cs3Api(), video = cs3Video(c.board);
  if (api && video && c.type === 'shot' && c.data.ref) api.setStill(video, c.data.ref, refId);
}
function cs3AfterOpen(id) { if (cs3Video(id)) cs3Pull(id); }
async function cs3Pull(boardId) {
  const api = cs3Api(), video = cs3Video(boardId); if (!api || !video) return;
  let m; try { m = await api.model(video); } catch (e) { console.warn('Board sync: could not read the episode', e); return; }
  if (!m || state.board !== boardId) return;
  cs3Pulling = true;
  try {
    const cards = cardsOf(boardId);
    const frames = new Map(cards.filter(c => c.type === 'frame' && c.data.beat).map(c => [c.data.beat, c]));
    const shotCards = new Map(cards.filter(c => c.type === 'shot' && c.data.ref).map(c => [c.data.ref.id, c]));
    const live = new Set();
    let nextY = cards.length ? Math.max(...cards.map(c => c.y + (c.type === 'frame' ? (c.h || 380) : 360))) + 80 : 0;
    nextY = Math.ceil(nextY / GRID) * GRID;
    for (const beat of m.beats) {
      let f = frames.get(beat.id);
      if (!f) {
        const width = CS3.PAD * 2 + Math.max(3, beat.shots.length) * (CS3.SHOT_W + CS3.GAP) - CS3.GAP;
        f = mk(boardId, 'frame', 0, nextY, { title: beat.act ? `${beat.title}` : beat.title, beat: beat.id }, width);
        f.h = CS3.ROW_H; save(f, true);
        nextY += CS3.ROW_H + 60;
      } else if (f.data.title !== beat.title) { f.data.title = beat.title; save(f, true); }
      beat.shots.forEach((s, j) => {
        live.add(s.id);
        const prog = { got: s.got, want: s.want, done: s.done, sent: s.sent };
        let c = shotCards.get(s.id);
        if (!c) {
          const inRow = cardsOf(boardId).filter(x => x.type === 'shot' && x.id !== f.id && frameOfCard(x) === f);
          const x = inRow.length ? Math.max(...inRow.map(x => x.x + x.w)) + CS3.GAP : f.x + CS3.PAD;
          c = mk(boardId, 'shot', x, f.y + CS3.HEAD, { num: String(j + 1), dur: '', cam: s.cam, desc: s.text, vo: '', trans: '', must: false,
            ref: { beat: beat.id, id: s.id }, prog }, CS3.SHOT_W);
          if (x + CS3.SHOT_W + CS3.PAD > f.x + f.w) { f.w = x + CS3.SHOT_W + CS3.PAD - f.x; save(f, true); }
          if (s.refs && s.refs[0]) cs3FillStill(c, s.refs[0]);
        } else {
          let ch = false;
          const el = cardEl(c.id), focused = !!(el && el.contains(document.activeElement));
          if (!focused && (c.data.desc || '') !== s.text) { c.data.desc = s.text; ch = true; }
          if (!focused && (c.data.cam || '') !== s.cam) { c.data.cam = s.cam; ch = true; }
          if (c.data.ref.beat !== beat.id) { c.data.ref.beat = beat.id; ch = true; }
          if (c.data.num !== String(j + 1)) { c.data.num = String(j + 1); ch = true; }   /* numbered in sequence order */
          if (JSON.stringify(c.data.prog || null) !== JSON.stringify(prog)) { c.data.prog = prog; ch = true; }
          if (!c.data.img && s.refs && s.refs[0]) cs3FillStill(c, s.refs[0]);
          if (ch) save(c, true);
        }
      });
    }
    shotCards.forEach((c, id) => { if (!live.has(id)) { delete c.data.ref; delete c.data.prog; save(c, true); } });
    const beats = new Set(m.beats.map(b => b.id));
    frames.forEach((f, id) => { if (!beats.has(id)) { delete f.data.beat; save(f, true); } });
  } finally { cs3Pulling = false; }
  if (state.board === boardId) { renderBoard(); resetHistory(); }
}
const cs3Dirty = new Set(), cs3Snap = new Map(); let cs3T;
function cs3Changed(item) {
  if (cs3Pulling || !item || item.kind !== 'card' || !cs3Video(item.board)) return;
  cs3Dirty.add(item.id); clearTimeout(cs3T); cs3T = setTimeout(cs3Push, 500);
}
async function cs3Push() {
  const api = cs3Api(); if (!api) return;
  const ids = [...cs3Dirty]; cs3Dirty.clear();
  const rows = new Map();
  for (const id of ids) {
    const c = state.items.get(id); if (!c) continue;
    const video = cs3Video(c.board); if (!video) continue;
    try {
      if (c.type === 'frame' && c.data.beat) { await api.renameBeat(video, c.data.beat, c.data.title); continue; }
      if (c.type !== 'shot') continue;
      const f = frameOfCard(c);
      if (c.data.ref) {
        const r = await api.saveShot(video, c.data.ref, { text: c.data.desc || '', cam: c.data.cam || '' });
        if (r === 'missing') {
          const snap = cs3Snap.get(c.data.ref.id);
          if (snap) { await api.addShot(video, snap.beat, null, snap); cs3Snap.delete(c.data.ref.id); }
          else { delete c.data.ref; delete c.data.prog; cs3Quiet(c); cs3Rebuild(c); continue; }
        }
        if (f && f.data.beat !== c.data.ref.beat) { await api.moveShot(video, c.data.ref.id, f.data.beat); c.data.ref.beat = f.data.beat; cs3Quiet(c); }
        rows.set(c.data.ref.beat, c.board);
      } else if (f && (c.data.desc || '').trim()) {
        const sid = await api.addShot(video, f.data.beat, { text: c.data.desc, cam: c.data.cam || '' });
        if (sid) {
          c.data.ref = { beat: f.data.beat, id: sid }; c.data.prog = { got: 0, want: 1, done: false, sent: false };
          cs3Quiet(c); cs3Rebuild(c); rows.set(f.data.beat, c.board);
          if (c.data.refId) cs3Still(c, c.data.refId);
        }
      }
    } catch (e) { console.warn('Board sync: could not save', e); }
  }
  for (const [beat, board] of rows) {
    const order = cardsOf(board).filter(x => x.type === 'shot' && x.data.ref && x.data.ref.beat === beat)
      .sort((a, b) => (a.x - b.x) || (a.y - b.y)).map(x => x.data.ref.id);
    try { await api.reorder(cs3Video(board), beat, order); } catch (e) {}
    order.forEach((sid, i) => {
      const c = cardsOf(board).find(x => x.type === 'shot' && x.data.ref && x.data.ref.id === sid);
      if (c && c.data.num !== String(i + 1)) { c.data.num = String(i + 1); cs3Quiet(c); cs3Rebuild(c); }
    });
  }
}
function cs3Deleting(ids) {
  const api = cs3Api(); if (!api) return;
  const cards = ids.map(id => state.items.get(id)).filter(c => c && c.kind === 'card' && cs3Video(c.board));
  if (cards.some(c => c.type === 'frame' && c.data.beat))
    setTimeout(() => toast('Sections come from the episode, so this one will be back next time. To remove it, delete the sequence in the episode.'), 50);
  (async () => {
    for (const c of cards) {
      if (c.type !== 'shot' || !c.data.ref) continue;
      const r = await api.removeShot(cs3Video(c.board), c.data.ref.id);
      if (r && r.removed) cs3Snap.set(c.data.ref.id, r.snapshot);
      else if (r && r.reason === 'footage') toast('That shot has footage, so it stays in the episode. It will be back on the board next time.');
    }
  })();
}
window.CS3Sync = { pull: cs3Pull, push: cs3Push, frameOfCard };

(async function init() {""")
rep(""":root[data-cs3] #themeBtn{display:none}""", """:root[data-cs3] #themeBtn{display:none}
.cs3-prog{font-size:11px;line-height:1;padding:5px 7px;border-radius:4px;border:1px solid var(--line);color:var(--muted);white-space:nowrap;margin-left:auto;align-self:center}
:root[data-cs3] .frame-title{font-family:"Red Hat Display","DM Sans",sans-serif;font-weight:900}
/* Storyboard bug: '.t-shot .card-bar .f{width:auto}' outranked the number and
   duration widths, so the shot bar ran ~180px past the card's edge */
.t-shot .card-bar .f.num{width:4ch}
.t-shot .card-bar .f.dur{width:6ch}
.t-shot .card-bar{overflow:hidden}
.cs3-prog.part{color:#E8A33D;border-color:#E8A33D}
.cs3-prog.done{color:#5BBE6A;border-color:#5BBE6A}""")

# --- open the board the app asks for: #board=<id>, or #video=<type>:<id>&name=…&status=…&due=…
rep("""  openBoard(root.id);
  try { if (localStorage.getItem('storyboard-side') === '1' && !isNarrow()) setSide(true); } catch (e) {}""",
"""  openBoard(root.id);
  try { if (localStorage.getItem('storyboard-side') === '1' && !isNarrow()) setSide(true); } catch (e) {}
  openFromHash();
  window.addEventListener('hashchange', openFromHash);""")
rep("""(async function init() {""", """/* ---------- Creator Studio 3: every video has its own board ----------
   The app opens this page with #video=vlog:<id> (an episode) or
   #video=clip:<id>, plus the video's name, status and due date. The board for
   that video has a fixed id, so asking twice opens the same board; it sits in
   a "Videos" folder under the root. Name, status and due date come from the
   video every time — the video is where they are owned. */
const VIDEO_FOLDER = 'cs3-videos';
const videoBoardId = (type, id) => `vb-${type}-${String(id).replace(/[^\\w-]/g, '_')}`;
function ensureVideoBoard(type, id, meta) {
  const root = rootBoard(); if (!root) return null;
  if (!state.items.get(VIDEO_FOLDER)) add({ id: VIDEO_FOLDER, kind: 'board', name: 'Videos', parent: root.id, view: null, status: 'folder', isFolder: true });
  const bid = videoBoardId(type, id);
  let b = state.items.get(bid);
  if (!b) b = add({ id: bid, kind: 'board', name: meta.name || 'Untitled video', parent: VIDEO_FOLDER, view: null, status: meta.status || 'idea', due: meta.due || '', video: { type, id } });
  else {
    let changed = false;
    for (const k of ['name', 'status', 'due']) if (meta[k] && b[k] !== meta[k]) { b[k] = meta[k]; changed = true; }
    if (!b.video) { b.video = { type, id }; changed = true; }
    if (changed) save(b, true);
  }
  return bid;
}
function openFromHash() {
  /* the app puts what to open on the frame itself (works for the inline
     preview too, where there is no URL to carry a #) */
  let hash = location.hash;
  try { if (window.frameElement && window.frameElement.dataset.hash) hash = window.frameElement.dataset.hash; } catch (e) {}
  const q = new URLSearchParams(String(hash || '').replace(/^#/, ''));
  if (q.get('side') === '1') setSide(true);
  let target = q.get('board');
  const video = q.get('video');
  if (video && video.includes(':')) {
    const i = video.indexOf(':');
    target = ensureVideoBoard(video.slice(0, i), video.slice(i + 1),
      { name: q.get('name') || '', status: q.get('status') || '', due: q.get('due') || '' });
  }
  if (target && state.items.get(target)) { if (state.mode !== 'canvas') setMode('canvas'); openBoard(target); }
}
window.CS3Board = { openFromHash, videoBoardId, items: () => state.items, current: () => state.board,
  _: { mk, save, add, deleteCards, cardsOf } };   /* _ is for the browser tests */

(async function init() {""")

open(sys.argv[2] if len(sys.argv) > 2 else 'app/board/board.html', 'w', encoding='utf-8').write(out)
print('ported', len(src), '->', len(out), 'bytes')
