# TicTacToe Pro — Master the Grid

A compact, production-ready tic-tac-toe web app with a polished UI, an unbeatable minimax AI, a training/coach mode, and simple Firebase-backed multiplayer scaffolding. The project is organized as a static front-end app with separate assets for styles and JavaScript.

## Repository layout

- `index.html` — application shell and entry point.
- `css/style.css` — core styles (extracted from the original single-file app).
- `js/app.js` — application logic (UI wiring, background animation, AI, multiplayer hooks).
- `Game.html` — original single-file version (kept for reference).
- `README.md` — this document.

## How the app works (high level)

1. The UI is a single-page layout with several absolute-positioned "screens" (menu, setup, multiplayer, lobby, game).
2. A background canvas renders a decorative "smart snake" (pathfinding-driven animation) that runs independently from game logic.
3. The game supports three modes:
   - Local standard: play vs AI (you are X by default, starter is randomized).
   - Learning/Coach: the app highlights suboptimal moves and can auto-correct them to teach strategy.
   - Multiplayer: basic Firebase Firestore-backed game synchronization using a 6-digit room code.

## Technical details

### Tic-Tac-Toe AI (minimax)

- Algorithm: Minimax search with full-depth exploration (game tree for 3x3 tic-tac-toe is small enough for exhaustive search). The implementation returns a numeric score for terminal states: +10 for AI win (minus depth), -10 for opponent win (plus depth), and 0 for draw. Depth is used to prefer faster wins and slower losses.
- Move selection: For the AI's turn we evaluate all legal moves with minimax and pick one of the best-scoring moves (randomized among equals to add variety).
- Complexity: Worst-case branching is small (at most 9 moves initially), and the search finishes instantly in modern browsers. No pruning is necessary but the depth-based scoring handles tie-breaking.

Key functions in `js/app.js`:
- `checkWin(board)` — checks board against the 8 winning patterns and returns the winner or `Draw`.
- `minimax(board, depth, isMax, aiMark)` — recursive evaluator returning integer score.
- `getBestMoves(board, player)` — returns all best moves and the associated score.

### Background "Smart Snake" pathfinding

- Grid: the canvas is sampled into a grid (grid cell size = 30px) and the snake occupies integer grid coordinates.
- Pathfinding: a lightweight breadth-first search (BFS) computes a shortest path from the snake's head to a target (either a clicked "apple" or a random wander target). BFS uses a simple queue with a parent pointer to reconstruct the path.
- Performance: BFS is limited by `maxSteps` (2000) to avoid pathological stalls on very large viewports. The animation decouples movement and drawing; the snake advances along the computed path each tick.

### Multiplayer (Firestore) — notes

- The code includes Firestore reads/writes to `artifacts/${appId}/public/data/games/{code}` to create and sync games by code.
- High-level flow:
  1. Player A creates a game: a document with `board`, `playerX`, `playerO`, `currentPlayer`, and `createdAt` is written.
  2. Player B joins: their uid is written to `playerO` and both clients subscribe to onSnapshot to receive updates.
  3. Moves are persisted by writing the serialized `board`, `currentPlayer`, and optional `winner`.
- The shipped code expects `firebaseConfig` (or replacements for `__firebase_config`) to be injected if multiplayer is used.

## File responsibilities and where to change behavior

- `css/style.css` — visual styling, layout constraints, and small animations.
- `js/app.js` — everything else: background animation, game rules, AI, multiplayer, and UI wiring.
- `index.html` — minimal shell that loads assets and contains the DOM roots.

## Running locally

Open `index.html` in your browser for a quick preview. For a more realistic environment (CSP, module import behavior), use a local static server. In PowerShell (project root):

```powershell
python -m http.server 8080
# open http://localhost:8080
```

## Development tips

- If you change `js/app.js` and want hot reload, use a lightweight dev server with automatic refresh (e.g., Live Server extension or a small node-based static server).
- Keep Firebase configuration out of source for public repos. Inject config at build time or load via environment-controlled script.

## Tests & validation

- The core logic (minimax, checkWin) is pure JS and easy to unit-test. Recommended quick tests:
  - Verify `checkWin` detects every win pattern and draw.
  - Validate `minimax` returns non-zero for immediate win/loss states.

## Contributing

Small, focused PRs are welcome. Good first contributions:
- Add unit tests for the AI logic.
- Improve accessibility (ARIA, focus management) across screens.
- Extract and bundle assets with a simple build step (optional).

## License & credits

Created and maintained by AlpakaaaaaScript (Anmol Guragai).
