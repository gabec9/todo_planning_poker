# Planning Poker (barebones)

    npm install
    npm start        # http://localhost:3000

Data lives in `data.json` (auto-created). Login = project name (case-insensitive), no password.

## Layout
- `db.js`            read/write JSON file, `keyOf()` lowercases project names
- `server.js`        Express API (login, projects, tasks, notes)
- `public/login.html` login + create project
- `public/board.html` shared board: task list, filter, assign, group note
- `public/api.js`     fetch helper

## Data shape
    { "projects": { "my project": { "name": "My Project", "note": "",
        "tasks": [ { "id": "", "task": "", "note": "", "assignee": null } ] } } }

Search the code for `TODO` to find what's left to build.

## Planned next (all stubbed as TODOs in the code)
- Effort values per task (+ effort summary table at the bottom of "Everyone's tasks")
- Presence bar: everyone currently at the board, shown at the top
- User stories field, shown when a task is clicked
- Done status + completed-tasks bar (with reopen)
