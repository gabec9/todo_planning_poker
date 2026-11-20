// Planning Poker - barebones server. Run: npm install && npm start
const express = require("express");
const path = require("path");
const db = require("./db");

const app = express();
const fib = [0, 1, 2, 3, 5, 8, 13, 21, 40, 100];
// TODO(Q1/API-9): Figma shows 9 vote cards, this list has 10 - decide, then serve one list to the client via GET /api/config
// Return null, a valid Fibonacci number, or undefined
function parseEffort(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return fib.includes(n) ? n : undefined;
}

app.use(express.json());
// Launching the app (/) lands on the home page
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));
app.use(express.static(path.join(__dirname, "public"))); // absolute path: works from any cwd

// "Auth": project name is the only gate. Client sends x-project and x-user headers.
// TODO: replace with real sessions/cookies + passwords/invite codes later.
// TODO(LOBBY-10): also read an x-client id (per-tab) so two people with the same name do not collide
// TODO(API-7): requireHost middleware (host = earliest-joined active participant; see docs/LOBBY_AND_GAME_FLOW.md) - advisory until real sessions exist
function requireProject(req, res, next) {
  const key = db.keyOf(req.get("x-project"));
  const data = db.read();
  if (!key || !data.projects[key]) return res.status(401).json({ error: "Unknown project" });
  req.projectKey = key;
  req.user = (req.get("x-user") || "").trim();
  next();
}

// ---- Login / project creation ----
// Login: project name only (case-insensitive). User name is just a display label.
app.post("/api/login", (req, res) => {
  const key = db.keyOf(req.body.project);
  const data = db.read();
  if (!data.projects[key]) return res.status(404).json({ error: "Project not found" });
  res.json({ project: data.projects[key].name, user: (req.body.user || "").trim() });
});

app.post("/api/projects", (req, res) => {
  const name = (req.body.name || "").trim();
  const key = db.keyOf(name);
  if (!key) return res.status(400).json({ error: "Name required" });
  const data = db.read();
  if (data.projects[key]) return res.status(409).json({ error: "Project already exists" });
  data.projects[key] = { name, note: "", tasks: [] };
  db.write(data);
  res.status(201).json({ project: name });
});

// ---- Group board ----
// Returns everything: all tasks (assigned + unassigned) and the project note.
// Filtering assigned/unassigned happens client-side; TODO: move server-side if lists get big.
// Returns the project, who is online, and tasks with votes hidden until revealed.
const ONLINE_WINDOW_MS = 30 * 1000;

app.get("/api/project", requireProject, (req, res) => {
  const project = db.read().projects[req.projectKey];
  const now = Date.now();

  const online = Object.entries(project.users || {})
    .filter(([, u]) => now - Date.parse(u.lastSeen) < ONLINE_WINDOW_MS)
    .map(([name]) => name);
  if (req.user && !online.includes(req.user)) online.push(req.user);

  const tasks = project.tasks.map(({ votes = {}, revealed = false, ...t }) => ({
    ...t,
    revealed,
    votedBy: Object.keys(votes),
    myVote: votes[req.user] ?? null,
    ...(revealed ? { votes } : {}),
  }));

  // TODO(API-2): also return a session summary { status, host, currentTaskId } so board buttons can say "Join vote" vs "Revote"
  res.json({ ...project, tasks, online });
});

app.post("/api/tasks", requireProject, (req, res) => {
  const text = (req.body.task || "").trim();
  if (!text) return res.status(400).json({ error: "Task text required" });

  const effort = parseEffort(req.body.effort);
  if (effort === undefined) {
    return res.status(400).json({ error: `Effort must be one of ${fib.join(", ")}` });
  }

  const data = db.read();
  const task = {
    id: Date.now().toString(36),
    task: text,
    note: req.body.note || "",
    assignee: null,
    effort,
    userStories: String(req.body.userStories || ""),
    status: "todo",
    completedAt: null,
    votes: {},
    revealed: false,
  };
  data.projects[req.projectKey].tasks.push(task);
  db.write(data);
  res.status(201).json(task);
});

app.patch("/api/tasks/:id", requireProject, (req, res) => {
  const data = db.read();
  const task = data.projects[req.projectKey].tasks.find(t => t.id === req.params.id);
  if (!task) return res.status(404).json({ error: "Task not found" });

  for (const f of ["task", "note", "assignee"]) if (f in req.body) task[f] = req.body[f];
  if ("userStories" in req.body) task.userStories = String(req.body.userStories);

  if ("effort" in req.body) {
    const effort = parseEffort(req.body.effort);
    if (effort === undefined) {
      return res.status(400).json({ error: `Effort must be one of ${fib.join(", ")}` });
    }
    task.effort = effort;
  }

  if ("status" in req.body) {
    if (req.body.status === "done") {
      if (task.status !== "done") {
        task.status = "done";
        task.completedAt = new Date().toISOString();
      }
    } else if (req.body.status === "todo") {
      task.status = "todo";
      task.completedAt = null;
    } else {
      return res.status(400).json({ error: 'Status must be "todo" or "done"' });
    }
  }

  if (!String(task.task).trim()) return res.status(400).json({ error: "Task text required" });
  if (task.status === "done" && !task.assignee) {
    return res.status(400).json({ error: "Assign the task before marking it done" });
  }

  db.write(data);
  res.json(task);
});

// TODO(VOTE-1): new tasks start un-estimated; the add-task form will stop sending `effort` (keep accepting it for tests/back-compat)
// TODO(API-3): POST /api/tasks/:id/vote {card}   - participants only, valid card, 409 once revealed
// TODO(API-4): POST /api/room/reveal   (host, or auto when everyone voted)
// TODO(API-5): POST /api/room/revote   (host) - clear votes, revealed=false, round++
// TODO(API-6): POST /api/room/accept {value} (host) - sets task.effort (Q2: snap average to a card), advances to next task
// TODO(LOBBY-2/6): POST /api/room/join, /leave, /start ; GET /api/room?since=n  (see rooms.js stub)
// TODO(API-8): coffee break poll endpoints
// delete function
app.delete("/api/tasks/:id", requireProject, (req, res) => {
  const data = db.read();
  const tasks = data.projects[req.projectKey].tasks;
  const i = tasks.findIndex(t => t.id === req.params.id);
  if (i == -1) return res.status(404).json({ error: "Task not found" });

  const [removed] = tasks.splice(i, 1);
  db.write(data);
  res.json({ ok: true, id: removed.id });
});

// ---- Presence: who is at the board ----
// POST /api/presence  -> set project.users[req.user].lastSeen = now (client calls this every ~10s)
app.post("/api/presence", requireProject, (req, res) => {
  if (!req.user || req.user === "__proto__") {
    return res.status(400).json({ error: "User name required" });
  }
  const data = db.read();
  const project = data.projects[req.projectKey];
  project.users ??= {};                       // projects made via POST /api/projects have no users yet
  const lastSeen = new Date().toISOString();
  project.users[req.user] = { ...project.users[req.user], lastSeen };
  db.write(data);
  res.json({ ok: true, lastSeen });
});

// TODO: decide if users who were ever seen (but offline) should still appear greyed out
// TODO(LOBBY-8): POST /api/room/leave for sendBeacon; TODO(RT-5): presence rewrites data.json every 10s per user - consider memory

// ---- Effort summary ----
// GET /api/project/effort -> [{ user, totalEffort, taskCount, doneEffort }] summed over tasks by assignee
//       (skip tasks with effort === null; include an "Unassigned" row); client can also compute this itself from /api/project
app.get("/api/project/effort", requireProject, (req, res) => {
  const tasks = db.read().projects[req.projectKey].tasks;
  const rows = {};   // key: assignee name or "Unassigned"

  for (const t of tasks) {
    if (t.effort == null) continue;                    // skip null/undefined effort
    const user = t.assignee || "Unassigned";
    const row = (rows[user] ??= { user, totalEffort: 0, taskCount: 0, doneEffort: 0 });
    row.totalEffort += t.effort;
    row.taskCount += 1;
    if (t.status === "done") row.doneEffort += t.effort;
  }

  const list = Object.values(rows).sort((a, b) =>
    a.user === "Unassigned" ? 1 : b.user === "Unassigned" ? -1 : a.user.localeCompare(b.user));
  res.json(list);
});

// ---- Completed tasks ----
// GET /api/project/completed -> tasks with status "done", newest completedAt first (or just filter client-side)
app.get("/api/project/completed", requireProject, (req, res) => {
  const tasks = db.read().projects[req.projectKey].tasks
    .filter(t => t.status === "done")
    .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt)); // newest first
  res.json(tasks);
});

// ---- Group notes ----
app.put("/api/project/note", requireProject, (req, res) => {
  const data = db.read();
  data.projects[req.projectKey].note = req.body.note || "";
  db.write(data);
  res.json({ ok: true });
});


const PORT = process.env.PORT || 3000;
const PUBLIC = path.join(__dirname, "public");
app.listen(PORT, () => {
  console.log(`Serving ${PUBLIC}`);
  console.log(require("fs").existsSync(path.join(PUBLIC, "index.html")) ? "index.html found" : "WARNING: index.html NOT found in public/");
  console.log(`http://localhost:${PORT}`);
}).on("error", (e) => {
  if (e.code === "EADDRINUSE") console.error(`Port ${PORT} is already in use (an old server may still be running). Stop it or run: PORT=3001 npm start`);
  else throw e;
});
