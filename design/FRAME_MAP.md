# Figma → site map

Source: `Planning Poker.fig` (page "Page 1": 12 screens + 7 components, all 768×960 or component-sized, Inter, grayscale wireframe).
Images: `GroupProject/public/images/figma/screens/NN-name.png|svg` and `.../components/`. Tokens: `design/tokens.json`.
Overview of everything: `GroupProject/public/images/figma/overview-thumbnail.png`.

## Screens
| # | Frame | Contents | Becomes | Status |
|---|-------|----------|---------|--------|
| 01 | Landing | Title, text lines, people-around-table illustration, primary + secondary button | `index.html` — Start game / Resume game | UI-1 |
| 02 | Create Game | Label + Value input, button, 3 toggle rows (Label/Description) | Create section of `login.html` | UI-2, Q6 |
| 03 | Invite Players | "People with access" (emails), QR code | Invite panel (footer **Invite Players**) | UI-3, Q5 |
| 04 | Voting | "Pick your card!", Task Box, 3 player table cards, "Complexity:" row of 9 vote cards | `game.html` | VOTE-6 |
| 05 | Card Selected | Same; one vote card filled dark + ▲; other players' cards dark = already voted, white = not yet | `game.html` state | VOTE-6 |
| 06 | Results | Bars per value (3, 5) with labels, **Average 3.66**, button bottom | `game.html` results state | VOTE-7, API-10 |
| 07 | Revote | "Revote?" + primary and secondary button | confirm dialog | VOTE-8 |
| 08 | Tasks Complete | "Tasks Complete!" card, 1 primary + 2 secondary buttons | end screen | UI-7 |
| 09 | How to Play | Two image placeholders, "First create tasks" | `tutorial.html` (header **Tutorial**) | UI-6, DS-4 |
| 10 | Tasks Panel | "Tasks \| 3", In progress / Completed columns of Task Items, button | slide-up panel (footer **Tasks**) / board list | UI-4 |
| 11 | Coffee Break Vote | Modal "Coffee Break?" Yes/No, "2 out of 3 votes so far" | overlay on game | VOTE-10 |
| 12 | Coffee Break Results | Yes 67% / No 33% bars, "3 votes" | overlay result | VOTE-10 |

## Components
| Component | Notes |
|-----------|-------|
| App Header (768×72) | Logo + "Planning Poker", **Tutorial** link, avatar + "Player 1 ▾" (user menu: leave game / log out) |
| App Footer (768×64) | ☕ coffee-break trigger (left), **Invite Players** (center), **Tasks ☰** (right). Left cell highlighted gray while a coffee poll is open |
| Vote Card (140×76 in frame, selectable) | Number; selected = dark fill + ▲ |
| Table Card (162×62) | Per-player card on the table + name under it; face-down until reveal |
| Task Box (400×120) | "Task:" title + 2 text lines (task text + note / user stories) |
| Task Item (270×72) | ID like `PP-1` + text lines; used in In progress / Completed |
| Player Chip (86×28) | Avatar + name; top-right list in game frames, and the natural fit for the waiting room |

## Gaps to flag
- **Waiting room:** no frame. Suggest: frame 04's chrome + Player Chips list + big **Start game** (host) or "Waiting for host…".
- **9 vs 10 cards:** Figma has 9 vote cards, server accepts 10 values.
- **Figma placeholders:** every card shows "1", "Label", "Button", "person1@email.com" — all copy still to be written.
- **Brand:** "Planning Poker" (Figma) vs "Deck Of Stories" (current site).
- **Not designed:** add-task form, task detail / user stories, group notes, effort summary table, error/empty states, mobile widths.
- Logo icon, avatar and coffee/task-list icons exist as vectors in the .fig → export as SVG (DS-2).
