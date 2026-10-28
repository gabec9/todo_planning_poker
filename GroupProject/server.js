// Planning Poker - barebones server. Run: npm install && npm start
const express = require("express");
const path = require("path");
const db = require("./db");

const app = express();
const fib = [1, 2, 3, 5, 8, 13, 21, 34, 55];
// Return null, a valid Fibonacci number, or undefined
function parseEffort(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return fib.includes(n) ? n : undefined;
}

app.use(express.json());
// Launching the app (/) always lands on the login page
app.get("/", (req, res) => res.redirect("/login.html"));
app.use(express.static(path.join(__dirname, "public"))); // absolute path: works from any cwd

// "Auth": project name is the only gate. Client sends x-project and x-user headers.
// TODO: replace with real sessions/cookies + passwords/invite codes later.
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
app.get("/api/project", requireProject, (req, res) => {
  res.json(db.read().projects[req.projectKey]);
});

app.post("/api/tasks", requireProject, (req, res) => {
  const data = db.read();
  const task = {
    id: Date.now().toString(36),
    task: (req.body.task || "").trim(),
    note: req.body.note || "",
    assignee: null,        // null = unassigned
    // TODO: effort: null, userStories: req.body.userStories || "", status: "todo", completedAt: null
    // TODO: estimate / votes fields for the actual poker round
  };
  if (!task.task) return res.status(400).json({ error: "Task text required" });
  data.projects[req.projectKey].tasks.push(task);
  db.write(data);
  res.status(201).json(task);
});

app.patch("/api/tasks/:id", requireProject, (req, res) => {
  const data = db.read();
  const task = data.projects[req.projectKey].tasks.find(t => t.id === req.params.id);
  if (!task) return res.status(404).json({ error: "Task not found" });
  // Whitelist updatable fields
  // TODO: add "effort" (validate: null or positive number, ideally from the Fibonacci set) and "userStories" to this whitelist
  for (const f of ["task", "note", "assignee"]) if (f in req.body) task[f] = req.body[f];
  // TODO: if req.body.status is "done" -> set task.status = "done", task.completedAt = new Date().toISOString()
  //       if req.body.status is "todo" (reopen) -> task.status = "todo", task.completedAt = null
  // TODO: decide whether a task must be assigned before it can be marked done
  db.write(data);
  res.json(task);
});

// delete function
app.delete("/api/tasks/:id", requireProject, (req, res) => {
  const data = db.read();
  const tasks = data.projects[req.projectKey].tasks;
  const i = tasks.findIndex(t => t.id === req req.params.id);
  if (i == -1) return res.status(404).json({ error: "Task not found" });

  const [removed] = tasks.splice(i, 1);
  db.write(data);
  res.json({ ok: true, id: removed.id });
});

// ---- Presence: who is at the board ----
// TODO: POST /api/presence  -> set project.users[req.user].lastSeen = now (client calls this every ~10s)
// TODO: GET  /api/project   -> also return the list of users whose lastSeen is within the last ~30s ("online")
// TODO: decide if users who were ever seen (but offline) should still appear greyed out

// ---- Effort summary ----
// TODO: GET /api/project/effort -> [{ user, totalEffort, taskCount, doneEffort }] summed over tasks by assignee
//       (skip tasks with effort === null; include an "Unassigned" row); client can also compute this itself from /api/project

// ---- Completed tasks ----
// TODO: GET /api/project/completed -> tasks with status "done", newest completedAt first (or just filter client-side)

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
  console.log(require("fs").existsSync(path.join(PUBLIC, "login.html")) ? "login.html found" : "WARNING: login.html NOT found in public/");
  console.log(`http://localhost:${PORT}`);
}).on("error", (e) => {
  if (e.code === "EADDRINUSE") console.error(`Port ${PORT} is already in use (an old server may still be running). Stop it or run: PORT=3001 npm start`);
  else throw e;
});
