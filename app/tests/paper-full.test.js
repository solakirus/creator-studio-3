/* Full view, turning the pages, and the journal route.

   The journal writer is the part worth exercising rather than asserting:
   it appends under a heading, and re-reading the same box has to replace its
   own section instead of stacking another copy.  */
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');

let pass = 0, fail = 0;
const t = (name, cond, extra = '') => {
  console.log(`  ${cond ? 'ok ' : 'FAIL'}  ${name.padEnd(52)} ${extra}`);
  cond ? pass++ : fail++;
};
const head = s => console.log(`\n— ${s} —`);

const paper = fs.readFileSync(path.join(ROOT, 'js/paper.js'), 'utf8');
const scr   = fs.readFileSync(path.join(ROOT, 'js/screens/paper-screen.js'), 'utf8');
const css   = fs.readFileSync(path.join(ROOT, 'paper.css'), 'utf8');

head('full view');
t('there is a button for it', /data-pa="full"/.test(paper));
t('it shows a close affordance when open', /✕ Close/.test(paper));
t('it is a class, not the Fullscreen API', /pp-full/.test(css) && !/requestFullscreen/.test(paper));
t('the toolbar stays reachable', /\.pp-host\.pp-full \.pp-bar\{position:sticky/.test(css));

head('turning the pages');
t('an edge strip either side', /pp-turn prev/.test(paper) && /pp-turn next/.test(paper));
t('arrow keys turn it', /ArrowLeft/.test(paper) && /ArrowRight/.test(paper));
t('page up and down too', /PageUp/.test(paper) && /PageDown/.test(paper));
t('escape leaves full view', /e\.key === 'Escape'/.test(paper));
t('not while typing into something', /INPUT\|TEXTAREA\|SELECT/.test(paper));
t('and not over an open dialog', /dialog\[open\]/.test(paper));
t('the listener is removed when full view closes', /removeEventListener\('keydown', onKey\)/.test(paper));
t('the strips keep out of the page', /pp-turn/.test(paper) && /margin >= 34/.test(paper));
t('and are hidden when there is no margin', /b\.disabled = !room/.test(paper));

head('the journal route');
t('the two journal boxes are marked', /journal: 'Mindful morning'/.test(paper) && /journal: 'Evening reflection'/.test(paper));
t('the flag reaches the element', /data-journal=/.test(paper));
t('the dialog offers it', /pp-jr/.test(paper));
t('only when the host can write a journal', /ctx\.journal && H\.journal/.test(paper));
t('the screen provides the writer', /journal: async \(date, heading, text\)/.test(scr));
t('keyed by date, one entry per day', /Store\.get\('journal', id\)/.test(scr));

/* --- the writer itself, lifted as written --- */
head('appending to a day without stacking copies');
const db = {};
global.Store = {
  get: async (s, k) => db[k],
  put: async (s, v) => { db[v.id] = v; }
};
global.Data = { invalidate(){} };
const m = scr.match(/journal: (async \(date, heading, text\) => \{[\s\S]*?\n      \}),\n      ai:/);
const journal = eval('(' + m[1] + ')');

(async () => {
  await journal('2026-10-13', 'Mindful morning', 'Grateful for the quiet.');
  t('it creates the entry', !!db['2026-10-13']);
  t('under its heading', /## Mindful morning\nGrateful for the quiet\./.test(db['2026-10-13'].text));

  await journal('2026-10-13', 'Evening reflection', 'Shot the tent bit.');
  t('a second box appends', /Mindful morning/.test(db['2026-10-13'].text) && /Evening reflection/.test(db['2026-10-13'].text));
  t('in order', db['2026-10-13'].text.indexOf('Mindful morning') < db['2026-10-13'].text.indexOf('Evening reflection'));

  await journal('2026-10-13', 'Mindful morning', 'Grateful for the rain.');
  const txt = db['2026-10-13'].text;
  t('re-reading replaces its own section', /Grateful for the rain\./.test(txt) && !/Grateful for the quiet\./.test(txt));
  t('exactly once', (txt.match(/## Mindful morning/g) || []).length === 1,
    (txt.match(/## Mindful morning/g) || []).length + ' copies');
  t('and leaves the other box alone', /Shot the tent bit\./.test(txt));

  await journal('2026-10-14', 'Mindful morning', 'A different day.');
  t('another date is its own entry', db['2026-10-14'].text === '## Mindful morning\nA different day.');
  t('and the first is untouched', /Grateful for the rain\./.test(db['2026-10-13'].text));

  db['2026-10-15'] = { id:'2026-10-15', mood:'good', text:'Wrote this by hand earlier.', createdAt:1 };
  await journal('2026-10-15', 'Evening reflection', 'Late one.');
  t('existing writing is kept', /Wrote this by hand earlier\./.test(db['2026-10-15'].text));
  t('the mood survives', db['2026-10-15'].mood === 'good');

  console.log(`\n${fail ? 'FAILED' : 'full view turns pages, and the journal takes the reflections'}  (${pass} ok, ${fail} failed)\n`);
  process.exit(fail ? 1 : 0);
})();
