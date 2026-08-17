# SpiritOS - Universal Operating System for Everyone

<p align="center">
  <img src="https://img.shields.io/badge/Version-1.0.4-blue.svg" alt="Version">
  <img src="https://img.shields.io/badge/License-Apache--2.0-green.svg" alt="License">
  <img src="https://img.shields.io/badge/Platform-Web-brightgreen.svg" alt="Platform">
  <img src="https://img.shields.io/badge/AI-YOLOv8-orange.svg" alt="AI">
</p>

<p align="center">
  <strong>A web-based operating system that bridges the digital divide through accessible, gesture-driven computing.</strong>
</p>

---

## 🌟 Overview

SpiritOS is a research-inspired web-based operating system designed to be universally accessible. Unlike traditional operating systems that require installation and technical expertise, SpiritOS runs directly in any modern browser with zero installation.

### Key Features

- **🤖 YOLO + MediaPipe Gesture Control** - Real-time hand gesture recognition using YOLOv8s ONNX + MediaPipe Tasks Vision
- **🗣️ Voice Commands** - Natural language voice control (no wake word — always listening)
- **👁️ Eye Tracking** - Iris gaze tracking via MediaPipe FaceLandmarker with 9-point regression calibration
- **♿ Universal Accessibility** - 5 preset accessibility profiles + Alzheimer support (Phase 0-5)
- **🧠 Multi-Agent AI** - Parallel AI agents (Planner → System/File/Knowledge/Assistant) with priority merge
- **📁 Real Filesystem** - Operates on actual Windows filesystem via DFS traversal
- **⚡ Fast Performance** - DFS traversal with O(E·log N) complexity + 5s tree cache
- **✋ Sign Language Detection** - ASL-style hand sign recognition via TF.js model

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER INTERFACE                          │
├─────────────────────────────────────────────────────────────────┤
│  Desktop Shell  │  Window Manager  │  Taskbar  │  AI Overlay    │
│  - Desktop.jsx  │  - WindowFrame  │  - Taskbar│  - AIOverlay   │
│  - ContextMenu  │  - React-RND     │           │  - AgentChat   │
└─────────────────────────────────────────────────────────────────┘
                                  │
                    ┌─────────────┴─────────────┐
                    │     INPUT MODALITIES      │
    ┌───────────────┼───────────┬───────────────┼───────────────┐
    │               │           │               │               │
    ▼               ▼           ▼               ▼               ▼
┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐
│ Gesture │   │  Voice  │   │   Eye   │   │  Sign   │   │ Keyboard│
│MediaPipe│   │ Web     │   │MediaPipe│   │Language │
│  Hands  │   │ Speech  │   │FaceLand-│   │ TF.js   │
│ + YOLOv8│   │         │   │ marker  │   │         │
└─────────┘   └─────────┘   └─────────┘   └─────────┘   └─────────┘
                    │           │               │
                    └───────────┴───────────────┘
                                  │
                    ┌─────────────┴─────────────┐
                    │      ZUSTAND STATE       │
                    │  - osStore (theme, prof) │
                    │  - windowStore (windows) │
                    │  - agentStore (messages) │
                    └──────────────────────────┘
                                  │
                    ┌─────────────┴─────────────┐
                    │      BACKEND (Node.js)   │
    ┌───────────────┼───────────┬───────────────┼───────────────┐
    │               │           │               │               │
    ▼               ▼           ▼               ▼               ▼
┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐
│ Express │   │ WebSocket│   │  Prisma │   │ Multi-  │   │  DFS    │
│ Server  │   │  Server │   │   DB    │   │  Agent  │   │Search   │
└─────────┘   └─────────┘   └─────────┘   └─────────┘   └─────────┘
```

---

## 🛠️ Tech Stack

### Frontend
| Technology | Version | Purpose |
|------------|---------|---------|
| React | 18.2.0 | UI Framework |
| Vite | 5.2.8 | Build Tool |
| Tailwind CSS | 3.4.3 | Styling |
| Zustand | 4.5.2 | State Management |
| Framer Motion | 11.0.8 | Animations |
| React-RND | 10.4.9 | Window Drag/Resize |
| Lucide React | 0.363.0 | Icons |

### AI & ML
| Technology | Version | Purpose |
|------------|---------|---------|
| ONNX Runtime Web | 1.26.0 | YOLOv8s Inference |
| @mediapipe/tasks-vision | 0.10.35 | FaceLandmarker + GestureRecognizer |
| @mediapipe/hands | Latest | Hand landmark detection (21 keypoints) |
| face-api.js | 0.22.2 | Face recognition for Alzheimer support |
| Web Speech API | - | Voice Recognition |
| TensorFlow.js | 4.22.0 | Sign language model inference |

### Backend
| Technology | Version | Purpose |
|------------|---------|---------|
| Node.js | ≥20.0.0 | Runtime |
| Express | 4.19.2 | Web Server |
| Prisma | 5.12.1 | ORM |
| SQLite | - | Database |
| WebSocket (ws) | 8.17.0 | Real-time |
| Chokidar | 3.6.0 | File Watching |
| Zod | 3.22.4 | Validation |
| Express-Rate-Limit | 7.2.0 | Rate Limiting |

---

## 📋 Features

### 1. Gesture Control (MediaPipe Hands + YOLOv8s)

Dual-mode gesture detection — primary MediaPipe Tasks Vision with fallback to landmark classifier:

| Gesture | Hand Shape | Action |
|---------|------------|--------|
| 👍 Thumb Up | Thumb up, fist | Open File Explorer |
| 👎 Thumb Down | Closed fist | Close Window |
| ✌️ Peace Sign | Index + Middle | Open Calculator |
| 🤟 Three Fingers | Index + Middle + Ring | Open Files |
| 🖐️ Open Palm | All fingers open | Open Notes |
| 👆 Point | Index extended | Move cursor |
| 👌 Pinch | Thumb-Index touch | Left click |
| ✊ Fist | All fingers closed | Right click |

**Technical Details:**
- Primary: `gesture_recognizer.task` via MediaPipe Tasks Vision (GPU delegate)
- Fallback: Landmark-based classifier via `@mediapipe/hands` (21 keypoints)
- YOLOv8s ONNX: Object detection running every 500ms on video stream
- Preprocessing: 640×640 input, float32 normalization, NMS postprocessing
- Cooldown: 2s between gestures, 800ms hold time required for action execution

### 2. Eye Tracking (MediaPipe FaceLandmarker)

Iris-based gaze tracking with linear regression calibration:

- **Model**: MediaPipe FaceLandmarker (`face_landmarker.task` from Google Storage)
- **Iris landmarks**: 468 (left), 473 (right) from 468-point face mesh
- **Calibration**: 9-point grid click-while-looking → least-squares regression
- **Smoothing**: EMA (α=0.15) for jitter reduction
- **Dwell click**: Single click at 1.5s, double-click at 2× within 400ms
- **FPS cap**: ~30fps detection limit

### 3. Sign Language Detection (TF.js)

8 ASL-style hand sign recognition:
- Model: Custom TF.js model at `/sign_model/model.json`
- Input: 21 hand landmarks (63 normalized features)
- Labels: Defined in `signLanguage/signConfig.js`
- Dwell time: Configurable (default 1s) before sign confirmation

### 4. Voice Control

No wake word required — continuous listening when enabled:
- **Implementation**: Web Speech API (SpeechRecognition)
- **Direct commands**: 30+ pre-defined voice commands
- **AI routing**: Non-matched commands sent to multi-agent system
- **Commands**: "Open File Explorer", "Close Window", "Minimize", "Maximize", etc.

### 5. Accessibility Profiles

| Profile | Font | Contrast | Voice | Gestures | Eye | TTS | Dwell |
|---------|------|----------|-------|----------|-----|-----|-------|
| Default | Normal | Normal | Off | On | Off | Off | Off |
| Elderly | XL | High | On | On | Off | On | Off |
| Visually Impaired | XL | High | On | On | Off | On | On |
| Motor Impaired | Large | Normal | On | On | On | On | On |
| Beginner | Normal | Normal | On | On | Off | On | Off |

### 6. Alzheimer Support (Phase 0-5)

| Phase | Trigger | Feature |
|-------|---------|---------|
| 0 | - | Feature disabled |
| 1-2 | - | Known person reminder every 30 min via TTS |
| 3-4 | Window focus | Face recognition scan trigger |
| 5 | Continuous | Unknown face → voice prompt to add to Known Book |

### 7. Multi-Agent AI System

```
User Input
    │
    ▼
┌─────────────┐
│   Planner   │  → Determines agent: system/file/knowledge/assistant
│   Agent     │
└─────────────┘
    │
    ▼
┌─────────────────────────────────────────────┐
│    Parallel Agent Execution (10s timeout) │
│  ┌──────────┐ ┌──────────┐ ┌────────┐ ┌───┐│
│  │  System  │ │   File   │ │Knowl-  │ │Ass-││
│  │  Agent   │ │  Agent   │ │edge    │ │ist ││
│  └──────────┘ └──────────┘ └────────┘ └───┘│
└─────────────────────────────────────────────┘
    │
    ▼
┌──────────────────────────────────┐
│ Priority Merge: system > file >  │
│ knowledge > assistant            │
└──────────────────────────────────┘
    │
    ▼
   Response + Action + Duration
```

### 8. DFS Filesystem Algorithm

Optimized Depth-First Search with O(E·log N) complexity:

- **Sorting**: Entries sorted alphabetically at each level
- **Starting Point**: Current directory (not root)
- **Cache**: 5-second TTL tree cache for search
- **Implementation**: Recursive traversal with cycle detection
- **Security**: Path traversal validation, FS_ROOT boundary checks

---

## 📁 Project Structure

```
Spirit--OS/
├── client/                    # React Frontend (Vite)
│   ├── public/
│   │   └── models/           # ML models
│   │       ├── yolo/yolov8s.onnx       # YOLOv8s object detector
│   │       ├── gesture_recognizer.task # MediaPipe gesture model
│   │       └── face_*/                 # face-api.js models
│   ├── src/
│   │   ├── apps/              # Desktop Applications
│   │   │   ├── Calculator/    # Calculator app
│   │   │   ├── FileExplorer/  # File manager (tree + grid)
│   │   │   ├── Terminal/      # Smart terminal (English → CMD)
│   │   │   ├── Notes/         # Note-taking app
│   │   │   ├── Browser/       # Web browser
│   │   │   ├── Translator/    # Translation app
│   │   │   ├── Mail/          # Email app
│   │   │   ├── KnownBook/     # Alzheimer known faces
│   │   │   └── Settings/      # OS settings + profiles
│   │   ├── config/
│   │   │   ├── appConfig.js   # App constants + ICON_STYLES
│   │   │   ├── gestureConfig.js # Gesture thresholds + calibration
│   │   │   └── theme.js       # Design tokens
│   │   ├── desktop/           # Desktop Shell
│   │   │   ├── Desktop.jsx    # Main desktop + clock
│   │   │   ├── Taskbar.jsx    # Bottom dock
│   │   │   ├── WindowFrame.jsx# Draggable window container
│   │   │   ├── DesktopIcon.jsx# Desktop icon grid
│   │   │   ├── ContextMenu.jsx# Right-click menu
│   │   │   ├── FeatureBar.jsx # Input toggles
│   │   │   ├── QuickSettings.jsx # System tray
│   │   │   ├── AppLauncher.jsx # App search launcher
│   │   │   └── BootScreen.jsx  # Startup animation
│   │   ├── store/             # Zustand Stores
│   │   │   ├── osStore.js     # Theme, profile, toggles, notifications
│   │   │   ├── windowStore.js # Window CRUD, focus, resize (immer)
│   │   │   └── agentStore.js  # AI chat history
│   │   ├── input/             # Input Controllers
│   │   │   ├── GestureController.jsx  # MediaPipe Hands + FaceMesh
│   │   │   ├── EyeTracker.jsx          # MediaPipe FaceLandmarker
│   │   │   ├── VoiceController.jsx      # Web Speech API
│   │   │   ├── SignLanguageController.jsx # TF.js sign detection
│   │   │   ├── FaceRecognition.jsx     # face-api.js Alzheimer
│   │   │   └── sharedCamera.js         # Ref-counted getUserMedia
│   │   ├── hooks/             # React Hooks
│   │   │   ├── useGestureRecognizer.js # gesture_recognizer.task
│   │   │   ├── useYoloDetector.js      # yolov8s.onnx
│   │   │   ├── useVoice.js    # Wake word + command processing
│   │   │   ├── useWebSocket.js # Reconnecting WS client
│   │   │   ├── useTTS.js      # Speech Synthesis
│   │   │   ├── useGesture.js  # Gesture hook (legacy)
│   │   │   ├── useAlzheimerSupport.js # Phase-based reminders
│   │   │   ├── usePathGuidance.js
│   │   │   ├── useSystemInfo.js # Battery, online status
│   │   │   ├── useWindowManager.js
│   │   │   └── useAccessibility.js
│   │   ├── ai/
│   │   │   ├── AIOverlay.jsx  # Chat interface
│   │   │   ├── AgentChat.jsx  # Agent message UI
│   │   │   └── useAgent.js    # Agent hook + action execution
│   │   ├── components/
│   │   │   ├── VisualAlert.jsx # Hearing-impaired alerts
│   │   │   └── VoiceControlUI.jsx
│   │   ├── utils/
│   │   │   └── terminalLogger.js
│   │   ├── App.jsx            # Root component
│   │   └── main.jsx           # Entry point
│   ├── index.html             # Loads MediaPipe CDN scripts
│   └── package.json

├── server/                    # Node.js Backend (Express)
│   ├── index.js               # Express entry + middleware
│   ├── ws.js                  # WebSocket server + chokidar
│   ├── routes/
│   │   ├── fs.js             # Filesystem API (DFS)
│   │   ├── agent.js          # Multi-agent chat
│   │   ├── profile.js        # Accessibility profiles
│   │   ├── auth.js           # Authentication
│   │   ├── process.js        # Process management
│   │   ├── workflow.js       # Rule-based automation
│   │   ├── terminal.js       # Sandboxed command execution
│   │   ├── proxy.js          # HTTP proxy
│   │   ├── knownBook.js      # Alzheimer known faces API
│   │   ├── upload.js         # Photo upload
│   │   ├── log.js            # Terminal logger
│   │   └── whisper.js        # Speech-to-text
│   ├── agents/               # AI Agents
│   │   ├── planner.js        # Intent routing (Claude JSON)
│   │   ├── fileAgent.js      # File operations
│   │   ├── systemAgent.js    # OS commands
│   │   ├── knowledgeAgent.js # Q&A
│   │   └── assistantAgent.js # General chat
│   ├── lib/
│   │   ├── orchestrator.js   # Parallel execution + merge
│   │   ├── dfs.js            # DFS algorithm
│   │   ├── anthropic.js      # Claude client
│   │   ├── llm.js            # LLM wrapper
│   │   ├── context.js        # Context builder
│   │   ├── prisma.js         # Shared Prisma singleton
│   │   ├── constants.js
│   │   └── workflow.js       # Rule runner
│   ├── middleware/
│   │   ├── auth.js           # requireAuth
│   │   ├── validate.js       # Zod validation
│   │   └── scopePermissions.js
│   ├── prisma/
│   │   └── schema.prisma
│   └── package.json

├── docs/
│   ├── SPIRITOS_BUILD_GUIDE.md
│   ├── SPIRITOS_VERIFY.md
│   ├── SPIRITOS_UI_REDESIGN_PROMPT.md
│   ├── yolo_gesture_control_models.md
│   ├── fixingcamera.md        # Camera conflict fixes
│   └── poster.html            # Research poster

├── package.json               # Root (runs both)
└── README.md                  # This file
```

---

## 🚀 Getting Started

### Prerequisites

- Node.js ≥ 20.0.0
- npm ≥ 9.0.0
- Modern browser (Chrome, Firefox, Edge)
- Webcam for gesture/eye tracking

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd Spirit--OS

# Install all dependencies (frontend + backend)
npm install

# Generate Prisma client
npm run db:generate
```

### Running the Development Server

```bash
# Start both frontend and backend
npm run dev

# Or run separately:
npm run dev:client    # Frontend only (port 5173)
npm run dev:server    # Backend only (port 3001)
```

### Building for Production

```bash
npm run build
```

The built files will be in `client/dist/`

---

## 🔧 Configuration

### Environment Variables

Create `.env` in server directory:

```env
# Anthropic API (required for AI features)
ANTHROPIC_API_KEY=your_api_key_here

# Database
DATABASE_URL=file:./dev.db

# Demo filesystem path
FS_ROOT=./demo-filesystem
DEMO_FS_ROOT=./demo-filesystem

# Session secret (required — server throws if missing)
SESSION_SECRET=your_secret_here

# Agent timeout (ms)
AGENT_TIMEOUT_MS=10000

# Terminal limits
TERMINAL_TIMEOUT=15000
TERMINAL_MAX_OUTPUT=50000
```

Create `.env` in client directory:

```env
# API URL
VITE_API_URL=

# WebSocket URL
VITE_WS_URL=ws://localhost:3001

# Gesture config
VITE_GESTURE_COOLDOWN=2000
VITE_GESTURE_HOLD_TIME=800
VITE_PINCH_THRESH=0.42
VITE_BLINK_COOLDOWN=800
```

### Demo Filesystem

The server includes a demo filesystem at `server/demo-filesystem/`. The DFS algorithm operates on this directory by default.

### Required Model Files

Place the following in `client/public/models/`:
- `yolo/yolov8s.onnx` — YOLOv8s object detector (from Ultralytics)
- `gesture_recognizer.task` — MediaPipe gesture model (from MediaPipe)
- `face_landmarker.task` — loaded from Google Storage CDN at runtime
- face-api.js models: `face_recognition_model-*`, `face_landmark_68_model-*`, etc.

---

## 📱 Desktop Applications

| App | Description | Default Size |
|-----|-------------|--------------|
| 📁 File Explorer | File manager with tree + grid view | 900×600 |
| 💻 Terminal | Smart terminal (English → CMD commands) | 700×450 |
| 🧮 Calculator | Standard calculator | 380×480 |
| 📝 Notes | Text editor with AI assistant | 600×500 |
| 🌐 Browser | Simulated web browser | 1000×700 |
| ⚙️ Settings | OS configuration + accessibility profiles | 700×550 |
| 🌐 Translator | Translation app | 800×550 |
| 📧 Mail | Email client | - |
| 👤 Known Book | Alzheimer face recognition | - |

---

## 🔐 API Endpoints

### Filesystem API (`/api/fs`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/tree` | Get directory tree (DFS cached) |
| GET | `/list` | List directory contents |
| GET | `/read` | Read file contents (text files only) |
| GET | `/drives` | List Windows drive letters |
| POST | `/create` | Create file/directory |
| PUT | `/write` | Save/update file contents |
| POST | `/move` | Move/copy files |
| DELETE | `/delete` | Delete file/directory |
| POST | `/rename` | Rename file/directory |
| GET | `/search` | Search files (cached tree) |
| GET | `/stats` | Directory statistics |

### Agent API (`/api/agent`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/chat` | Multi-agent chat (rate-limited 20/min) |

### Profile API (`/api/profile`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Get current profile |
| POST | `/apply` | Apply profile settings |

### Other APIs

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/terminal/allowed` | List allowed terminal commands |
| GET | `/api/known-book` | Get known faces |
| POST | `/api/upload` | Upload photos |

---

## 🎯 Performance Metrics

| Metric | Value |
|--------|-------|
| DFS Traversal | O(E·log N) |
| Tree Cache TTL | 5 seconds |
| Agent Timeout | 10 seconds |
| Gesture Hold Time | 800ms |
| Gesture Cooldown | 2 seconds |
| Click Cooldown | 300ms |
| Voice Commands | 30+ pre-defined |
| Eye Dwell Time | 1.5s (single) / 2× within 400ms (double) |
| Eye Smoothing | EMA α=0.15 |
| Eye FPS Cap | ~30fps |
| YOLO Detection Interval | 500ms |
| Sign Language Dwell | Configurable |

---

## 🔜 Future Enhancements

- [ ] Hand-specific YOLO model (currently using general YOLOv8s)
- [ ] Multi-hand detection (currently single hand only)
- [ ] Custom gesture training via transfer learning
- [ ] Cloud sync for profiles and settings
- [ ] Mobile touch gesture support
- [ ] Linux/Mac support for terminal commands (currently Windows-only)
- [ ] Expanded sign language vocabulary

---

## 📄 License

Apache-2.0 license

---

## 🙏 Acknowledgments

- Research inspiration from FlexOS paper
- YOLOv8 by Ultralytics
- ONNX Runtime by Microsoft
- MediaPipe by Google
- face-api.js by justadudewhohacks

---

<p align="center">
  Made with ❤️ for a more accessible digital world
</p>
# Spirit--OS
