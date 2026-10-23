// TODO (schema v2) - new fields to add; old data.json files must still load, so default them in read():
//   task.effort       number|null      e.g. Fibonacci value 1,2,3,5,8,13 (the agreed/final estimate)
//   task.userStories  string           user stories text, shown when a task is clicked
//   task.status       "todo"|"done"    replaces assigned/unassigned-only model; "done" feeds the completed bar
//   task.completedAt  ISO string|null  set when status becomes "done"
//   project.users     { "<name>": { lastSeen: ISO string } }   who is currently at the board (presence)
//   TODO: in read(), backfill missing fields: effort=null, userStories="", status="todo", completedAt=null, project.users={}
//
// JSON-file "database". Shape (v1, current):
// { "projects": { "<lowercased name>": { "name": "...", "note": "...",
//     "tasks": [ { "id": "", "task": "", "note": "", "assignee": null } ] } } }
const fs = require("fs");
const FILE = require("path").join(__dirname, "data.json");

const keyOf = (name) => (name || "").trim().toLowerCase(); // case-insensitive project lookup

function read() {
  if (!fs.existsSync(FILE)) fs.writeFileSync(FILE, JSON.stringify({ projects: {} }, null, 2));
  return JSON.parse(fs.readFileSync(FILE, "utf8"));
}

function write(data) {
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
  }

module.exports = { read, write, keyOf };
