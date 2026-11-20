// JSON-file "database". Shape (v2, current):
// { "projects": { "<lowercased name>": {
//     "name": "...", "note": "...",
//     "users": { "<name>": { "lastSeen": "ISO string" } },
//     "tasks": [ {
//       "id": "", "task": "", "note": "", "assignee": null,
//       "effort": null,          // number|null, the agreed/final estimate
//       "userStories": "",       // shown when a task is clicked
//       "status": "todo",        // "todo" | "done"
//       "completedAt": null,     // ISO string|null, set when status becomes "done"
//       "votes": {},             // poker round: { "<user>": card }
//       "revealed": false        // true once cards are flipped
//     } ]
// } } }
// Old data.json files still load: read() backfills any missing v2 fields.
// TODO(API-1): v3 = project.session { status, currentTaskId, round, startedAt, version, coffee }, users[].joinedAt/joinSeq/clientId,
//   optional task.history[]. Backfill them in read() below. Shape: docs/LOBBY_AND_GAME_FLOW.md
const fs = require("fs");
const FILE = require("path").join(__dirname, "data.json");

const keyOf = (name) => (name || "").trim().toLowerCase(); // case-insensitive project lookup

function read() {
  if (!fs.existsSync(FILE)) fs.writeFileSync(FILE, JSON.stringify({ projects: {} }, null, 2));
  const data = JSON.parse(fs.readFileSync(FILE, "utf8"));

  // Backfill: ??= only fills fields that are null/undefined, so existing values are kept.
  data.projects ??= {};
  for (const p of Object.values(data.projects)) {
    p.note ??= "";
    p.users ??= {};
    p.tasks ??= [];
    for (const t of p.tasks) {
      t.assignee ??= null;
      t.effort ??= null;
      t.userStories ??= "";
      t.status ??= "todo";
      t.completedAt ??= null;
      t.votes ??= {};
      t.revealed ??= false;
    }
  }
  return data;
}

function write(data) {
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
}

module.exports = { read, write, keyOf };