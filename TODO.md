# Planning Poker — TODO roadmap

Goal: skin the site with the Figma wireframes (`Planning Poker.fig`), replace the Fibonacci **effort dropdowns**
with a **Join vote / Revote** button that opens the poker game UI, and add a **waiting room** so people vote
together in real time (first person in gets the **Start game** button).

**Nothing here is implemented yet.** This file, the stubs, and the `// TODO(ID)` comments in code are plan only.
Search the code for `TODO(` to jump to the spot; IDs match the items below.

Related docs: [`design/FRAME_MAP.md`](design/FRAME_MAP.md) (Figma → pages) ·
[`docs/LOBBY_AND_GAME_FLOW.md`](docs/LOBBY_AND_GAME_FLOW.md) (waiting room, round rules, API + data model sketch) ·
screenshots in `GroupProject/public/images/figma/`.

---

## 0. Decisions needed first (blockers)
Recommended answer in *italics*. Details in `docs/LOBBY_AND_GAME_FLOW.md#open-questions`.

- [ ] **Q1 Card values.** Figma shows **9** cards, server accepts **10** (0,1,2,3,5,8,13,21,40,100). *Drop one (probably 0) or add a `?`/☕ card — pick, then make server + UI match.*
- [ ] **Q2 Who finalizes the estimate?** Results show an average (e.g. 3.66) but `effort` must be a Fibonacci value. *Host confirms; prefill with the card nearest the average.*
- [ ] **Q3 Who can reveal / revote?** *Host only; auto-reveal when everyone has voted (host can still force).*
- [ ] **Q4 Late joiners mid-game.** *May join and vote in the current round if it isn't revealed yet.*
- [ ] **Q5 Invite method.** Figma has an email list + QR code; app has no accounts or email. *Invite link + QR code; "People with access" = people currently in the room.*
- [ ] **Q6 Create Game toggles.** Figma shows 3 unlabeled toggles. *Auto-reveal, allow late joiners, coffee-break votes.*
- [ ] **Q7 Product name.** Site says "Deck Of Stories", Figma says "Planning Poker".
- [ ] **Q8 Missing designs.** No Figma frame for: waiting room, join-by-link (name only), add-task form, task detail/user stories, group notes, effort summary table, login errors. *Build from the existing components, or add frames.*
- [ ] **Q9 Layout width.** Frames are 768×960 (tablet portrait). *Centered 768px column first, responsive pass later.*

## 1. Design assets & design system (DS)
- [x] Export every Figma frame + component to PNG/SVG → `GroupProject/public/images/figma/` (done; the .fig had no embedded raster images — `images/` inside it is empty)
- [x] Extract Figma variables → `design/tokens.json` (done)
- [ ] **DS-1** Re-export from Figma itself if any frame looks off (my renderer is wireframe-grade; see `design/tools/README.md`)
- [ ] **DS-2** Export logo, avatar, coffee-cup, task-list and chevron icons as standalone SVGs → `public/images/icons/`
- [ ] **DS-3** Export the landing illustration (people around table) as standalone SVG
- [ ] **DS-4** Produce real images for the *How to play* frame (currently two gray X placeholders)
- [ ] **DS-5** Create `public/css/app.css`: CSS variables from `tokens.json` (Inter, grays `#1e1e1e/#303030/#757575/#d9d9d9/#f3f3f3`, 8px radius, 1px strokes), base buttons (primary dark / secondary gray), inputs, cards
- [ ] **DS-6** Load Inter (self-host or Google Fonts)
- [ ] **DS-7** Shared shell `public/js/shell.js` rendering **App Header** (logo · Tutorial · Player ▾ menu) and **App Footer** (☕ coffee · Invite Players · Tasks ☰) on every page
- [ ] **DS-8** Reusable pieces matching components: **Vote Card**, **Table Card** (face-down/up), **Task Box**, **Task Item**, **Player Chip**

## 2. Re-skin existing pages to Figma (UI)
- [ ] **UI-1** `index.html` → frame 01 Landing (illustration, Start game = primary, Resume game = secondary; keep the existing "Resume disabled without session" check)
- [ ] **UI-2** `login.html` → frame 02 Create Game (name + toggles). Add separate **Join** page/state for invite links (needs design — Q8). Do the existing TODO: auto-join after create.
- [ ] **UI-3** Invite panel → frame 03 (link + QR + who's in the room). Pick a QR approach (npm `qrcode` or client-side lib) — adds a dependency, confirm first.
- [ ] **UI-4** `board.html` → frame 10 Tasks Panel: *In progress* / *Completed* columns of Task Items, `Tasks | n` count, add-task button
- [ ] **UI-5** Keep (restyled) board features that have no frame: assign Take/Release, filters, task detail + user stories, group notes, effort summary table, presence chips
- [ ] **UI-6** `tutorial.html` → frame 09 How to Play (reached from header **Tutorial**)
- [ ] **UI-7** Frame 08 **Tasks Complete!** end screen (3 buttons — labels not in Figma; suggest *View summary / Back to board / New game*)
- [ ] **UI-8** Responsive pass (Q9) and keyboard/aria for cards (cards are buttons; selected = `aria-pressed`)

## 3. Join vote / Revote button replaces the effort dropdowns (VOTE)
Dropdown locations to remove in `board.html`: `#newEffort` (add-task form), per-task `eff` select in the list, `#dEffort` in the detail panel.
- [ ] **VOTE-1** Remove `#newEffort` and the `effort` field from `addTask()`. New tasks start with `effort: null` (estimate now comes from voting). Keep server `effort` param working for backward compat/tests.
- [ ] **VOTE-2** Per-task button replaces the select. Label rules: **Join vote** when `effort == null`; **Revote** when the task already has an estimate (or a revealed round). Disabled with tooltip if the room isn't joinable.
- [ ] **VOTE-3** Same button in the detail panel; show the current estimate as read-only text.
- [ ] **VOTE-4** Click behavior: no game running → go to the waiting room for this project (this task queued first); game running → open `game.html` on the room's current task. *Revote* is host-only once a game is running (Q3).
- [ ] **VOTE-5** Keep the **Done** button gate (assignee + effort) — it now depends on a finished vote.
- [ ] **VOTE-6** `game.html` (frames 04–07): "Pick your card!" · Task Box · player table cards (white = not voted, dark = voted, flipped on reveal) · **Complexity:** card row · selected card raised with ▲ (05)
- [ ] **VOTE-7** Results view (06): vote distribution bars, **Average**, per-player revealed cards, action button(s)
- [ ] **VOTE-8** Revote confirm (07): "Revote?" with primary/secondary buttons → clears votes, new round
- [ ] **VOTE-9** Accept result → writes `task.effort`, advances to next un-estimated task; none left → frame 08
- [ ] **VOTE-10** Coffee break (frames 11–12, ☕ footer icon): yes/no poll, "n out of m votes so far", then % results. *Lowest priority; see phase 6.*
- [ ] **VOTE-11** `board.html` auto-refresh currently pauses while inputs/selects are focused — make sure the game view uses its own refresh path (RT-1) so votes never stall.

## 4. Waiting room (LOBBY)
- [ ] **LOBBY-1** Room = existing project name (no new entity). Add `project.session` + `joinedAt` per user (see data model in flow doc)
- [ ] **LOBBY-2** `POST /api/room/join` on entering; server records join order (monotonic sequence, not just timestamp)
- [ ] **LOBBY-3** **Host = earliest-joined active participant.** Derived on the server, never trusted from the client
- [ ] **LOBBY-4** Host succession: if host's heartbeat lapses (or explicit leave), next earliest becomes host. Short grace (~15s) so a page refresh keeps your place in line
- [ ] **LOBBY-5** `lobby.html`: player chips list, "n players waiting", **Start game** button (host only) / "Waiting for host…" (others); invite panel reachable from footer
- [ ] **LOBBY-6** `POST /api/room/start` — host only (403 otherwise), requires ≥1 un-estimated task (else show "First create tasks" → Tasks panel), flips `status: lobby → playing`
- [ ] **LOBBY-7** All lobby clients auto-navigate to `game.html` when status becomes `playing`
- [ ] **LOBBY-8** Leave detection: `navigator.sendBeacon('/api/room/leave')` on `pagehide` + heartbeat timeout fallback
- [ ] **LOBBY-9** Room auto-resets to idle when nobody is active (also handles server restart with stale `playing`)
- [ ] **LOBBY-10** Duplicate names: two people entering "Sam" currently share votes/presence. Add per-tab `clientId` (sessionStorage) sent as `x-client`, and either reject or suffix duplicates. Also remove the `"anonymous"` fallback in `login.html`.
- [ ] **LOBBY-11** "End game" (host) → back to lobby or board

## 5. Real-time sync (RT)
Current board polls every 5s and pauses while typing — too slow for synchronized voting.
- [ ] **RT-1** `GET /api/room?since=<version>` returns the full room state, or `304`-style "no change". Poll every ~1s on lobby/game pages. Bump `session.version` on every mutation.
- [ ] **RT-2** *(optional upgrade)* Server-Sent Events (`GET /api/events`) with no new deps. Note: `EventSource` can't send the `x-project`/`x-user` headers — pass them as query params or cookie.
- [ ] **RT-3** Hide other players' cards until reveal (server already strips `votes` when `revealed === false`; keep that invariant and test it)
- [ ] **RT-4** Concurrency: `db.js` is sync read-modify-write of one JSON file, so handlers are atomic in one process. Don't introduce `await` between `db.read()` and `db.write()` in new handlers.
- [ ] **RT-5** Write churn: presence already rewrites `data.json` every 10s per user; consider keeping lobby/presence in memory and persisting only tasks/votes/efforts

## 6. Server API & data (API)
See flow doc for payloads.
- [ ] **API-1** `db.js`: document + backfill `session`, `users[name].joinedAt/joinSeq`, optional `task.history` (previous rounds)
- [ ] **API-2** `GET /api/project` also returns `session` summary (status, host, currentTaskId) so board buttons can pick labels (VOTE-2)
- [ ] **API-3** `POST /api/tasks/:id/vote {card}` — validate against the card list, participants only, rejected after reveal
- [ ] **API-4** `POST /api/room/reveal` (host, or auto when all active participants voted)
- [ ] **API-5** `POST /api/room/revote` (host) — clear votes, `revealed=false`, `round++`, optionally archive the old round
- [ ] **API-6** `POST /api/room/accept {value}` (host) — validates Fibonacci, sets `task.effort`, advances `currentTaskId`
- [ ] **API-7** `requireHost` middleware
- [ ] **API-8** Coffee break: `POST /api/room/coffee`, `POST /api/room/coffee/vote`, results in room state
- [ ] **API-9** Unify the card list (`fib` in `server.js` and `FIB` in `board.html`) into one source served by `GET /api/config`
- [ ] **API-10** Compute `average`, `distribution`, `agreement` server-side for results (06)
- [ ] **API-11** Existing known TODOs stay: real sessions/passwords/invite codes (header spoofing means "host only" is advisory until then)

## 7. Tests & docs (TEST / DOC)
Existing: `GroupProject/tests/TodoApiTest.java` (starts the server, 15 tests, 6 skipped). Keep passing — new endpoints are additive.
- [ ] **TEST-1** Host assignment: first joiner is host; second isn't; host leaves → second becomes host
- [ ] **TEST-2** `start` as non-host → 403; with no tasks → 400
- [ ] **TEST-3** Vote hidden until reveal; one vote per user, last write wins until reveal; vote after reveal rejected
- [ ] **TEST-4** Revote clears votes and increments round; accept writes Fibonacci `effort`; non-Fibonacci rejected
- [ ] **TEST-5** Un-skip / review the 6 skipped tests
- [ ] **TEST-6** Manual two-browser checklist (host + guest) for lobby → vote → reveal → revote → accept
- [ ] **DOC-1** Update `README.md` layout + API once built
- [ ] **DOC-2** Mention `PORT=3001 npm start` for running two instances is *not* how to test multiplayer — use two browser profiles

## Suggested order
1. Decisions (Q1–Q9) → 2. DS-5..8 (CSS + shell) → 3. API-1,3..7 + LOBBY-1..4 → 4. `lobby.html` + `game.html` (VOTE-6..9, LOBBY-5..7) with RT-1 →
5. Swap dropdowns for the button (VOTE-1..5) → 6. Re-skin remaining pages (UI-*) → 7. Coffee break, end screen, tutorial, polish.
