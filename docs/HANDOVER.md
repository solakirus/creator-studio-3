# Creator Studio — handover

Give this file to a new chat along with `creator-studio.zip`. Between them, a
fresh session has everything it needs to carry on.

---

## What this is

A personal productivity app for a multi-channel content creator. Vanilla JS,
IndexedDB, **zero build step**, wrapped in Capacitor for Android.

**Owner:** Kris (Khaleem Catten), @solakirus.

---

## Where things live

| | |
|---|---|
| Source | `app/` in the zip |
| Preview | `creator-studio-preview.html` — one file, opens in a browser |
| Rebuild preview | `bash build-preview.sh` inside `app/` |
| Android extras | `android-plugin/` — native plugin, icons, install notes |
| His machine | `C:\Users\Khale\Projects\creator-studio-v2` |

**His build loop:** copy the zip's `app\` contents over `www\`, double-click
`build-apk.bat`. Web files go in `www\` **only** — never touch `android\`.

---

## Design system — do not renegotiate

**Colours:** bg `#151515`, surface-1 `#1F1C17`, surface-2 `#27241F`, line
`#2F2C26`, shadow `#0A0806`. Orange `#FB6900`, orange-hi `#FDB37E`. Cream
`#EDE5D2`, cream-raised `#F6EFDD`, muted `#969185`, dim `#605F57`. Green
`#5BBE6A`, red `#E2564A`, amber `#E8A33D`.

**Type:** Red Hat Display Black (display), DM Sans (body). **Self-hosted** in
`app/fonts/` — the app makes no network calls.

**Geometry:** `--r:4px` everywhere, 14dp gutter, 5px hard offset shadow,
42dp tab bar.

**Three treatments:** dark warm (default), cream/paper (`.screen.paper` — the
Academy reader, the perfect-day card), glass-over-art.

---

## Structure

**Tabs (5):** Today · Weekly · Tools · Series · Profile.
Icons are solid silhouettes with `evenodd` holes — *not* stroke outlines. He
tried outlines and disliked them; filled is what reads bright when selected.

**Tools dock (8 tiles, keep it at 8):** Workout, Nutrition, Swipe File, Shots,
Episodes, Quick Capture, Calendar, Journal.

Tile routing is `slug(tile.name)` → `TOOL_ROUTES` in `app.js`. **Renaming a tile
breaks its route** unless the new slug is added — this has bitten twice.

**Consoles** (own bottom nav): Workout = Workouts/Progress/Runs. Nutrition =
Dashboard/Meals/Prep. Shots = Shot list/References.

---

## What works

**Today** — program clock, swipe right Done / left Skipped, list or timeline,
day sheet. Header is 3 chips + 3 icons; he asked for it to stay at six.

**Tasks** — steps, shot lists, planned angles, coverage. A task can carry a
`kind` (shoot/edit/publish/workout) driving a coloured tag and timeline colour,
a `mins` time block, a `routineId`, a `series` for recurrence, and linked
references per shot.

**Recurrence** — weekday toggles + weeks, on any task. Creates real dated tasks
sharing a `series` key; opening one offers "End it".

**Production pipeline** — per-channel cadence and **shoot days**. Calendar →
Auto-schedule works backwards, batches shoots, writes shoot/edit/publish tasks
and clips. Idempotent via `slotKey`; removing a piece unpicks the chain.

**Clips** — planner with hook, flow, length, CTA, three titles, thumbnail,
keywords, success metric, script editor with word count, readiness score. Clip
state advances automatically when the matching task is ticked.

**Episodes** — story structure via `story.js`: eleven beat **functions**
(hook, promise, complication, payoff…), four **shapes** to scaffold a week, a
story-ready score, and an arc drawn from the beat functions. "Put the beats on
my days" turns scheduled beats into real shoot tasks (tracked by `beat.taskId`
so it never duplicates).

**Shots console** — every shot from every task and beat in one list, grouped by
**location**, filterable by outstanding/captured. Plus the reference library
(stills, GIFs, clips, or pasted links; video imports auto-poster a frame).

**Nutrition** — dashboard folds, meals + templates, prep with per-meal batch
scaling, portions-in-stock vs the rest of the week. Grocery converts recipe
amounts to **shelf quantities** and refuses to guess. Pantry grouped into 10
food groups with a guided inventory walk. Weeks run **Sunday→Saturday**.

**Workout** — 72-exercise library with muscle tags, cover art and demo GIFs
(overlay player mid-set). Saved **routines**, a gallery of **29 ready-made
workouts across 12 types** with editable filters, **working loads** with
scheduled **progressive overload** (default 10% / 3 weeks, scoped per routine,
per-lift hold). Runs with live lap tracking.

**Academy** — 3 shipped courses / 17 lessons, plus imported ones. Paper reader
with try-this blocks and takeaways.

**Gamification** — perfect-day streak with **streak freezes** (one earned per 7
days, max 2, spent automatically), 21+ achievements, levels with XP breakdown,
an avatar ladder unlocked by level.

**Import / export** — `datasets.js` describes 10 datasets; Settings → Import and
export. **An export is the template**: full headers plus a `#`-prefixed example
row even when empty. Images travel as `*_url` links.

---

## Known state

**Working on device:** live notification with progress, action button, status
chip, deep link.

**Needs installing** (`npm i @capacitor/filesystem @capacitor/share` then
`npx cap sync android`): all file exports. Check Settings → Notifications →
diagnostics for a green "File saving" row.

**Optional manual step:** copy `android-plugin/icon/res/*` and
`android-plugin/res/drawable/ic_stat_studio.xml` into `android\app\src\main\res\`.

**Untested:** scheduled reminders have never been confirmed firing.

**Open items:** partial shoot days (ticking 2 of 3 subtasks doesn't move those
clips); avatar transformation animation on level-up; light theme; green
nutrition accent; "Playlist" in Episodes.

---

## How he works

- Tests on device, sends screenshots. Trust them over assumptions.
- Often looking at a stale build — if something "isn't there", ask whether he
  rebuilt before digging.
- Wants honest pushback, not agreement.
- Notices empty, bland or mis-sized screens. Placeholder art and legible type
  matter to him.
- Prefers things consolidated over scattered — he has repeatedly asked to merge
  or collapse rather than add another entry point.

---

## The failure mode in this codebase

**Parsing clean is not evidence of working.** Every real bug in this build was
mine, and every one of them parsed fine:

- a text-slice edit that removed `KINDS` and `kindTag` while leaving their uses
- the same mistake removing the exercise art functions
- a missing comma in `store.js` that took down the whole app
- a guard flag shared across tabs that silently killed every tab's handlers
- markup styled but never inserted
- a renamed tile whose route key was never updated

**So:** after any edit, grep for the string you inserted and count it. Then run
the screen against a stub DOM — stub `Store`, `U`, `Data`, `Screens`, `App`,
capture `innerHTML`, assert on what rendered. Do that before saying it works.

## Added in the "Creator studio App for 1k Content Creation" chat (Sep 23)

Merged onto this build's own swipe.js, clip.js, task.js, views/clips.js and views/today.js
(three-way merge — the embeds, multi-select, cuts and lifecycle from this build are kept).

- **js/versions.js** — one shoot, many posts. Version formats (Original, Tutorial, Story, ASMR,
  Carousel, Bloopers, BTS, Aesthetic clip + quote, Final vs attempts, Custom), templates
  (built-in + saved in settings 'version-templates'), progress (todo → edited → posted), shoot
  needs. `stageOf(clip)` maps the Lifecycle stage to a work tab:
  idea→plan, planned→shoot, shot→edit, editing→post, published→post (done).
- **js/swiperefs.js** — swipe reference cards + picker. Clip: `plan.swipeIds`; task: `swipeIds`
  (legacy `swipeId` still shown); tasks inherit their clip's refs.
- **js/linkmeta.js** — title / creator / cover for a link. Native (CapacitorHttp) reads IG, TikTok,
  FB with the crawler UA; browser only YouTube (noembed). Sets `title`, `author`, `imageUrl`,
  a "Creator:" line in `why`, and downloads the cover into 'swipe-thumb'.
- **Clip page** — Plan / Shoot / Edit / Post tabs (sections can appear on several), Versions,
  References, move-on buttons that advance Lifecycle (never back, except "Move it to …").
  Shot list on Shoot; Cuts and Where it is on Post.
- **Clips list** — segmented Plan / Shoot / Edit / Post tabs replace Library/Queue and the stage
  dropdown; channel dropdown and long-press select kept. Published clips group at the bottom of Post.
- **Swipe file** — icon header (import CSV, add links); CSV file picker, busy lock, duplicate skip;
  bulk "Add links" with background detail fetch + "Fill in missing details"; per-swipe "Fetch
  details"; "Used in" + "Use for a clip". Grid: Instagram without a cover uses a cropped, zoomed
  live embed (reels fill the card); TikTok/Facebook keep Embed. Entry keeps Embed for all.
- **Today** — timed items split by thin dividers into 3-hour periods (Early morning 3–6A … Night
  6–9P, Late night either side of midnight).
- Fixed: `coverFor` wrapped imageUrl in double quotes inside a double-quoted style attribute.

## Month page + episode linking (Sep 23, spec: month-page-spec.md)

- **Store `months`** (DB_VERSION 32, additive). Fields: id, name, quarter, quarterTheme, quarterId,
  challenge, startDate (Sunday), endDate (Saturday), verdictReleaseDate (Thu after end), reward,
  penaltyOptions[], result null|W|L, notes, createdAt. Dates are "YYYY-MM-DD" strings.
- **Episodes stay in `vlogs`.** New optional fields: monthId, skill, weeklyChallenge, passLine,
  releaseDate (only when set by hand), isVerdict, result, segments[{key,label,status todo|shot|done}],
  scriptBeats{intro,history,wisdom,science,backToMe}. `week` is the one source of truth for
  film dates (filmStart/filmEnd/release are computed by Months.datesOf — not stored).
- A challenge month's week slot = project week number; an episode fills it when monthId matches
  and week matches. One episode per slot, enforced by create/link/tag and the week changer.
- **js/months.js** — data + date math (snapSunday/snapSaturday/thursdayAfter, weeks(),
  createEpisode, linkEpisode, linkable, fitFor, slotHolder, withExtras, datesOf).
- **js/screens/months.js** — 'months' (list, form) and 'month' (page: result, stakes, week ladder,
  verdict date). Also injects the CSS for the episode page panel.
- **views/month.js** — Calendar tab now hosts Calendar | Months via the Content-style floating nav.
  calendar.js untouched.
- **screens/vlog.js** — additive: Month field + Step 5 panel (episodePanelHTML) in Plan and Edit
  modes; week changer refuses a week another episode of the same month holds.
- **transfer.js** — backup now includes vlogs and months; "replace" import only clears stores the
  backup actually contains (an older backup can no longer wipe episodes).
- Today (views/today.js) is not touched by any of this.

## Step 6 — Research library (built on the existing `sources` store, no new store)

- **js/research.js** — `Research` API over `sources`: type→`kind` (added experiment, history,
  popculture to Quarters.KINDS; article/video/podcast still read), item→`passage`,
  source→`work`/`author`/`url`, new optional `useIn` (intro|history|wisdom|science|backToMe) and
  `status` (idea|verified|used; missing reads as idea), episode→`vlogId` (null = unassigned).
  quickAdd / edit / pickFor sheets, groupedHTML for an episode.
- **js/screens/research.js** — 'research' list with type / status / assigned filters.
- **Episodes list** (vlog.js mountList) — Research bar: unassigned count + one-tap "+ Log".
- **Episode page** — "This week's reading" is now "Research", grouped by segment, with + Add and
  Link existing; rows open the full editor. The old sourceSheet is still there, unused.
- Backup now also carries `sources` and `quarters`.

## Step 7 — Scoreboard (feeds the existing level)

- **js/scoreboard.js** — habits (vlog, training, german); episodes carry `habitDays{…}` 0–7; months
  carry `habits` (null = all three). XP weights in settings 'scoreboard-xp' (defaults habitDay 10,
  weeklyWin 50, monthlyWin 200); optional level thresholds in settings 'level-thresholds' (total XP
  each level starts at, from level 2; empty = built-in curve). Registers 'scoreboard-settings'
  (Settings → Challenge XP) and 'statcard' (screenshot view).
- **levels.js** — WEIGHTS gains habitDay / weeklyWin / monthlyWin (overridden from settings);
  points() adds them from Scoreboard.counts(); state() uses custom thresholds when set, the curve
  otherwise. Nothing is stored — XP is always recomputed.
- **profile.js** — the level breakdown lists the three challenge rows.
- **Episode panel** — habit-day steppers for the month's active habits, Stat card button; result and
  habit changes call Celebrate.checkLevel(). **Month page** — Month totals (habit days per habit,
  weekly record, XP earned); month W calls checkLevel().

## Step 8 — Import plan (phase1.json)

- **js/planimport.js** — `PlanImport.parse / preview / apply` for format "creator-studio-phase-plan".
  Preview writes nothing. Months skip when one already starts on the same Sunday (episodes then link
  to that existing month); episodes skip when their id exists or their week already has an episode.
  Week comes from filmStart against the program start (plan weekNumber only checked, with a warning).
  Plan ids are kept (m-2026-10, ep-w01…) so a second import skips everything. Imported episodes get
  the weekly day-by-day acts and the default segments; releaseDate is stored only if not the usual
  Thursday.
- **Channel series** (optional, on by default in the preview): `series` → the series store as drafts
  (cadence Weekly = the app's default, total = number of ideas); skipped when the same name already
  exists on that channel (ideas then go into yours). `seriesEpisodes` → `videos` at stage idea in
  their series, keeping `order` and `parts`; notes = idea + "When: timing" + numbered parts.
  createdAt = import time − order so the plan's order reads top to bottom. Skipped when that series
  already has a video with the same title.
- **Months view** — "Import plan" button → file picker (no type filter) → preview sheet → report toast.

## Episode delete + series bulk import (Sep 23)

- **Episodes list** — long-press select (Select.enable on .mediacard) → Delete. **Episode page** —
  "Delete outline" is now "Delete episode" and asks first. Both use deleteEpisodes(): research
  (sources.vlogId) goes back to unassigned, tasks already sent stay, month slots just free up.
- **PlanImport.parseAny** — plan JSON, series-only JSON ({series, seriesEpisodes} or a bare array of
  ideas), or a CSV (series, channel, title, idea|notes, timing|when, order, parts ; -separated).
  Ideas without a listed series create it from their own series + channel.
- **Series tab** — IMPORT header button → the same preview sheet (titled "Import series" when there
  are no months/episodes). Exposed as window.PlanImportUI.fromFile from screens/months.js.
- **Series page** — "Add several ideas at once": paste one per line ("Title — note" / "Title | note");
  numbered/bulleted lines are cleaned; titles already in the series skip. Videos list by `order`.

## Series delete, series video filters, episode order (Sep 23)

- **Series tab** — long-press select → Delete (views/series.js removeSeries): a series' videos still at
  Idea are deleted with it; anything further along is kept with seriesId cleared. The series form's
  Delete now asks first and uses the same rule (it used to leave every video pointing at nothing).
  multiselect.js no longer adds an "s" to a noun that already ends in one ("2 series").
- **Series page** — search (title, notes, tags) and a stage filter with counts over its videos; typing
  redraws only the list.
- **Episodes list** — earliest first (lowest week at the top), grouped by challenge month when the
  episode is tagged (so week 1 sits under October), calendar month otherwise, "No week set" last.

## Channels (Sep 23)

- **Settings → Channels** — renaming a channel now carries every series, clip, video and swipe tagged
  with the old name over to the new one (renameChannel in settings.js). A box lists channel names
  your series/clips/videos use that aren't set up, with one tap to add them all (palette colours).
- **Series form** — hint that colours and names live in Settings → Channels.

## Fixes (Sep 23, late)

- **Long-press Delete bar was invisible app-wide.** A later `.selbar` rule in styles.css (the
  reference library's in-page bar) overrode the multiselect bar on <body>, making it a sticky strip
  at the end of the document. That rule is now scoped to `.view .selbar`.
- **Series page Edit** opens the series form in place (ViewSeries.edit(id, after)); it used to just
  pop back to the list. Deleting from there closes the page.
- **Series form** — "Edit channels" link opens Settings → Channels (colours, names, and one-tap adding
  of channels that are in use but not set up).

## Series description, video types, channel duplicates (Sep 23, late)

- **Series** gain `about`, `kinds[]` (Short (vertical), Long-form, Vlog, How-to, Talking head, Review,
  Multi-part build, Behind the scenes, Podcast, Live — multi-pick) and `format` (free text). Edited in
  the series form, shown on the series page (with a "Describe this series" prompt when empty).
- **Channels.match(name, list)** — case/punctuation/"&"/little-word-insensitive, plus ≤2-letter
  typos on longer names. Used by: the series form (a near-duplicate channel shows as your saved one,
  and saving files it there), Settings → Channels ("Used in your work but not set up": per name,
  File under <your channel> (pre-picked when it matches) / Add as new / Leave — File under runs
  renameChannel across series, clips, videos, swipes), and the plan importer (incoming channel names
  are filed under yours).

## Program plans: linked videos (Sep 23, late)

- Plans carry `swipeIds[]`. Each plan card shows a "How to do it" strip (SwipeRefs.fill into
  [data-refslot]) or a "+ Link a video for how to do it" button; handled in screens/program.js's own
  click handler (open / unlink / link). The editor deep-copies the plan, so swipeIds survive edits.
- **Task page** — a task with planId shows the plan's videos in References, marked "from plan".
- Backups now also carry `videos` and `plans`.

## Swipe folders (Sep 23, late)

- **js/folders.js** — `SwipeFolders`: folder list in settings 'swipe-folders' ({id,name,emoji,pinned,
  order,createdAt}); swipes carry `folders[]` (many allowed). remove() clears the id from swipes,
  never deletes them. contents() → { folderId: swipes, __none: swipes in no folder }.
- **Swipe tab** — All · Folders switch. Folders = 2×2 cover-mosaic tiles (pinned first), a "Not in a
  folder" tile, and New folder. An open folder shows the same card grid with search only, a back
  button and Edit (name, icon, pin, delete). Add links has "Save into a folder" (pre-picked inside a
  folder). The swipe entry has folder chips (+ New folder).
- **multiselect.js** — opts.extra: [{label, run(ids, done)}] buttons before Delete. Swipes use it for
  "+ Folder" and, inside a folder, "Remove".

## The run-up to Day 1 (brought over from v2, 2026-10-13)

CS3's baseline was the v2 copy that did **not** have v2's prep-phase work, so
three things were missing. They are in now.

**Day numbers run below 1.** `currentDay()` was already unclamped here, so the
app could already sit on day 0 or a negative day — but a lot of code tested a
day for truthiness, which silently treats **day 0 as no day at all**. Day 0 is
a real date: the day before Day 1. Every such test is now `!= null`, and every
`x.day || null` normalisation is `?? null`. Seventeen spots across eleven files.
`checks.test.js` now fails if one comes back.

**The run-up has a name.** `program.preName`, default "Prep" (quick picks Prep
and Red phase), set in Settings → Program start. `Data.phaseOf(n)` returns
`{pre, name, toGo}` and `Data.dayLabel(n)` gives either "Day 12 · week 2" or
"Prep · 4 days to Day 1". The day sheet, the profile badge and the shot list all
read through those, so they agree. `Data.todayDay()` exists as an alias of
`currentDay()` only so code ported from v2 or the laptop Planner keeps working.

**Moving Day 1 no longer moves the plans.** This was a live bug: the start-date
sheet called `Data.setProgram({ start })` and nothing else, so every task, beat
and milestone slid onto a different real date. It now calls `Data.moveStart(ts,
preName)`, which shifts stored day numbers by the same amount the start moved —
tasks, episode acts and beats, program plans (`startDay`, `add`, `skip`),
one-off videos, and challenge weeks — so a shoot planned for Saturday is still
on Saturday afterwards. `tests/prep.test.js` proves that against a fake store:
a shoot on day 10 stays on Wed 14 Oct while its number moves to day 6.

**Also fixed:** `store.js` opens a newer database as-is instead of failing with
`VersionError` — the thing that stops a stale build taking the phone down, which
is what happened on 5 Oct 2026. And it honours `CS_DB_NAME` so tests use a
throwaway database. The task detail printed a missing value as a word for any
task made from a clip, a shot, a quick capture or a vlog day — none of those set
a cadence or priority. Three spots fixed.

**Tests:** `node app/tests/prep.test.js` (moveStart against a fake store),
`node app/tests/prep-render.test.js` (the three screens against a stub DOM),
`node app/tests/checks.test.js` (whole-app invariants, now 23 of them). No
install needed.
