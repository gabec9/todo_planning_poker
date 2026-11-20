# Waiting room + synchronous voting — design sketch

Plan only; nothing here is built. Item IDs refer to `/TODO.md`.

## Flow
```
Landing (01) ──Start game──▶ Create Game (02) ─┐
        └────Resume game──▶ (existing session) │
Invite link / QR (03) ──▶ Join (name only) ────┤
                                               ▼
                                     WAITING ROOM (lobby.html)
                         first in = HOST ──[Start game]──▶ everyone ▶ game.html
                                               ▼
                game.html: Voting (04/05) ─▶ Reveal ─▶ Results (06)
                      ▲                                   │
                      └──── Revote? (07) ◀── host ────────┤
                                                          ▼ Accept → task.effort set
                                              next task … none left ▶ Tasks Complete (08)
```
Board button (VOTE-2/4): **Join vote** / **Revote** on a task → lobby if no game is running, else straight into the game.

## Waiting-room rules
1. Room = project. Entering the project calls `POST /api/room/join`.
2. Each participant gets `joinedAt` + a monotonic `joinSeq` (tie-breaker).
3. **Host = active participant with the lowest `joinSeq`.** Computed on the server per request.
4. "Active" = heartbeat within the online window. A refresh within ~15s keeps your `joinSeq`; longer absence → new `joinSeq` (back of the line).
5. Host succession is automatic; clients just re-render when `host` changes in room state.
6. Only the host sees **Start game**; others see "Waiting for host…". Server enforces (`requireHost`).
7. Start requires ≥1 task with `effort == null` (or the task the user clicked **Revote** on). Min players: *1 allowed* (recommend) — confirm.
8. When nobody is active for N seconds, `session` resets to idle (covers crashes/restarts).

## Round rules
- One **current task** at a time; every player votes on it.
- Votes are hidden from everyone (incl. server responses) until `revealed`.
- A player may change their vote until reveal.
- Reveal: host button, or automatically when every active participant has voted (Q3).
- Results: per-card counts, average, who voted what.
- Accept: host chooses final value (default = card nearest the average) → `task.effort`.
- Revote: host only; clears votes, `round++`, optionally archives previous round in `task.history`.
- Late joiner: may vote in the current round if not yet revealed (Q4).
- Coffee break: any player (☕ in footer) opens a yes/no poll; shows "n of m voted"; majority yes → pause (what "pause" means — timer? — still undecided).

## Data model additions (`db.js`)
```jsonc
project.session = {
  "status": "idle",            // "idle" | "lobby" | "playing" | "finished"
  "currentTaskId": null,
  "round": 1,
  "startedAt": null,
  "version": 0,                // ++ on every change; clients poll ?since=
  "coffee": null               // { "openedBy": "", "votes": { "<user>": true }, "closed": false }
}
project.users["<name>"] = { "lastSeen": "ISO", "joinedAt": "ISO", "joinSeq": 3, "clientId": "uuid" }
task.history = [ { "round": 1, "votes": {}, "average": 3.66, "agreedEffort": 3 } ]   // optional
```
`votes` / `revealed` already exist on tasks. `host` is **not stored** — derived from `joinSeq`.

## API sketch (all use existing `requireProject`; ✱ = also `requireHost`)
| Method & path | Body | Returns / effect |
|---|---|---|
| `POST /api/room/join` | – | `{ isHost, status }`; registers join order |
| `POST /api/room/leave` | – | removes active flag (sendBeacon) |
| `GET /api/room?since=n` | – | `{ version, status, host, participants:[{name,isHost,isYou,voted}], currentTask, round, revealed, myVote, votes?, average?, distribution?, coffee? }` |
| `POST /api/room/start` ✱ | `{ taskId? }` | `lobby → playing`; 400 if no un-estimated tasks |
| `POST /api/tasks/:id/vote` | `{ card }` | stores vote; 400 invalid card; 409 if revealed |
| `POST /api/room/reveal` ✱ | – | `revealed = true` |
| `POST /api/room/revote` ✱ | – | clear votes, `round++` |
| `POST /api/room/accept` ✱ | `{ value }` | set `task.effort`; advance or finish |
| `POST /api/room/end` ✱ | – | back to lobby/idle |
| `POST /api/room/coffee` / `/coffee/vote` | `{ yes }` | open poll / cast vote |

## Gotchas found while reading the code
- `x-user` is a self-declared label, so two people named the same collide, and anyone can claim to be host by guessing names. Real fix is the existing "sessions/cookies" TODO; until then host checks are advisory.
- `login.html` runs `sessionStorage.clear()` on load, so opening it mid-game drops your session.
- `board.html` skips auto-refresh while an `INPUT/TEXTAREA/SELECT` is focused — don't reuse that loop for voting.
- `EventSource` cannot set custom headers (RT-2).
- Presence writes the whole `data.json` every 10s per user (RT-5).

## Open questions
Q1 card count · Q2 who finalizes · Q3 reveal/revote rights · Q4 late joiners · Q5 invites · Q6 toggles · Q7 name · Q8 missing frames · Q9 layout width — see `TODO.md` §0 for recommended defaults.
