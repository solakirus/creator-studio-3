/* The Capacitor-shaped bridge for the Windows app.

   The web layer looks for window.Capacitor.Plugins.<Name> and falls back
   gracefully when one is missing. Rather than teach eleven files about
   Electron, this offers the same names and call shapes Capacitor does, backed
   by main.js. Only these exist on Windows:

     App               deep links (cs3://), launch URL
     CapacitorHttp     requests without cross-site limits
     Filesystem/Share  write a file, then Save As
     LocalNotifications reminders while the app is open

   Not offered, on purpose: CSWidget, LiveStatus, SendIntent, Geolocation,
   BackgroundGeolocation. The app already hides or skips what needs them. */
const { contextBridge, ipcRenderer } = require('electron');

const listeners = { appUrlOpen: new Set(), backButton: new Set() };
ipcRenderer.on('cs3:link', (e, url) => listeners.appUrlOpen.forEach(cb => { try { cb({ url }); } catch (err) {} }));

const handle = (set, cb) => Promise.resolve({ remove: () => { set.delete(cb); return Promise.resolve(); } });

const App = {
  addListener(event, cb) {
    const set = listeners[event];
    if (!set || typeof cb !== 'function') return handle(new Set(), cb);
    set.add(cb);
    return handle(set, cb);
  },
  removeAllListeners() { Object.values(listeners).forEach(s => s.clear()); return Promise.resolve(); },
  getLaunchUrl: async () => { const url = await ipcRenderer.invoke('cs3:launch-url'); return url ? { url } : undefined; },
  exitApp: () => ipcRenderer.send('cs3:quit'),
  getInfo: async () => ({ name: 'Creator Studio 3', id: 'com.solakirus.creatorstudio3' })
};

const CapacitorHttp = {
  request: o => ipcRenderer.invoke('cs3:http', o),
  get: o => ipcRenderer.invoke('cs3:http', Object.assign({}, o, { method: 'GET' })),
  post: o => ipcRenderer.invoke('cs3:http', Object.assign({}, o, { method: 'POST' }))
};

const Filesystem = {
  writeFile: o => ipcRenderer.invoke('cs3:fs-write', {
    path: o.path, data: o.data, directory: o.directory, encoding: o.encoding })
};

const Share = {
  share: o => ipcRenderer.invoke('cs3:share', { files: o.files, title: o.title, dialogTitle: o.dialogTitle }),
  canShare: async () => ({ value: true })
};

const granted = async () => ({ display: 'granted' });
const LocalNotifications = {
  checkPermissions: granted,
  requestPermissions: granted,
  schedule: o => ipcRenderer.invoke('cs3:notif-schedule', (o && o.notifications) || []),
  getPending: () => ipcRenderer.invoke('cs3:notif-pending'),
  cancel: o => ipcRenderer.invoke('cs3:notif-cancel', ((o && o.notifications) || []).map(n => n.id)),
  addListener: (event, cb) => handle(new Set(), cb)
};

contextBridge.exposeInMainWorld('Capacitor', {
  isNativePlatform: () => true,
  getPlatform: () => 'electron',
  isPluginAvailable: name => ['App', 'CapacitorHttp', 'Filesystem', 'Share', 'LocalNotifications'].includes(name),
  CapacitorHttp,
  Plugins: { App, CapacitorHttp, Filesystem, Share, LocalNotifications }
});
