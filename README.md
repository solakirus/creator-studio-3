# Creator Studio 3

Creator Studio with the storyboard canvas built in, as **one app** for your phone (APK) and laptop
(.exe). It's a **separate app**: Creator Studio v2, the Planner and Storyboard stay installed and
untouched.

**Where it's at:** step 1 of the build order (`docs/CS3-DESIGN.md` §12). CS3 is v2 under a new
name, with its own empty database, running on both Android and Windows. The canvas comes in step 4.

---

## First time on the laptop

1. Unzip this folder to `C:\Users\Khale\Projects\creator-studio-3`.
2. Double-click **`build.bat`**. On the first run it:
   - copies v2's `android\` folder into this one and gives the copy CS3's identity. v2 is only read.
     If v2 isn't at `C:\Users\Khale\Projects\creator-studio-v2`, change the `V2=` line at the top
     of `build.bat`.
   - installs packages (a few minutes).
   - asks **Build the Windows app?** and **Build the Android APK?**
3. Results land in `dist\`:
   - `Creator Studio 3 Setup 3.0.0.exe` (installer) and `CreatorStudio3-portable-3.0.0.exe`
   - `Creator Studio 3.apk`

After that, `build.bat` is the whole loop. It also saves each build as a git commit.

## Check on the phone

- [ ] It installs **beside** Creator Studio v2. You should see two icons, and v2 still has all its data.
- [ ] CS3 opens empty, with the same tabs and tools as v2.
- [ ] Long-press the CS3 icon: Run / Capture / Shoot / Workout open **CS3**, not v2.
- [ ] Add a CS3 widget: tapping it opens **CS3**.
- [ ] Settings → restore a v2 backup file. It should bring in what v2's backup holds. That's only
      19 of 50 stores until v2's export is fixed (design doc §9).

## Check on the laptop

- [ ] The installer adds a **Creator Studio 3** shortcut, and it opens on Today.
- [ ] Settings → export a backup: a **Save As** box appears.
- [ ] Swipe file → paste an Instagram or TikTok link: the title and cover come in.
- The laptop shows the phone layout stretched wide for now. The sidebar layout comes with the canvas.

## Put it on GitHub

1. On github.com, create an **empty private** repo named `creator-studio-3` (no README).
2. In this folder:

   ```
   git remote add origin https://github.com/solakirus/creator-studio-3.git
   git push -u origin main
   ```

From then on, `build.bat` offers to push after each build.

---

## Layout

| Folder | What |
|---|---|
| `app/` | **The app.** Edit files here only. `app/tests/` holds the test harnesses. |
| `www/` | Built copy of `app/` (minus tests). Recreated on every build, not in git. |
| `electron/` | Windows shell. `preload.js` gives the web layer the same plugin names Capacitor does. |
| `android/` | Created on first build from v2's. In git from then on. |
| `native/` | Widget and shortcut sources with CS3's links. Copied into `android/` on every sync. |
| `scripts/` | `android-setup.js` (copy from v2 + new identity), `copy-web.js`, `run-tests.js` |
| `docs/` | `CS3-DESIGN.md` (the plan), `CREATOR-STUDIO-3.md` (merge brief), `HANDOVER.md` (v2 handover) |

## For the next Claude session

- Read `docs/CS3-DESIGN.md` first, then the "Mistakes this codebase keeps producing" section of
  `docs/CREATOR-STUDIO-3.md`.
- `npm test` runs every harness, including `checks.test.js`. It checks app identity, script tags,
  stray `global.`, theme-attribute handlers, screen push/register pairs, and tool routes. Run it
  after every change.
- `cd app && bash build-preview.sh` builds `creator-studio-preview.html`, the single-file browser
  preview.
- Identity: app id `com.solakirus.creatorstudio3`, database `creator-studio-3`, links `cs3://`.
  The Java package stays `com.creatorstudio.v2` on purpose (see `scripts/android-setup.js`).
