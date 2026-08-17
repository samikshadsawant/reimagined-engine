# SavitaOS — AI Build Guide
> **For AI Assistants:** This document is your complete specification to build SavitaOS from scratch.
> Read the entire file before writing any code. Every section contains explicit prompts you must use
> when generating code for that module. Follow the tech stack exactly. Do not deviate from the
> agent assignments defined in Section 3.

---

## Table of Contents
1. [Project Vision](#1-project-vision)
2. [Tech Stack](#2-tech-stack)
3. [Multi-Agent System — Master Definition](#3-multi-agent-system--master-definition)
4. [Project Structure](#4-project-structure)
5. [Phase 1 — Desktop Shell & Window Manager](#5-phase-1--desktop-shell--window-manager)
6. [Phase 2 — Filesystem API (Backend)](#6-phase-2--filesystem-api-backend)
7. [Phase 3 — Built-in Applications](#7-phase-3--built-in-applications)
8. [Phase 4 — Input Modalities](#8-phase-4--input-modalities)
9. [Phase 5 — Multi-Agent AI System](#9-phase-5--multi-agent-ai-system)
10. [Phase 6 — Accessibility & Profiles](#10-phase-6--accessibility--profiles)
11. [Phase 7 — WebSocket Live Events](#11-phase-7--websocket-live-events)
12. [Database Schema](#12-database-schema)
13. [Environment & Configuration](#13-environment--configuration)
14. [Key Algorithms](#14-key-algorithms)
15. [UI/UX Design Tokens](#15-uiux-design-tokens)

---

## 1. Project Vision

SavitaOS is a **web-based operating system demo** that runs entirely in the browser with zero installation.
It simulates a real desktop OS experience with:

- A fully draggable, resizable multi-window desktop environment
- A real filesystem API that performs DFS traversal on an actual demo directory on the server
- Four input modalities: **Gesture** (MediaPipe hand tracking), **Voice** (Web Speech API), **Eye tracking** (WebGazer.js), **Keyboard shortcuts**
- A **multi-agent AI system** where a Planner Agent routes user intent to specialized sub-agents that can open apps, navigate files, answer questions, and control the OS
- One-click accessibility profiles for elderly, visually impaired, motor-impaired, and beginner users

**Target use:** Conference demo, hackathon presentation, research paper demonstration.

**Core claim from paper:** DFS traversal algorithm achieves O(E·log N) time complexity vs traditional BFS O(E+V).

---

## 2. Tech Stack

### Frontend
| Concern | Library / Tool | Version |
|---|---|---|
| Framework | React | 18.x |
| Build tool | Vite | 5.x |
| Styling | Tailwind CSS | 3.x |
| Window drag/resize | `react-rnd` | latest |
| Gesture detection | `@mediapipe/hands` | 0.4.x |
| Eye tracking | `webgazer` | 2.x (CDN) |
| Icons | `lucide-react` | latest |
| Animations | Framer Motion | 11.x |
| Terminal emulator | `xterm.js` | 5.x |
| State management | Zustand | 4.x |
| HTTP client | Axios | latest |
| WebSocket | native `WebSocket` | — |

### Backend
| Concern | Library / Tool |
|---|---|
| Runtime | Node.js 20.x |
| Framework | Express 4.x |
| WebSocket | `ws` library |
| ORM | Prisma |
| Database | SQLite (dev) / PostgreSQL (prod) |
| File operations | Node.js `fs`, `path` modules |
| Validation | Zod |
| Auth | `express-session` + `bcryptjs` |
| AI SDK | `@anthropic-ai/sdk` |
| Environment | `dotenv` |

### AI / Agents
| Concern | Choice |
|---|---|
| LLM provider | Anthropic Claude API |
| Model | configurable via `MODEL_NAME` env var — do NOT hardcode |
| Agent pattern | Sequential tool-use with shared context object |
| Prompt format | System prompt per agent + shared OS context injected as JSON |

---

## 3. Multi-Agent System — Master Definition

> **CRITICAL FOR AI:** Every agent is a separate Node.js module in `server/agents/`.
> The **Planner Agent** always runs first. It reads the user message + OS state and
> returns a routing decision JSON. Then the appropriate sub-agent executes and returns
> a structured `ActionResult` back to the frontend.

### Agent Roster

```
User Message
     │
     ▼
┌─────────────────────────────┐
│       PLANNER AGENT         │  ← Always first. Classifies intent.
│  Decides: which agent + task│
└────────────┬────────────────┘
             │
   ┌─────────┼──────────┬─────────────┐
   ▼         ▼          ▼             ▼
FILE      SYSTEM     KNOWLEDGE    ASSISTANT
AGENT     AGENT       AGENT        AGENT
```

### Agent Responsibilities

#### 3.1 Planner Agent
**Owns:** Intent classification, task decomposition, agent routing
**Triggered by:** Every user message, every voice command, every gesture action
**Does NOT call:** External APIs, filesystem, or OS directly
**Output format:**
```json
{
  "agent": "file | system | knowledge | assistant",
  "confidence": 0.0-1.0,
  "task": "human readable task description",
  "params": {},
  "requiresConfirmation": false,
  "fallbackAgent": "assistant"
}
```

#### 3.2 File Agent
**Owns:** All filesystem operations
**Functions it handles:**
- Search files by name, extension, content keywords
- Read file contents and summarize
- Create new files/folders
- List directory contents
- Find recently modified files
- Get file metadata

**Triggered when user says things like:**
"find my resume", "open the documents folder", "what's in this folder", "create a new text file", "search for PDF files"

#### 3.3 System Agent
**Owns:** OS-level UI control — opening/closing apps, switching windows, changing settings
**Functions it handles:**
- Open a named application
- Close the active window
- Minimize / maximize window
- Switch to a specific open window
- Apply an accessibility profile
- Change theme / font size
- Trigger gesture mode or voice mode

**Triggered when user says things like:**
"open calculator", "close this window", "switch to dark mode", "enable large text", "open file explorer"

**Output format:**
```json
{
  "action": "openApp | closeApp | switchWindow | applyProfile | changeSetting",
  "target": "AppName | windowId | profileName | settingKey",
  "value": "optional value for settings",
  "message": "Confirmation message to show user"
}
```

#### 3.4 Knowledge Agent
**Owns:** Answering questions, explaining OS features, web search, general Q&A
**Functions it handles:**
- Answer questions about SavitaOS features
- Explain how gestures work
- Answer general knowledge questions
- Explain file contents once File Agent reads them
- Provide usage tips

**Triggered when user says things like:**
"what gesture opens the calculator", "how do I use voice mode", "explain this file", "what does DFS mean", "help"

#### 3.5 Assistant Agent (fallback)
**Owns:** Anything that doesn't clearly fit the above categories
**Functions it handles:**
- Conversational responses
- Multi-step tasks that span multiple agents
- Clarification requests
- Error recovery ("I'm not sure what you mean by...")

---

## 4. Project Structure

```
savita-os/
│
├── client/                          # React + Vite frontend
│   ├── index.html
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── src/
│   │   ├── main.jsx                 # App entry, providers
│   │   ├── App.jsx                  # Root router
│   │   │
│   │   ├── store/                   # Zustand stores
│   │   │   ├── windowStore.js       # Open windows, z-index, focus
│   │   │   ├── osStore.js           # OS state: theme, profile, wallpaper
│   │   │   └── agentStore.js        # AI chat history, agent status
│   │   │
│   │   ├── desktop/
│   │   │   ├── Desktop.jsx          # Root desktop canvas
│   │   │   ├── Taskbar.jsx          # Bottom bar with clock, open apps
│   │   │   ├── WindowFrame.jsx      # Draggable/resizable chrome
│   │   │   ├── DesktopIcon.jsx      # Double-click to open app
│   │   │   └── ContextMenu.jsx      # Right-click menu
│   │   │
│   │   ├── apps/
│   │   │   ├── FileExplorer/
│   │   │   │   ├── index.jsx
│   │   │   │   ├── TreeView.jsx
│   │   │   │   └── FileGrid.jsx
│   │   │   ├── Terminal/
│   │   │   │   └── index.jsx
│   │   │   ├── Calculator/
│   │   │   │   └── index.jsx
│   │   │   ├── Notes/
│   │   │   │   └── index.jsx
│   │   │   ├── Browser/
│   │   │   │   └── index.jsx
│   │   │   └── Settings/
│   │   │       └── index.jsx
│   │   │
│   │   ├── input/
│   │   │   ├── GestureController.jsx   # MediaPipe integration
│   │   │   ├── VoiceController.jsx     # Web Speech API
│   │   │   └── EyeTracker.jsx          # WebGazer.js
│   │   │
│   │   ├── ai/
│   │   │   ├── AIOverlay.jsx           # Floating AI command palette
│   │   │   ├── AgentChat.jsx           # Chat UI with agent responses
│   │   │   └── useAgent.js             # Hook for agent communication
│   │   │
│   │   └── hooks/
│   │       ├── useWindowManager.js
│   │       ├── useGesture.js
│   │       ├── useVoice.js
│   │       └── useWebSocket.js
│   │
├── server/                          # Node.js + Express backend
│   ├── index.js                     # Entry point
│   ├── ws.js                        # WebSocket server
│   │
│   ├── routes/
│   │   ├── fs.js                    # Filesystem CRUD + DFS traversal
│   │   ├── process.js               # App process state
│   │   ├── agent.js                 # Agent dispatcher endpoint
│   │   ├── auth.js                  # Login / session
│   │   └── profile.js               # Accessibility profiles
│   │
│   ├── agents/
│   │   ├── planner.js               # Routing agent
│   │   ├── fileAgent.js
│   │   ├── systemAgent.js
│   │   ├── knowledgeAgent.js
│   │   └── assistantAgent.js
│   │
│   ├── lib/
│   │   ├── dfs.js                   # DFS traversal algorithm
│   │   ├── anthropic.js             # Anthropic client singleton
│   │   └── context.js               # OS context builder
│   │
│   ├── middleware/
│   │   ├── validate.js              # Zod validation
│   │   └── auth.js                  # Session check
│   │
│   └── prisma/
│       └── schema.prisma
│
├── demo-filesystem/                 # Simulated file tree for demo
│   ├── Desktop/
│   ├── Documents/
│   ├── Downloads/
│   ├── Pictures/
│   └── Projects/
│
├── .env.example
└── package.json                     # Root workspace (client + server)
```

---

## 5. Phase 1 — Desktop Shell & Window Manager

### 5.1 Zustand Window Store

**File:** `client/src/store/windowStore.js`

> **AI PROMPT:**
> ```
> Create a Zustand store called windowStore for a web-based OS desktop.
> The store must manage:
> - An array of open windows, each with shape:
>   { id: string (uuid), app: string, title: string, x: number, y: number,
>     width: number, height: number, zIndex: number, minimized: boolean,
>     maximized: boolean, focused: boolean, props: object }
> - A topZIndex counter starting at 100
> - Actions: openWindow(app, title, defaultSize, props), closeWindow(id),
>   focusWindow(id), minimizeWindow(id), maximizeWindow(id),
>   restoreWindow(id), updatePosition(id, x, y), updateSize(id, w, h),
>   closeAllWindows()
> - focusWindow must increment topZIndex and assign it to the targeted window,
>   and set focused:true only on the targeted window (false on all others)
> - openWindow must check if the app is already open (by app name) and focus
>   it instead of opening a duplicate, unless the app allows multiple instances
>   (Terminal and Notes allow multiple instances)
> - Export a helper selector: useWindowById(id) that returns a single window object
> Use TypeScript-style JSDoc comments. Use immer middleware for immutable updates.
> ```

### 5.2 Desktop Canvas

**File:** `client/src/desktop/Desktop.jsx`

> **AI PROMPT:**
> ```
> Create a React component called Desktop that serves as the root canvas for a web OS.
> Requirements:
> - Full-screen div (w-screen h-screen) with a wallpaper background image (configurable via osStore)
> - Renders all desktop icons (DesktopIcon) in a grid in the top-left
> - Renders all open windows from windowStore as WindowFrame components
> - On right-click anywhere on the desktop (not on a window), shows ContextMenu
>   with options: Change Wallpaper, New Folder, Open Terminal, Refresh
> - Handles click-away to close the context menu
> - Has a subtle animated gradient overlay on the wallpaper (CSS only, no JS)
> - Renders the Taskbar pinned at the bottom
> - Renders the AIOverlay component (floating, always on top)
> - Desktop icons: FileExplorer, Terminal, Calculator, Notes, Browser, Settings
>   Each icon has an emoji, name, double-click opens the app via windowStore.openWindow()
> Use Tailwind CSS. Accept no props — reads everything from Zustand stores.
> ```

### 5.3 Window Frame (Draggable + Resizable Chrome)

**File:** `client/src/desktop/WindowFrame.jsx`

> **AI PROMPT:**
> ```
> Create a React component WindowFrame using react-rnd that renders a single OS window.
> Props: { windowData } (shape defined in windowStore)
> Requirements:
> - Title bar: app icon (emoji), title text, three macOS-style traffic light buttons
>   (close = red, minimize = yellow, maximize = green) with hover tooltips
> - Clicking anywhere on the title bar (not on buttons) focuses the window
>   via windowStore.focusWindow(id)
> - Close button calls windowStore.closeWindow(id)
> - Minimize button calls windowStore.minimizeWindow(id) — window disappears from canvas
>   but stays in taskbar
> - Maximize button toggles between fullscreen and restored size/position
> - The window body renders the correct app component based on windowData.app string
>   using a switch/map lookup to lazy-loaded app components
> - Focused window has a slightly brighter title bar and a subtle box-shadow
> - Unfocused window title bar is muted (opacity-70)
> - Window has a minimum size of 300x200
> - Use Framer Motion for the open animation: scale from 0.8 to 1.0 with opacity
>   0 to 1 over 150ms, spring easing
> - Use Framer Motion exit animation: scale to 0.9, opacity 0, duration 100ms
> The component should NOT have scroll inside the title bar. Only the content area scrolls.
> Use Tailwind CSS with a dark glass-morphism style title bar: bg-white/10 backdrop-blur.
> ```

### 5.4 Taskbar

**File:** `client/src/desktop/Taskbar.jsx`

> **AI PROMPT:**
> ```
> Create a React Taskbar component pinned at the bottom of the screen.
> Requirements:
> - Fixed bottom bar, full width, height 48px
> - Background: semi-transparent dark (bg-gray-900/80 backdrop-blur-md)
> - Left section: Start/logo button (SavitaOS logo + name)
> - Center section: Pinned app icons (FileExplorer, Terminal, Calculator, Notes, Browser, Settings)
>   Each shows a dot indicator below if the app is currently open
>   Clicking opens the app or focuses it if already open
> - Right section: running app buttons (pill shape, shows app name, click to focus/unminimize)
> - Far right: system tray with clock (HH:MM format, updates every second),
>   battery icon (static 80%), wifi icon, volume icon
> - Hovering any icon shows a tooltip with the app name above the icon
> - Use Framer Motion for the tooltip: fade in with slight upward translate
> Read open windows from windowStore. Read OS profile from osStore (for accessibility sizing).
> Use Tailwind CSS only. No external UI libraries.
> ```

### 5.5 OS Zustand Store

**File:** `client/src/store/osStore.js`

> **AI PROMPT:**
> ```
> Create a Zustand store called osStore for global OS state.
> State shape:
> {
>   theme: 'dark' | 'light',
>   wallpaper: string (URL or gradient string),
>   fontSize: 'normal' | 'large' | 'xl',
>   contrast: 'normal' | 'high',
>   cursorSize: 'normal' | 'large',
>   profile: 'default' | 'elderly' | 'visually-impaired' | 'motor-impaired' | 'beginner',
>   soundEnabled: boolean,
>   gestureEnabled: boolean,
>   voiceEnabled: boolean,
>   eyeTrackingEnabled: boolean,
>   userName: string,
>   notifications: Array<{ id, message, type, timestamp }>
> }
> Actions:
> - setTheme, setWallpaper, setFontSize, setContrast, setCursorSize
> - applyProfile(profileName): applies a preset configuration object for each profile
>   (e.g. elderly profile sets fontSize:xl, contrast:high, cursorSize:large)
> - toggleGesture, toggleVoice, toggleEyeTracking
> - addNotification(message, type), dismissNotification(id)
> - Persist to localStorage using Zustand persist middleware
> Define the full profile presets as a constant object at the top of the file.
> ```

---

## 6. Phase 2 — Filesystem API (Backend)

### 6.1 DFS Traversal Algorithm

**File:** `server/lib/dfs.js`

> **AI PROMPT:**
> ```
> Implement a DFS (Depth-First Search) file system traversal algorithm in Node.js.
> This is the core algorithm of the SavitaOS paper — implement it exactly as described:
>
> Function: dfsTraverse(rootPath, options)
> Options: { maxDepth: number (default 4), showHidden: boolean (default false),
>            includeMetadata: boolean (default true) }
>
> Returns a tree structure:
> {
>   name: string,
>   path: string,
>   type: 'file' | 'directory',
>   size: number (bytes),
>   modified: ISO date string,
>   extension: string | null,
>   children: [] (only for directories, recursively filled)
> }
>
> Algorithm requirements:
> - Use RECURSIVE DFS (not iterative BFS — this is the paper's differentiator)
> - Start from the CURRENT WORKING DIRECTORY path provided, not necessarily root
> - Use fs.readdirSync with { withFileTypes: true }
> - Catch errors per-entry (permission denied etc.) and include { error: string } instead
>   of crashing the whole traversal
> - Track visited paths using a Set to avoid symlink cycles
> - The time complexity must be O(E·log N) due to the recursive DFS with sorted entries
>   (sort each directory's entries alphabetically before recursing — this is what gives log N)
>
> Also export:
> - flattenTree(tree): returns flat array of all nodes (for search)
> - searchTree(tree, query): returns matching nodes where name includes query (case-insensitive)
> - getStats(tree): returns { totalFiles, totalDirs, totalSize, deepestPath }
>
> Add JSDoc comments explaining the O(E·log N) complexity proof inline.
> ```

### 6.2 Filesystem Routes

**File:** `server/routes/fs.js`

> **AI PROMPT:**
> ```
> Create Express router for filesystem operations in a web OS backend.
> All routes are prefixed with /api/fs
> The root demo directory is process.env.DEMO_FS_ROOT (default: './demo-filesystem')
> IMPORTANT: All path operations must be sandboxed — use path.resolve and verify
> the resulting path starts with the DEMO_FS_ROOT. Reject any path traversal attempts.
>
> Routes:
>
> GET /tree?path=&depth=
>   Calls dfsTraverse(resolvedPath, { maxDepth: depth || 4 })
>   Returns the full tree JSON
>
> GET /list?path=
>   Returns direct children only (depth 1) of the given path
>   Includes file metadata
>
> GET /read?path=
>   Reads and returns file contents as text (only for .txt, .md, .json, .js, .py, .html, .css)
>   Returns { content, lines, size, encoding }
>   Reject binary files with 415 status
>
> POST /create
>   Body: { path, name, type: 'file'|'directory', content?: string }
>   Creates a file or directory
>   Validates with Zod schema
>
> DELETE /delete
>   Body: { path }
>   Deletes file or empty directory
>   Requires the path to be inside DEMO_FS_ROOT
>
> POST /rename
>   Body: { oldPath, newName }
>   Renames file/directory
>
> GET /search?query=&path=
>   Calls flattenTree + searchTree
>   Returns matching entries with their full paths
>
> GET /stats?path=
>   Returns getStats() for the given subtree
>
> Use Zod for all POST/DELETE body validation.
> Use try/catch on every route and return { error } with appropriate HTTP status.
> Export the router as default.
> ```

---

## 7. Phase 3 — Built-in Applications

### 7.1 File Explorer App

**File:** `client/src/apps/FileExplorer/index.jsx`

> **AI PROMPT:**
> ```
> Build a File Explorer React application component for a web OS.
> The component runs inside a WindowFrame, full width/height of its container.
> Do NOT add any outer window chrome — that's handled by WindowFrame.
>
> Layout: Three-panel layout
> - Left panel (200px): folder tree sidebar (TreeView component)
> - Top bar: breadcrumb navigation + search input + toolbar buttons
>   (New Folder, New File, Upload, View toggle grid/list, Sort)
> - Main panel: file/folder grid or list view (FileGrid component)
> - Bottom bar: item count, selected item info, current path
>
> Features:
> - Double-click folder: navigate into it (call GET /api/fs/list?path=)
> - Double-click text file: open in Notes app via windowStore.openWindow('Notes', ...)
>   passing file content as props
> - Single click: select item (highlight)
> - Ctrl+click / Shift+click: multi-select
> - Right-click context menu: Open, Rename, Delete, Copy Path, Properties
> - Breadcrumb: clicking any crumb navigates there
> - Search: debounced 300ms, calls GET /api/fs/search?query=&path=
> - Drag items between folders (HTML5 drag API, call /api/fs/rename on drop)
> - Show file icons based on extension (use lucide-react icons)
> - Sort by: Name, Size, Modified date (toggle asc/desc)
> - Loading skeleton while fetching
>
> Use Axios for all API calls. Use Zustand osStore for theme.
> Style: dark theme matching the OS, monospace font for file names.
> Handle errors with an inline error banner (not alert()).
> ```

### 7.2 Terminal App

**File:** `client/src/apps/Terminal/index.jsx`

> **AI PROMPT:**
> ```
> Build a Terminal emulator React component using xterm.js for a web OS demo.
> The terminal is a SIMULATED terminal — it does NOT run real shell commands.
> It must handle a custom set of commands and return simulated responses.
>
> Supported commands and their behavior:
> - ls [path]: calls GET /api/fs/list?path= and displays results in terminal format
> - cd [path]: changes the terminal's current directory (client-side state)
> - pwd: prints current directory
> - cat [file]: calls GET /api/fs/read?path= and displays content
> - mkdir [name]: calls POST /api/fs/create with type:'directory'
> - touch [name]: calls POST /api/fs/create with type:'file'
> - rm [name]: calls DELETE /api/fs/delete
> - clear: clears the terminal
> - help: lists all available commands with descriptions
> - ai [message]: sends message to the AI agent system and prints response
>   (calls POST /api/agent/chat)
> - whoami: prints the username from osStore
> - date: prints current date/time
> - echo [text]: prints text back
> - tree [path]: calls GET /api/fs/tree and pretty-prints the tree with ASCII art
>
> Styling: classic green-on-black terminal. Use xterm.js with FitAddon and WebLinksAddon.
> Show a welcome banner on mount with SavitaOS ASCII art.
> Show a prompt: username@savitaos:~/current-path$
> Support command history with up/down arrow keys.
> Support tab completion for filenames (fetch directory listing and match prefix).
> ```

### 7.3 Calculator App

**File:** `client/src/apps/Calculator/index.jsx`

> **AI PROMPT:**
> ```
> Build a Calculator React component for a web OS.
> It runs inside a WindowFrame — no outer chrome needed.
>
> Two modes (toggle button top-right):
> 1. Standard mode: basic arithmetic (+, -, *, /, %, ±, √)
> 2. Scientific mode: adds sin, cos, tan, log, ln, ^, (, ), π, e, factorial
>
> Features:
> - Full keyboard support: numbers, operators, Enter=equals, Escape=clear, Backspace=delete
> - Expression display: shows the full expression being built (e.g. "12 × (3 + 4)")
>   and the current result/input below in large font
> - History: last 10 calculations shown in a scrollable history panel on the right
> - Click history item to restore that calculation
> - Gesture shortcut indicator: shows "✌️ Peace Sign = Open Calculator" in a small badge
>
> The gesture badge is purely cosmetic — just a reminder that this app can be opened by gesture.
> Style: dark theme, rounded keys with subtle hover/active animations (Framer Motion scale).
> Display font should be monospace. Button colors: numbers=gray, operators=blue, equals=accent color.
> Handle division by zero and other errors gracefully — show "Error" then allow clearing.
> ```

### 7.4 Notes App

**File:** `client/src/apps/Notes/index.jsx`

> **AI PROMPT:**
> ```
> Build a Notes/Text Editor React component for a web OS.
> It runs inside a WindowFrame.
>
> Features:
> - Simple rich text editor using a contenteditable div OR plain textarea
>   (use plain textarea for simplicity — monospace font, syntax highlighting via highlight.js
>   if the file has a code extension like .js, .py, .html)
> - Top toolbar: New, Open (opens file picker calling /api/fs/list), Save (calls /api/fs
>   POST to write), Save As, font size selector, word wrap toggle
> - Title bar inside the app (below WindowFrame's title) shows filename + unsaved indicator (•)
> - Auto-save: debounced 2 seconds after last keystroke, saves to /api/fs/create
>   (overwrites existing file path if props.filePath provided)
> - Word count + line count in the bottom status bar
> - Find & Replace: Ctrl+F opens a floating bar
> - If props.content is passed (opened from FileExplorer), pre-fill the editor
> - If props.filePath is passed, show the filename in the title
>
> AI integration: "Ask AI about this text" button in the toolbar.
> Clicking sends the selected text (or full note) to the Knowledge Agent via /api/agent/chat
> and shows the response in a side panel.
>
> Style: dark theme, clean editor feel. Use Tailwind.
> ```

### 7.5 Settings App

**File:** `client/src/apps/Settings/index.jsx`

> **AI PROMPT:**
> ```
> Build a Settings React component for a web OS.
> Uses osStore (Zustand) for all state. No backend calls needed except for saving profile to DB.
>
> Settings categories in a left sidebar with icons (lucide-react):
>
> 1. Appearance
>    - Theme toggle: Dark / Light
>    - Wallpaper picker: grid of 6 preset gradient wallpapers + custom URL input
>    - Accent color picker: 8 preset colors
>    - Font size: Normal / Large / Extra Large (radio buttons)
>
> 2. Accessibility Profiles
>    - Four profile cards with descriptions:
>      * Default — Standard settings
>      * Elderly Mode — Large text, high contrast, large cursor, slow animations
>      * Visually Impaired — Screen reader hint, maximum contrast, largest text
>      * Motor Impaired — Dwell-click enabled, gesture mode on, keyboard-only mode
>      * Beginner Mode — Tooltips everywhere, simplified UI, step-by-step help
>    - Active profile shown with a checkmark
>    - "Apply" button calls osStore.applyProfile()
>
> 3. Input Methods
>    - Toggle cards for: Gesture Control, Voice Commands, Eye Tracking
>    - Each shows status (Active/Inactive), a brief description, and a toggle switch
>    - Gesture card shows the gesture mapping table (thumb up=open app, etc.)
>
> 4. About
>    - SavitaOS version, IEEE paper reference, tech stack list, team credits
>
> Use Tailwind. The layout should feel like macOS System Preferences — grid of panes.
> Changes apply immediately via osStore setters.
> ```

---

## 8. Phase 4 — Input Modalities

### 8.1 Gesture Controller

**File:** `client/src/input/GestureController.jsx`

> **AI PROMPT:**
> ```
> Build a React component GestureController that integrates MediaPipe Hands
> for gesture-based OS control. This component is always mounted but only
> activates when osStore.gestureEnabled is true.
>
> Implementation:
> - Load @mediapipe/hands via dynamic import
> - Access webcam with getUserMedia (request permission gracefully with a modal)
> - Run MediaPipe Hands on every animation frame using requestAnimationFrame loop
> - Draw hand skeleton on an overlay canvas (semi-transparent, bottom-right corner, 200x150px)
>   showing the user their hand in real-time when gesture mode is active
>
> Gesture recognition — classify these 5 gestures from landmark data:
>
> 1. THUMB_UP (all fingers closed, thumb pointing up)
>    → Action: Open the topmost/first pinned app (FileExplorer)
>    → Visual: Show toast "👍 Opening File Explorer"
>
> 2. THUMB_DOWN (all fingers closed, thumb pointing down)
>    → Action: Close the currently focused window (windowStore.closeWindow)
>    → Visual: Show toast "👎 Closing window"
>
> 3. PEACE_SIGN (index + middle fingers up, others closed)
>    → Action: Open Calculator (windowStore.openWindow('Calculator'))
>    → Visual: Show toast "✌️ Opening Calculator"
>
> 4. THREE_FINGERS (index + middle + ring fingers up)
>    → Action: Open File Explorer (windowStore.openWindow('FileExplorer'))
>    → Visual: Show toast "🤟 Opening File Explorer"
>
> 5. OPEN_PALM (all 5 fingers up/spread)
>    → Action: Open Browser (windowStore.openWindow('Browser'))
>    → Visual: Show toast "🖐 Opening Browser"
>
> Gesture detection rules:
> - Require the same gesture to be held for 800ms before triggering (debounce)
>   to prevent accidental triggers
> - After a gesture fires, enter a 2-second cooldown before accepting the next gesture
> - Show a circular progress indicator on the overlay while holding a gesture
>
> Landmark classification helper:
> - A finger is "up" if its tip landmark y-coordinate is above its MCP joint y-coordinate
>   (in normalized coordinates, lower y = higher on screen)
> - Use landmarks: THUMB_TIP=4, INDEX_TIP=8, MIDDLE_TIP=12, RING_TIP=16, PINKY_TIP=20
>   and their corresponding MCP joints: 2, 5, 9, 13, 17
>
> Show a small "Gesture Mode Active" indicator badge in the bottom-right corner of the
> desktop when enabled.
> ```

### 8.2 Voice Controller

**File:** `client/src/input/VoiceController.jsx`

> **AI PROMPT:**
> ```
> Build a React component VoiceController using the Web Speech API (SpeechRecognition).
> Only activates when osStore.voiceEnabled is true.
>
> Features:
> - Wake word detection: Listen continuously for the word "Savita" (case-insensitive)
>   After hearing "Savita", enter active listening mode for 5 seconds
> - In active listening mode: record the full utterance and send it to the AI agent
>   via POST /api/agent/chat with the current osState
> - Show a floating microphone indicator: gray when listening for wake word,
>   pulsing red when actively recording
> - Transcript display: show the last heard phrase as a toast at the top of the screen
>
> Direct command shortcuts (bypass AI, act immediately):
> - "open [appname]" → windowStore.openWindow(appname)
> - "close window" → close focused window
> - "calculator" → open Calculator
> - "terminal" → open Terminal
> - "file explorer" / "files" → open FileExplorer
>
> For all other phrases, send to AI agent system.
>
> Handle browser compatibility: show a warning if SpeechRecognition is not supported.
> Use continuous: true, interimResults: true for real-time transcript.
> Restart recognition automatically if it ends unexpectedly.
>
> Export a custom hook useVoice() that returns:
> { isListening, isActive, transcript, startVoice, stopVoice }
> ```

---

## 9. Phase 5 — Multi-Agent AI System

### 9.1 Anthropic Client Singleton

**File:** `server/lib/anthropic.js`

> **AI PROMPT:**
> ```
> Create a module that exports a configured Anthropic SDK client.
> The model name must come from process.env.MODEL_NAME — do NOT hardcode any model string.
> Export:
> - anthropic: the Anthropic client instance
> - MODEL: the resolved model name string (from env)
> - a helper function: callClaude(systemPrompt, userMessage, maxTokens=1000)
>   that calls anthropic.messages.create and returns the first text content block's text
> - a helper function: callClaudeJSON(systemPrompt, userMessage)
>   that calls callClaude, strips any markdown fences, and parses as JSON.
>   Throws a descriptive error if JSON parsing fails, including the raw response.
> ```

### 9.2 OS Context Builder

**File:** `server/lib/context.js`

> **AI PROMPT:**
> ```
> Create a module that builds the shared OS context object passed to every agent call.
>
> Function: buildContext(req)
> Takes an Express request object and returns a plain object:
> {
>   openWindows: string[],        // names of currently open app windows
>   focusedWindow: string|null,   // app name of the focused window
>   currentDirectory: string,     // last known file explorer path (from session)
>   userProfile: string,          // accessibility profile name
>   theme: string,                // 'dark' or 'light'
>   gestureEnabled: boolean,
>   voiceEnabled: boolean,
>   sessionHistory: Array<{role, content}>,  // last 5 user+assistant turns
>   timestamp: string,            // ISO timestamp
>   userName: string
> }
>
> The frontend sends this as req.body.osState (a JSON object).
> Validate and sanitize each field — use defaults if fields are missing.
> The sessionHistory must be capped at 5 turns (10 messages).
>
> Export: buildContext(req), updateSessionHistory(req, role, content)
> ```

### 9.3 Planner Agent

**File:** `server/agents/planner.js`

> **AI PROMPT:**
> ```
> Create the Planner Agent for SavitaOS multi-agent system.
>
> Function: plannerAgent(userMessage, osContext)
>
> This agent's ONLY job is to classify the user's intent and route to the correct sub-agent.
> It must NEVER answer the user directly or perform any action itself.
>
> System prompt for this agent (use exactly this structure):
> ---
> You are the Planner Agent for SavitaOS, a web-based operating system.
> Your only job is to analyze the user's message and the current OS state,
> then output a JSON routing decision. You never answer the user directly.
>
> Current OS context:
> {osContextJSON}
>
> Available agents:
> - "file": handles file/folder search, read, create, delete, list operations
> - "system": handles opening/closing apps, switching windows, changing OS settings,
>   applying accessibility profiles, toggling input modes
> - "knowledge": handles questions about SavitaOS features, gestures, general Q&A,
>   explaining file contents, usage help
> - "assistant": handles everything else — conversational replies, unclear intent,
>   multi-step tasks, errors
>
> Output ONLY valid JSON, no explanation, no markdown:
> {
>   "agent": "file|system|knowledge|assistant",
>   "confidence": 0.0-1.0,
>   "task": "one sentence describing what to do",
>   "params": {},
>   "requiresConfirmation": false
> }
> ---
>
> The params object should pre-extract relevant details:
> - For "file": { operation: "search|read|create|delete|list", path?: string, query?: string, name?: string }
> - For "system": { action: "openApp|closeApp|applyProfile|toggleInput|changeSetting",
>                   target?: string, value?: string }
> - For "knowledge": { topic: string, context?: string }
>
> Return the parsed JSON object. Throw an error if the LLM returns invalid JSON.
> ```

### 9.4 File Agent

**File:** `server/agents/fileAgent.js`

> **AI PROMPT:**
> ```
> Create the File Agent for SavitaOS.
>
> Function: fileAgent(task, params, osContext)
> This agent performs filesystem operations and returns results.
>
> System prompt:
> ---
> You are the File Agent for SavitaOS. You have access to the OS filesystem API.
> You receive a task and params from the Planner Agent.
> Based on the task, you will call the appropriate filesystem function and
> return a response to show the user.
>
> Available operations you can use (call via internal API, not web):
> - list(path): list files in a directory
> - search(query, path): search for files
> - read(path): read file contents
> - create(path, name, type, content): create file/folder
> - delete(path): delete file/folder
>
> Current OS context: {osContextJSON}
> Task: {task}
> Params: {paramsJSON}
>
> Call the operation, then respond to the user in plain, friendly language.
> If it's a search result, format as a bullet list.
> If it's a file read, summarize the content AND show the first 10 lines.
> Output JSON: { message: string, data: any, action: null }
> ---
>
> Import and call the filesystem functions directly (not via HTTP, use lib/dfs.js and fs module).
> Map params.operation to the correct dfs.js / fs function call.
> Pass file operation results to a second Claude call that formats a friendly response.
> Return: { message: string, data: any, action: null }
> ```

### 9.5 System Agent

**File:** `server/agents/systemAgent.js`

> **AI PROMPT:**
> ```
> Create the System Agent for SavitaOS.
>
> Function: systemAgent(task, params, osContext)
>
> This agent controls the OS UI. It does NOT actually move windows (the frontend does).
> Instead it returns a structured ACTION OBJECT that the frontend React code executes.
>
> System prompt:
> ---
> You are the System Agent for SavitaOS. You receive a task from the Planner Agent
> and must output a JSON action for the frontend OS to execute, plus a user-facing message.
>
> Available actions:
> - openApp: open a named application (target = app name)
>   Valid app names: FileExplorer, Terminal, Calculator, Notes, Browser, Settings
> - closeApp: close the focused or named window
> - switchWindow: bring a named window to focus
> - applyProfile: apply an accessibility profile
>   Valid profiles: default, elderly, visually-impaired, motor-impaired, beginner
> - changeSetting: change an OS setting
>   Valid settings: theme (dark/light), gestureEnabled, voiceEnabled, fontSize
> - minimizeWindow: minimize focused window
> - maximizeWindow: maximize focused window
>
> Current OS context: {osContextJSON}
> Task: {task}
> Params: {paramsJSON}
>
> Output ONLY JSON:
> {
>   "action": "openApp|closeApp|switchWindow|applyProfile|changeSetting|minimizeWindow|maximizeWindow",
>   "target": "string",
>   "value": "string|null",
>   "message": "Friendly confirmation message for the user, e.g. Opening Calculator for you!"
> }
> ---
>
> Return the parsed action object. The frontend will execute it.
> ```

### 9.6 Knowledge Agent

**File:** `server/agents/knowledgeAgent.js`

> **AI PROMPT:**
> ```
> Create the Knowledge Agent for SavitaOS.
>
> Function: knowledgeAgent(task, params, osContext)
>
> This agent answers questions about SavitaOS and general knowledge.
> It is a pure conversational agent — it returns a text message only, no actions.
>
> System prompt:
> ---
> You are the Knowledge Agent for SavitaOS, a web-based OS with gesture, voice, and eye tracking.
>
> You know everything about SavitaOS:
> - It runs in any browser with zero installation
> - 4 input modes: Gesture (MediaPipe YOLO hand detection), Voice (Web Speech API),
>   Eye tracking (WebGazer.js), Keyboard shortcuts
> - Gesture mappings: Thumb Up = Open App, Thumb Down = Close App,
>   Peace Sign = Calculator, Three Fingers = File Explorer, Open Palm = Browser
> - DFS traversal algorithm: O(E·log N) vs traditional BFS O(E+V)
> - Accessibility profiles: Elderly, Visually Impaired, Motor Impaired, Beginner, Default
> - Tech stack: React, Node.js, PostgreSQL, Prisma, MediaPipe, Web Speech API
> - Based on FlexOS research paper with 18 references
>
> Current OS context: {osContextJSON}
> User's question topic: {topic}
>
> Answer helpfully and concisely. If explaining gestures, list them clearly.
> If asked about a feature not in SavitaOS, say so honestly.
> Output JSON: { message: string, data: null, action: null }
> ---
>
> Return: { message: string, data: null, action: null }
> ```

### 9.7 Agent Router (Express Route)

**File:** `server/routes/agent.js`

> **AI PROMPT:**
> ```
> Create an Express router for the multi-agent AI system endpoint.
> Route: POST /api/agent/chat
>
> Request body (validated with Zod):
> {
>   message: string (required, max 500 chars),
>   osState: object (required — current OS state from frontend)
> }
>
> Handler logic:
> 1. Build OS context using buildContext(req) from lib/context.js
> 2. Call plannerAgent(message, context) — get routing decision
> 3. Based on plan.agent, call the appropriate sub-agent:
>    - 'file'      → fileAgent(plan.task, plan.params, context)
>    - 'system'    → systemAgent(plan.task, plan.params, context)
>    - 'knowledge' → knowledgeAgent(plan.task, plan.params, context)
>    - 'assistant' → assistantAgent(plan.task, plan.params, context)
> 4. Update session history with user message and agent response
> 5. Return response:
>    {
>      message: string,       // text to show user in AI overlay
>      action: object|null,   // frontend executes this if present
>      data: any|null,        // additional data (search results, file content, etc.)
>      agent: string,         // which agent handled it (for debug display)
>      plan: object           // planner decision (for debug display)
>    }
>
> Error handling:
> - If plannerAgent throws: return { message: "I had trouble understanding that. Try rephrasing?", ... }
> - If sub-agent throws: return { message: "Something went wrong on my end. Please try again.", ... }
> - Log all errors with the full chain: message → plan → error
> - Use a 30-second timeout on all agent calls
>
> Rate limit: max 20 requests per minute per session using express-rate-limit.
> ```

### 9.8 AI Overlay (Frontend)

**File:** `client/src/ai/AIOverlay.jsx`

> **AI PROMPT:**
> ```
> Build a floating AI command palette/chat component for the web OS.
> This is always rendered on the desktop, above all windows (highest z-index).
>
> States:
> 1. MINIMIZED: A small floating button in the bottom-right corner
>    (glowing orb animation, shows agent status indicator dot)
>    Click to expand to CHAT state
>
> 2. CHAT: A floating panel (380px wide, 500px tall) above the button
>    Layout from top to bottom:
>    - Header: "SavitaOS AI" + which agent is currently active (colored badge)
>      + minimize button
>    - Messages area (scrollable): chat history showing user messages (right-aligned)
>      and agent responses (left-aligned, with agent name badge)
>    - Typing indicator: animated dots when waiting for agent response
>    - Input area: text input + send button + voice button (mic icon)
>
> Behavior:
> - On send: call POST /api/agent/chat with message + osState (from osStore + windowStore)
> - On receiving response: append to chat history
> - If response.action is present: execute the action by calling windowStore actions
>   or osStore setters based on action.action value:
>   * openApp → windowStore.openWindow(action.target)
>   * closeApp → windowStore.closeWindow(focusedWindowId)
>   * applyProfile → osStore.applyProfile(action.target)
>   * changeSetting → call the appropriate osStore setter
> - Show which agent handled the request with a colored badge:
>   file=blue, system=orange, knowledge=purple, assistant=gray
> - Voice button: calls the VoiceController's startListening and puts transcript in input
>
> Animation: the panel opens with a spring animation from the button's position.
> Style: glassmorphism — bg-gray-900/90 backdrop-blur, border border-white/10.
> Mobile-friendly: on narrow screens, the panel goes full-width bottom sheet.
> ```

---

## 10. Phase 6 — Accessibility & Profiles

### 10.1 Accessibility Profile System

**File:** `server/routes/profile.js`

> **AI PROMPT:**
> ```
> Create Express routes for accessibility profile management.
> Routes prefixed with /api/profile
>
> GET /api/profile
>   Returns the current user's saved profile from DB (Prisma UserProfile model)
>   If no profile exists, returns the 'default' preset
>
> POST /api/profile
>   Body: { profileName: string, customSettings: object }
>   Saves profile to DB
>   Returns saved profile
>
> GET /api/profile/presets
>   Returns all preset profiles as JSON:
>   {
>     default:          { fontSize:'normal', contrast:'normal', cursorSize:'normal', ... },
>     elderly:          { fontSize:'xl', contrast:'high', cursorSize:'large',
>                         animationsReduced:true, simplifiedUI:true },
>     visually-impaired:{ fontSize:'xl', contrast:'high', screenReaderHints:true,
>                         highContrast:true, largeTargets:true },
>     motor-impaired:   { gestureEnabled:true, dwellClick:true, keyboardOnly:false,
>                         largeCursor:true, stickyKeys:true },
>     beginner:         { tooltipsEnabled:true, simplifiedUI:true, onboardingEnabled:true,
>                         contextualHelp:true }
>   }
>
> Use Prisma for DB operations. Validate with Zod.
> ```

### 10.2 CSS Variable Injection for Profiles

**File:** `client/src/hooks/useAccessibility.js`

> **AI PROMPT:**
> ```
> Create a custom React hook useAccessibility() that applies the active
> accessibility profile from osStore to the DOM using CSS variables.
>
> The hook must watch osStore.profile and osStore.fontSize and on change,
> inject CSS variables into document.documentElement.style:
>
> For fontSize:
> - 'normal': --os-font-size: 14px, --os-heading-size: 18px, --os-icon-size: 16px
> - 'large':  --os-font-size: 18px, --os-heading-size: 22px, --os-icon-size: 20px
> - 'xl':     --os-font-size: 22px, --os-heading-size: 28px, --os-icon-size: 24px
>
> For contrast:
> - 'normal': no extra override
> - 'high': --os-bg: #000000, --os-text: #FFFFFF, --os-border: #FFFFFF,
>            --os-accent: #FFFF00
>
> For cursorSize:
> - 'normal': document.body.style.cursor = 'default'
> - 'large': inject a <style> tag with: * { cursor: url(large-cursor.svg), auto !important; }
>
> For animationsReduced:
> - inject: * { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
>
> Also export applyProfileCSS(profileName) that does all of the above at once.
> Call this hook once in App.jsx so it's always active.
> ```

---

## 11. Phase 7 — WebSocket Live Events

**File:** `server/ws.js`

> **AI PROMPT:**
> ```
> Create a WebSocket server module for SavitaOS real-time events.
> Uses the 'ws' npm library. Attaches to the existing Express HTTP server.
>
> Event types the server BROADCASTS to all clients:
> - { type: 'FS_CHANGE', path: string, changeType: 'add'|'remove'|'modify' }
>   (use chokidar to watch the DEMO_FS_ROOT directory and emit these)
> - { type: 'NOTIFICATION', message: string, level: 'info'|'warn'|'error' }
> - { type: 'AGENT_STATUS', agent: string, status: 'thinking'|'done'|'error' }
>   (the agent routes emit this before/after agent calls)
>
> Export:
> - initWS(httpServer): attaches the WebSocket server to the HTTP server
> - broadcast(eventObject): sends a JSON-stringified event to all connected clients
> - sendToSession(sessionId, eventObject): sends to a specific session (if identifiable)
>
> Keep a Set of active connections. Remove on 'close' event.
> Add a heartbeat ping every 30 seconds to detect dead connections.
> ```

**File:** `client/src/hooks/useWebSocket.js`

> **AI PROMPT:**
> ```
> Create a custom React hook useWebSocket() that connects to the backend WebSocket server.
>
> Returns: { connected, lastMessage, sendMessage }
>
> Behavior:
> - Connect to ws://localhost:3001 (or VITE_WS_URL env var) on mount
> - Auto-reconnect with exponential backoff (500ms, 1s, 2s, 4s, max 10s) on disconnect
> - On message receive:
>   * FS_CHANGE events: emit a custom DOM event 'fs:change' so FileExplorer can refresh
>   * NOTIFICATION events: call osStore.addNotification(message, level)
>   * AGENT_STATUS events: update agentStore status
> - Expose sendMessage(object) that JSON.stringifies and sends
> - Expose connected boolean (true when WS is open)
> - Clean up on unmount: close the connection
>
> Use useRef to hold the WebSocket instance so it doesn't trigger re-renders.
> ```

---

## 12. Database Schema

**File:** `server/prisma/schema.prisma`

> **AI PROMPT:**
> ```
> Write a Prisma schema for SavitaOS.
> Use SQLite as the default datasource (for demo/development).
> Include a DATABASE_URL env var reference.
>
> Models:
>
> UserProfile
>   - id            String   @id @default(uuid())
>   - userName      String   @unique
>   - profileName   String   @default("default")
>   - fontSize      String   @default("normal")
>   - contrast      String   @default("normal")
>   - cursorSize    String   @default("normal")
>   - theme         String   @default("dark")
>   - gestureEnabled Boolean @default(false)
>   - voiceEnabled   Boolean @default(false)
>   - customSettings Json?
>   - createdAt     DateTime @default(now())
>   - updatedAt     DateTime @updatedAt
>
> AgentSession
>   - id         String   @id @default(uuid())
>   - sessionId  String   @unique
>   - history    Json     @default("[]")
>   - createdAt  DateTime @default(now())
>   - updatedAt  DateTime @updatedAt
>
> FileActivity
>   - id         String   @id @default(uuid())
>   - path       String
>   - action     String   (create|delete|read|rename)
>   - userName   String
>   - timestamp  DateTime @default(now())
>
> Include the generator block for prisma-client-js.
> ```

---

## 13. Environment & Configuration

**File:** `.env.example`

```env
# Server
PORT=3001
NODE_ENV=development

# AI Model — set to any Claude model you want to use
MODEL_NAME=claude-sonnet-4-20250514

# Anthropic
ANTHROPIC_API_KEY=your_key_here

# Database
DATABASE_URL=file:./savitaos.db

# Filesystem
DEMO_FS_ROOT=./demo-filesystem

# Frontend (Vite)
VITE_API_URL=http://localhost:3001
VITE_WS_URL=ws://localhost:3001

# Session
SESSION_SECRET=savitaos_demo_secret_change_me
```

**File:** `server/index.js`

> **AI PROMPT:**
> ```
> Create the Express server entry point for SavitaOS.
> Requirements:
> - Load dotenv at the very top
> - Set up Express with JSON body parser, CORS (allow localhost:5173 with credentials),
>   and express-session middleware
> - Mount routes: /api/fs, /api/agent, /api/profile, /api/auth
> - Create the HTTP server with http.createServer(app)
> - Call initWS(httpServer) from ws.js
> - Connect Prisma client on startup
> - Log: "SavitaOS backend running on port PORT" on start
> - Graceful shutdown: on SIGTERM, close Prisma and WS connections
> ```

---

## 14. Key Algorithms

### DFS Time Complexity Proof (in-code comment)

Include this comment block at the top of `server/lib/dfs.js`:

```js
/**
 * SavitaOS DFS Traversal Algorithm
 * Time Complexity: O(E · log N)
 *
 * Proof:
 * Let G = (V, E) be the filesystem graph where V = files/dirs, E = parent→child edges.
 * Define T(u) = steps to traverse subtree of depth u.
 *
 * At each level, we sort entries: O(k log k) where k = entries at that level.
 * Summing over all levels using harmonic series:
 *   T(u) ≤ T(0) + E · Σ(d(i)/i) for i=1 to u
 *   Σ(d(i)/i) = O(log N)  [harmonic series convergence]
 * ∴ T(u) = O(E · log N)
 *
 * vs Traditional BFS: O(E + V) — starts at root, visits all nodes breadth-first
 * SavitaOS DFS: starts at CURRENT directory, sorts before recursing → O(E · log N)
 */
```

---

## 15. UI/UX Design Tokens

Apply these CSS variables globally in `client/src/index.css`:

```css
:root {
  /* OS Colors */
  --os-bg-primary:    #0a0a0f;
  --os-bg-secondary:  #13131a;
  --os-bg-tertiary:   #1c1c27;
  --os-bg-glass:      rgba(255,255,255,0.06);
  --os-border:        rgba(255,255,255,0.08);
  --os-text-primary:  #f0f0f5;
  --os-text-secondary:#9090a0;
  --os-accent:        #6366f1;   /* indigo */
  --os-accent-glow:   rgba(99, 102, 241, 0.3);
  --os-danger:        #ef4444;
  --os-warning:       #f59e0b;
  --os-success:       #10b981;

  /* Dynamic — overridden by accessibility profiles */
  --os-font-size:     14px;
  --os-heading-size:  18px;
  --os-icon-size:     16px;
  --os-radius:        8px;
  --os-taskbar-h:     48px;
}

/* Window title bar gradient — dark glass */
.window-titlebar {
  background: linear-gradient(
    to bottom,
    rgba(255,255,255,0.10),
    rgba(255,255,255,0.05)
  );
  backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--os-border);
}
```

---

## Build Order Summary

Build in this exact sequence to avoid dependency issues:

```
1. server/lib/dfs.js              ← No dependencies
2. server/prisma/schema.prisma    ← Run: npx prisma migrate dev
3. server/lib/anthropic.js        ← Needs MODEL_NAME env
4. server/lib/context.js          ← No dependencies
5. server/agents/planner.js       ← Needs anthropic.js
6. server/agents/fileAgent.js     ← Needs dfs.js + anthropic.js
7. server/agents/systemAgent.js   ← Needs anthropic.js
8. server/agents/knowledgeAgent.js← Needs anthropic.js
9. server/routes/fs.js            ← Needs dfs.js
10. server/routes/agent.js        ← Needs all agents
11. server/ws.js                  ← Standalone
12. server/index.js               ← Needs all routes + ws
13. client/src/store/osStore.js   ← No dependencies
14. client/src/store/windowStore.js← No dependencies
15. client/src/desktop/Desktop.jsx ← Needs stores
16. client/src/desktop/WindowFrame.jsx ← Needs windowStore
17. client/src/desktop/Taskbar.jsx ← Needs windowStore
18. client/src/apps/*             ← Each needs windowStore + API
19. client/src/input/GestureController.jsx ← Needs osStore
20. client/src/input/VoiceController.jsx   ← Needs osStore
21. client/src/ai/AIOverlay.jsx            ← Needs all stores + /api/agent
```

---

*SavitaOS © 2025 — Based on FlexOS IEEE Research Paper · 18 References*
*Multi-agent system designed for demo purposes — production deployment requires additional security hardening.*
