/* Stamps sw.js with a build id and the real list of files to precache.

   The list is read off disk rather than kept by hand, because a hand-kept list
   is a list that goes stale the first time someone adds a script — and the
   failure is silent: the app works online and breaks offline, which is exactly
   when you cannot debug it.

     node scripts/build-sw.js [outDir]        (default: app/)  */
const fs = require('fs'), path = require('path');

const root = path.join(__dirname, '..');
const out = process.argv[2] ? path.resolve(process.argv[2]) : path.join(root, 'app');

const SKIP = new Set(['tests', 'sw.js', 'build-preview.sh']);
const list = [];
(function walk(dir, rel) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (rel === '' && SKIP.has(e.name)) continue;
    if (e.name.startsWith('.')) continue;
    const abs = path.join(dir, e.name), r = rel ? rel + '/' + e.name : e.name;
    if (e.isDirectory()) walk(abs, r);
    else list.push('./' + r);
  }
})(out, '');

/* index.html first: it is the one the app cannot start without */
list.sort((a, b) => (a === './index.html' ? -1 : b === './index.html' ? 1 : a.localeCompare(b)));

/* A build id that changes whenever any shipped file changes — a content hash,
   not a timestamp, so rebuilding without edits does not evict a good cache. */
const crypto = require('crypto');
const h = crypto.createHash('sha256');
for (const f of list) h.update(f).update(fs.readFileSync(path.join(out, f.slice(2))));
const build = h.digest('hex').slice(0, 12);

const src = fs.readFileSync(path.join(root, 'app', 'sw.js'), 'utf8')
  .replace('__BUILD__', build)
  .replace('__FILES__', JSON.stringify(list, null, 2));

fs.writeFileSync(path.join(out, 'sw.js'), src);
console.log(`[sw] build ${build}, ${list.length} files precached`);
