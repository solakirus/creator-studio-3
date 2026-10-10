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
window.CS3Board = { openFromHash, videoBoardId, items: () => state.items, current: () => state.board };

(async function init() {""")

open(sys.argv[2] if len(sys.argv) > 2 else 'app/board/board.html', 'w', encoding='utf-8').write(out)
print('ported', len(src), '->', len(out), 'bytes')
