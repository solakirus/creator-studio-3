/* Creator Studio 3 — Windows shell.

   Runs the same www/ the Android app runs. The web layer was written against
   Capacitor, so preload.js hands it a small Capacitor-shaped bridge and this
   file does the native half: HTTP without cross-site limits, saving files,
   reminders, and cs3:// deep links. Anything the bridge doesn't offer
   (widgets, live notification, share-in, GPS) is simply absent, and the web
   code already treats an absent plugin as "not on this device". */
const { app, BrowserWindow, protocol, net, shell, Menu, ipcMain, dialog,
        Notification, session } = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

const SCHEME = 'cs3';                  /* deep links: cs3://go/today */
const NAME = 'Creator Studio 3';

/* The page is served from app://cs3/ rather than file://, so IndexedDB,
   fetch and clipboard behave like a real site and the origin never changes
   when the install folder does. */
protocol.registerSchemesAsPrivileged([{ scheme: 'app',
  privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } }]);

if (!app.requestSingleInstanceLock()) { app.quit(); }

/* Register cs3:// with Windows. In development the exe is electron.exe, so it
   needs the script path passed along. */
if (process.defaultApp && process.argv.length >= 2) {
  app.setAsDefaultProtocolClient(SCHEME, process.execPath, [path.resolve(process.argv[1])]);
} else {
  app.setAsDefaultProtocolClient(SCHEME);
}

const linkIn = argv => (argv || []).find(a => typeof a === 'string' && a.startsWith(SCHEME + '://')) || null;
let launchUrl = linkIn(process.argv);
let win = null;

function open(){
  win = new BrowserWindow({
    width: 1440, height: 900, minWidth: 380, minHeight: 600,
    backgroundColor: '#151515', title: NAME, autoHideMenuBar: true,
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    webPreferences: {
      contextIsolation: true, sandbox: true, spellcheck: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });
  win.loadURL('app://cs3/index.html');

  const external = url => /^(https?:|mailto:|tel:)/i.test(url);
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (external(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (url.startsWith('app://')) return;
    e.preventDefault();
    if (external(url)) shell.openExternal(url);
  });
}

function focus(){
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.show(); win.focus();
}

app.on('second-instance', (e, argv) => {
  focus();
  const url = linkIn(argv);
  if (url && win) win.webContents.send('cs3:link', url);
});

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  app.setAppUserModelId('com.solakirus.creatorstudio3');   /* Windows needs this for notifications */

  const root = path.join(__dirname, '..', 'www');
  protocol.handle('app', req => {
    let p = decodeURIComponent(new URL(req.url).pathname);
    if (p === '/' || p === '') p = '/index.html';
    const file = path.normalize(path.join(root, p));
    if (!file.startsWith(root)) return new Response('Not found', { status: 404 });
    return net.fetch(pathToFileURL(file).toString());
  });

  /* YouTube embeds refuse to play without a referrer. */
  session.defaultSession.webRequest.onBeforeSendHeaders(
    { urls: ['*://*.youtube.com/*', '*://*.youtube-nocookie.com/*', '*://*.ytimg.com/*', '*://*.googlevideo.com/*'] },
    (details, cb) => { details.requestHeaders['Referer'] = 'https://creatorstudio3.app/'; cb({ requestHeaders: details.requestHeaders }); });

  open();
});
app.on('window-all-closed', () => app.quit());

/* ---------------------------------------------------------- bridge: App */

ipcMain.handle('cs3:launch-url', () => { const u = launchUrl; launchUrl = null; return u; });
ipcMain.on('cs3:quit', () => app.quit());

/* ---------------------------------------------------------- bridge: HTTP
   Same job as CapacitorHttp on the phone: a request made outside the page, so
   Instagram, TikTok and YouTube metadata can be read without CORS. */
ipcMain.handle('cs3:http', async (e, o) => {
  const opts = o || {};
  const ms = Math.max(opts.connectTimeout || 0, opts.readTimeout || 0) || 15000;
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    let url = opts.url;
    if (opts.params) {
      const u = new URL(url);
      Object.entries(opts.params).forEach(([k, v]) => u.searchParams.set(k, v));
      url = u.toString();
    }
    const r = await net.fetch(url, {
      method: opts.method || 'GET', headers: opts.headers || {}, signal: ctl.signal,
      body: opts.data == null ? undefined : (typeof opts.data === 'string' ? opts.data : JSON.stringify(opts.data))
    });
    const headers = {};
    r.headers.forEach((v, k) => { headers[k] = v; headers[k.replace(/(^|-)\w/g, s => s.toUpperCase())] = v; });
    const type = r.headers.get('content-type') || '';
    let data;
    if (opts.responseType === 'blob' || opts.responseType === 'arraybuffer') {
      data = Buffer.from(await r.arrayBuffer()).toString('base64');
    } else {
      const text = await r.text();
      data = text;
      if (opts.responseType === 'json' || (!opts.responseType && /json/i.test(type))) {
        try { data = JSON.parse(text); } catch (err) { data = text; }
      }
    }
    return { status: r.status, headers, url: r.url || url, data };
  } finally { clearTimeout(t); }
});

/* ---------------------------------------------------------- bridge: files
   writeFile + share is how the phone saves a backup or CSV. Here "share"
   becomes a Save As dialog, so the file lands wherever you choose. */
const docsDir = () => path.join(app.getPath('documents'), NAME);
const cacheDir = () => path.join(app.getPath('temp'), 'creator-studio-3');

ipcMain.handle('cs3:fs-write', async (e, o) => {
  const dir = o.directory === 'DOCUMENTS' ? docsDir() : cacheDir();
  const file = path.normalize(path.join(dir, o.path));
  if (!file.startsWith(dir)) throw new Error('Bad path');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const buf = o.encoding ? Buffer.from(String(o.data), 'utf8') : Buffer.from(String(o.data), 'base64');
  fs.writeFileSync(file, buf);
  return { uri: file };
});

ipcMain.handle('cs3:share', async (e, o) => {
  const src = (o.files || [])[0];
  if (!src || !fs.existsSync(src)) throw new Error('Nothing to save');
  const r = await dialog.showSaveDialog(win, {
    title: o.dialogTitle || o.title || 'Save',
    defaultPath: path.join(app.getPath('downloads'), path.basename(src))
  });
  if (r.canceled || !r.filePath) throw new Error('Share canceled');
  fs.copyFileSync(src, r.filePath);
  return {};
});

/* ---------------------------------------------------------- bridge: reminders
   Fire while the app is open (or minimised). Windows has no equivalent of
   Android's alarm that wakes a closed app, so a reminder due while CS3 is
   closed is skipped — the phone still gets it. */
const pending = new Map();      /* id → { n, timer } */

ipcMain.handle('cs3:notif-schedule', (e, list) => {
  (list || []).forEach(n => {
    const at = n.schedule && n.schedule.at ? new Date(n.schedule.at).getTime() : Date.now();
    const wait = at - Date.now();
    if (wait < 0 || wait > 0x7fffffff) return;
    if (pending.has(n.id)) clearTimeout(pending.get(n.id).timer);
    const timer = setTimeout(() => {
      pending.delete(n.id);
      if (!Notification.isSupported()) return;
      const note = new Notification({ title: n.title || NAME, body: n.body || '',
                                      icon: path.join(__dirname, '..', 'build', 'icon.png') });
      note.on('click', focus);
      note.show();
    }, wait);
    pending.set(n.id, { n: { id: n.id, title: n.title, body: n.body, schedule: { at: new Date(at) } }, timer });
  });
  return {};
});
ipcMain.handle('cs3:notif-pending', () => ({ notifications: [...pending.values()].map(p => p.n) }));
ipcMain.handle('cs3:notif-cancel', (e, ids) => {
  (ids || []).forEach(id => { const p = pending.get(id); if (p) { clearTimeout(p.timer); pending.delete(id); } });
  return {};
});
