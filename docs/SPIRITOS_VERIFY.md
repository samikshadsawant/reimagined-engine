# SavitaOS — Verification Prompt
> Paste this entire file as a prompt to any AI assistant after implementation is complete.
> The AI will audit every file, catch bugs, and confirm correctness before you run the app.

---

## VERIFICATION PROMPT (copy everything below this line)

---

You are a senior full-stack engineer conducting a complete code review and verification audit of SavitaOS — a web-based OS demo built with React + Vite (frontend) and Node.js + Express (backend) with a multi-agent Claude AI system.

Your job is to read every file I provide and verify correctness across 7 categories. For each check, output either ✅ PASS, ⚠️ WARNING (works but has issues), or ❌ FAIL (broken, will crash or behave incorrectly). At the end, output a prioritized fix list.

Do not rewrite files unless I explicitly ask. Only audit and report.

---

## CATEGORY 1 — Project Structure & Configuration

Check these files: `.env.example`, `server/index.js`, `vite.config.js`, `tailwind.config.js`, `package.json` (root, client, server)

Verify:
- [ ] `MODEL_NAME` env var is used everywhere — no Claude model string is hardcoded anywhere in any file
- [ ] `ANTHROPIC_API_KEY` is read from env, never committed
- [ ] `DEMO_FS_ROOT` env var is used in all filesystem routes — no hardcoded paths
- [ ] `DATABASE_URL` points to SQLite for dev (`file:./savitaos.db`)
- [ ] CORS is configured to allow `localhost:5173` with credentials
- [ ] `express-session` middleware is registered before all routes
- [ ] `http.createServer(app)` is used (not `app.listen`) so WebSocket can attach to the same port
- [ ] `initWS(httpServer)` is called after server creation
- [ ] Prisma client is connected on startup with error handling
- [ ] Vite proxy config forwards `/api` and `/ws` to `localhost:3001`
- [ ] Tailwind content paths include all `src/**/*.{jsx,js}` files
- [ ] Root `package.json` has scripts: `dev` (runs both client+server concurrently), `build`, `start`

---

## CATEGORY 2 — Backend: Filesystem API

Check files: `server/lib/dfs.js`, `server/routes/fs.js`

Verify:
- [ ] `dfsTraverse()` is RECURSIVE (uses function calling itself), not iterative — this is the paper's core claim
- [ ] Entries are SORTED alphabetically before recursing — this is what achieves O(E·log N)
- [ ] The O(E·log N) complexity proof comment block is present at the top of `dfs.js`
- [ ] A `Set` of visited paths is used to prevent infinite loops from symlinks
- [ ] Each entry is wrapped in try/catch — a single unreadable file must NOT crash the whole traversal
- [ ] `flattenTree()`, `searchTree()`, `getStats()` are all exported
- [ ] PATH SANDBOX CHECK: every route in `fs.js` resolves the path with `path.resolve()` and verifies it starts with `DEMO_FS_ROOT` — if not, returns 403. This is critical security.
- [ ] `GET /api/fs/read` rejects binary files — only allows: `.txt .md .json .js .py .html .css .ts .jsx .tsx`
- [ ] All POST/DELETE routes validate their body with Zod schemas
- [ ] All routes have try/catch and return `{ error: string }` with appropriate HTTP status on failure
- [ ] `GET /api/fs/search` calls `flattenTree` then filters — NOT a new `dfsTraverse` call (performance)
- [ ] File size is included in all directory listing responses

---

## CATEGORY 3 — Backend: Multi-Agent System

Check files: `server/lib/anthropic.js`, `server/lib/context.js`, `server/agents/planner.js`, `server/agents/fileAgent.js`, `server/agents/systemAgent.js`, `server/agents/knowledgeAgent.js`, `server/routes/agent.js`

Verify:

**anthropic.js**
- [ ] `MODEL` is read from `process.env.MODEL_NAME` — no model string hardcoded
- [ ] `callClaudeJSON()` strips markdown fences (` ```json ` and ` ``` `) before `JSON.parse()`
- [ ] `callClaudeJSON()` throws a descriptive error that includes the raw response if parsing fails

**context.js**
- [ ] `buildContext()` reads `osState` from `req.body.osState` and applies safe defaults for every field
- [ ] `sessionHistory` is capped at 5 turns (10 messages max) before being passed to agents
- [ ] No sensitive data (passwords, tokens) can leak into the context object

**planner.js**
- [ ] The system prompt instructs the agent to output ONLY JSON — no explanation, no markdown
- [ ] The OS context is injected as `JSON.stringify(osContext)` into the system prompt
- [ ] The function throws (does not return null) if JSON parsing fails — so the route can catch it
- [ ] Output schema includes: `agent`, `confidence`, `task`, `params`, `requiresConfirmation`
- [ ] Valid agent values are exactly: `"file"`, `"system"`, `"knowledge"`, `"assistant"`

**fileAgent.js**
- [ ] Agent calls real filesystem functions from `dfs.js` / Node `fs` — not HTTP calls to its own API
- [ ] A second Claude call formats the raw filesystem result into a friendly user message
- [ ] Returns shape: `{ message: string, data: any, action: null }`

**systemAgent.js**
- [ ] Returns a structured action object — it does NOT directly mutate any state
- [ ] Valid action values: `openApp`, `closeApp`, `switchWindow`, `applyProfile`, `changeSetting`, `minimizeWindow`, `maximizeWindow`
- [ ] Valid app names match exactly what the frontend window manager accepts: `FileExplorer`, `Terminal`, `Calculator`, `Notes`, `Browser`, `Settings`
- [ ] Returns shape: `{ action: string, target: string, value: string|null, message: string }`

**agent.js route**
- [ ] Planner is always called first — no sub-agent is ever called directly without planning
- [ ] Each agent branch is in a try/catch — one agent failing must NOT crash the route
- [ ] A fallback response is returned (not a 500 error) if all agents fail
- [ ] Rate limiting is applied: max 20 requests/minute per session
- [ ] `AGENT_STATUS` WebSocket broadcast is emitted before and after each agent call
- [ ] Session history is updated after every successful response

---

## CATEGORY 4 — Frontend: Zustand Stores

Check files: `client/src/store/windowStore.js`, `client/src/store/osStore.js`, `client/src/store/agentStore.js`

Verify:

**windowStore.js**
- [ ] `openWindow()` checks for existing open window by `app` name and FOCUSES it instead of opening a duplicate — EXCEPT for `Terminal` and `Notes` which allow multiple instances
- [ ] `focusWindow()` sets `focused: true` on the target and `focused: false` on ALL other windows in one atomic update
- [ ] `focusWindow()` increments `topZIndex` and assigns the new value to the targeted window
- [ ] `minimizeWindow()` sets `minimized: true` — the window remains in the store (for taskbar restore)
- [ ] `maximizeWindow()` saves the pre-maximize position and size so `restoreWindow()` can return to them
- [ ] Uses `immer` middleware so array/object mutations are safe
- [ ] Window `id` is a UUID — not an array index or app name

**osStore.js**
- [ ] `applyProfile()` accepts a profile name and applies a full preset object atomically
- [ ] All 5 profile presets are defined: `default`, `elderly`, `visually-impaired`, `motor-impaired`, `beginner`
- [ ] `elderly` preset sets: `fontSize: 'xl'`, `contrast: 'high'`, `cursorSize: 'large'`
- [ ] Uses Zustand `persist` middleware — state survives page refresh
- [ ] `addNotification()` adds to the array; `dismissNotification()` removes by id

---

## CATEGORY 5 — Frontend: Desktop Shell

Check files: `client/src/desktop/Desktop.jsx`, `client/src/desktop/WindowFrame.jsx`, `client/src/desktop/Taskbar.jsx`

Verify:

**Desktop.jsx**
- [ ] Right-click on the desktop (not on any window/icon) opens ContextMenu
- [ ] Click anywhere outside the ContextMenu closes it
- [ ] `AIOverlay` is rendered at the highest z-index (above all windows)
- [ ] Taskbar is at the bottom and does NOT overlap window content (desktop has `padding-bottom: var(--os-taskbar-h)`)

**WindowFrame.jsx**
- [ ] Uses `react-rnd` for drag and resize
- [ ] Clicking the title bar calls `windowStore.focusWindow(id)` — the window comes to front
- [ ] Close (red) button: calls `windowStore.closeWindow(id)`
- [ ] Minimize (yellow) button: calls `windowStore.minimizeWindow(id)`
- [ ] Maximize (green) button: toggles `windowStore.maximizeWindow(id)` / `restoreWindow(id)`
- [ ] Minimized windows (`minimized: true`) are NOT rendered on the canvas (conditional return)
- [ ] Framer Motion open animation: scale 0.8→1.0 + opacity 0→1, 150ms spring
- [ ] Framer Motion close animation: scale 1.0→0.9 + opacity 1→0, 100ms
- [ ] `AnimatePresence` wraps the window list in Desktop.jsx so exit animations fire on close
- [ ] App component is selected via a map/switch — adding a new app only requires adding one entry to the map
- [ ] Minimum window size is enforced: 300px wide, 200px tall

**Taskbar.jsx**
- [ ] Clock updates every second using `setInterval` in a `useEffect` with cleanup
- [ ] Open app buttons show for every window in `windowStore` — including minimized ones
- [ ] Clicking a minimized app's taskbar button calls `restoreWindow(id)` then `focusWindow(id)`
- [ ] Dot indicator under pinned icons is visible when that app has an open window

---

## CATEGORY 6 — Frontend: Input Modalities

Check files: `client/src/input/GestureController.jsx`, `client/src/input/VoiceController.jsx`

Verify:

**GestureController.jsx**
- [ ] Component returns `null` and does nothing when `osStore.gestureEnabled` is false
- [ ] Webcam access uses `getUserMedia` inside a try/catch — permission denied shows a friendly modal, not a console error
- [ ] Gesture detection requires the gesture to be held for **800ms** before firing (debounce timer, reset on gesture change)
- [ ] A **2-second cooldown** is enforced after any gesture fires (no accidental rapid triggers)
- [ ] The `requestAnimationFrame` loop is cancelled on component unmount (no memory leak)
- [ ] Webcam stream tracks are stopped on component unmount
- [ ] All 5 gestures are implemented: THUMB_UP, THUMB_DOWN, PEACE_SIGN, THREE_FINGERS, OPEN_PALM
- [ ] Finger detection uses landmark y-coordinate comparison (tip.y < mcp.y in normalized coords)
- [ ] Gesture fires the correct `windowStore` action — not just a console.log

**VoiceController.jsx**
- [ ] Component returns `null` and does nothing when `osStore.voiceEnabled` is false
- [ ] Wake word is `"savita"` (case-insensitive match on transcript)
- [ ] After wake word detected: 5-second active listening window, then returns to passive
- [ ] `SpeechRecognition` is checked for browser support — unsupported browsers get a warning toast, not a crash
- [ ] Recognition is restarted automatically on `onend` event (browser stops it after silence)
- [ ] Direct commands (`open [app]`, `close window`) bypass the AI agent and call windowStore directly
- [ ] All other phrases are sent to `POST /api/agent/chat`

---

## CATEGORY 7 — Frontend: AI Overlay & Agent Integration

Check files: `client/src/ai/AIOverlay.jsx`, `client/src/ai/useAgent.js`

Verify:
- [ ] `POST /api/agent/chat` receives BOTH `message` AND `osState` — osState is built from both `windowStore` and `osStore`
- [ ] `osState.openWindows` is derived from windowStore (array of app names currently open)
- [ ] `osState.focusedWindow` reflects the currently focused window's app name
- [ ] When `response.action` is present, the frontend executes it:
  - `openApp` → calls `windowStore.openWindow(action.target, action.target)`
  - `closeApp` → calls `windowStore.closeWindow(focusedWindowId)`
  - `applyProfile` → calls `osStore.applyProfile(action.target)`
  - `changeSetting` → calls the correct `osStore` setter based on `action.target`
- [ ] Agent name badge shows the correct color: file=blue, system=orange, knowledge=purple, assistant=gray
- [ ] Typing indicator (animated dots) shows while awaiting agent response
- [ ] Error state is handled — API failure shows a user-friendly message, not a raw error object
- [ ] The overlay does NOT interfere with window dragging (pointer-events managed correctly)
- [ ] `AnimatePresence` is used for the panel open/close animation

---

## CATEGORY 8 — Integration Smoke Tests

After verifying individual files, check these end-to-end flows mentally:

**Flow 1: Open app via gesture**
- User shows 👍 thumb-up for 800ms
- GestureController detects gesture → calls `windowStore.openWindow('FileExplorer', 'File Explorer')`
- Desktop renders FileExplorer in a WindowFrame
- ✅ Expected: FileExplorer opens, is focused, taskbar shows it

**Flow 2: AI opens Calculator**
- User types "open the calculator" in AIOverlay
- AIOverlay sends `{ message: "open the calculator", osState: {...} }` to `POST /api/agent/chat`
- plannerAgent returns `{ agent: "system", task: "Open Calculator app", params: { action: "openApp", target: "Calculator" } }`
- systemAgent returns `{ action: "openApp", target: "Calculator", message: "Opening Calculator for you!" }`
- AIOverlay receives response, sees `action.action === "openApp"`, calls `windowStore.openWindow("Calculator", "Calculator")`
- ✅ Expected: Calculator opens, AI message shows in chat, agent badge shows orange "system"

**Flow 3: File search via voice**
- User says "Savita" (wake word activates), then "find my resume"
- VoiceController sends "find my resume" to `POST /api/agent/chat`
- plannerAgent routes to `file` agent with `{ operation: "search", query: "resume" }`
- fileAgent calls `searchTree(tree, "resume")` on the demo filesystem
- Returns `{ message: "I found 2 files matching 'resume': ...", data: [...], action: null }`
- AIOverlay displays message, no action executed
- ✅ Expected: Search results shown in AI overlay chat

**Flow 4: Accessibility profile change**
- User opens Settings → Accessibility → clicks "Elderly Mode" → Apply
- `osStore.applyProfile('elderly')` is called
- `useAccessibility` hook detects change, injects CSS variables: `--os-font-size: 22px`, etc.
- ✅ Expected: All text on the OS immediately enlarges, high contrast applies

**Flow 5: Window close**
- User clicks red close button on any open window
- `windowStore.closeWindow(id)` is called
- Framer Motion exit animation plays (scale 0.9, opacity 0, 100ms)
- Window is removed from store
- Taskbar button disappears
- ✅ Expected: Smooth close animation, no ghost window in taskbar

---

## OUTPUT FORMAT

After checking all files, respond with:

### Verification Report

**Overall Status:** [READY TO RUN / NEEDS FIXES / CRITICAL ISSUES]

**Category Results:**
| # | Category | Status | Issues Found |
|---|---|---|---|
| 1 | Project Structure & Config | ✅/⚠️/❌ | count |
| 2 | Filesystem API | ✅/⚠️/❌ | count |
| 3 | Multi-Agent System | ✅/⚠️/❌ | count |
| 4 | Zustand Stores | ✅/⚠️/❌ | count |
| 5 | Desktop Shell | ✅/⚠️/❌ | count |
| 6 | Input Modalities | ✅/⚠️/❌ | count |
| 7 | AI Overlay | ✅/⚠️/❌ | count |
| 8 | Integration Flows | ✅/⚠️/❌ | count |

---

### ❌ Critical Fixes (will crash or break core functionality)
For each: **File** → **Problem** → **Exact fix required**

### ⚠️ Warnings (works but has bugs or missing features)
For each: **File** → **Problem** → **Suggested fix**

### ✅ What's working well
Brief summary of solid implementations.

### 🚀 Run Checklist
Steps to run after fixes:
1. `cp .env.example .env` and fill in `ANTHROPIC_API_KEY` and `MODEL_NAME`
2. `npm install` (root)
3. `cd server && npx prisma migrate dev --name init`
4. Create `demo-filesystem/` with sample folders and files
5. `npm run dev` (starts both client and server)
6. Open `http://localhost:5173`

---

*Now provide your implementation files one by one and I will audit each one.*
