# FlexOS / SavitaOS — Implementation Master Guide

> **Purpose**: This document is the single source of truth for implementing all missing and partial features.
> Every section is self-contained and ground-truth verified against the existing codebase audit.
> Follow each phase in strict order. Do NOT skip ahead.

---

## ⚠️ Pre-Implementation Rules (Read Before Touching Any File)

1. **Never fabricate file paths.** Every file referenced in this guide must either already exist in the codebase or be explicitly created in a listed sub-task.
2. **Always read the file before editing it.** Run `cat <filepath>` or open it before writing a patch.
3. **Never invent library APIs.** If a library function is used, it must be verifiable in that library's official docs (linked in each section).
4. **No inlined TODO comments** in production code. Every sub-task must be complete before moving to the next.
5. **After each sub-task**, run the stated **verification command** before marking it done.
6. **Prisma schema changes** always require: `npx prisma migrate dev --name <name>` + `npx prisma generate`.
7. **All new React components** must have a corresponding entry in `App.jsx` or the component registry before they are wired.

---

## 📁 Canonical File Tree (Existing — Do Not Recreate)

```
project-root/
├── client/
│   └── src/
│       ├── input/
│       │   ├── GestureController.jsx      ← EXISTS
│       │   ├── EyeTracker.jsx             ← EXISTS
│       │   └── VoiceController.jsx        ← EXISTS
│       ├── components/
│       │   └── WindowFrame.jsx            ← EXISTS
│       ├── Terminal/
│       │   └── index.jsx                  ← EXISTS
│       └── hooks/
│           └── useTTS.js                  ← EXISTS (assumed — verify)
├── server/
│   ├── lib/
│   │   ├── dfs.js                         ← EXISTS
│   │   └── anthropic.js                   ← EXISTS
│   ├── routes/
│   │   └── fs.js                          ← EXISTS
│   └── middleware/                         ← CREATE scopePermissions.js here
└── prisma/
    └── schema.prisma                       ← EXISTS (UserProfile model)
```

---

## Phase 1 — Foundation & Accessibility (Week 1–2)

---

### 1.1 Sign Language to Text

**Goal**: Detect 8 ASL-style hand signs from the webcam feed and convert them to on-screen text with audio output.

**Signs to Classify**: Hello, Thank You, Yes, No, Help, Please, Sorry, Goodbye

**Libraries** (no new installs if MediaPipe already present):
- `@mediapipe/hands` — already used in `GestureController.jsx`
- `@tensorflow/tfjs` — for sign classifier model
- `@tensorflow-models/hand-pose-detection` — optional fallback
- Browser-native `SpeechSynthesisUtterance` — for TTS output

**Verification before starting**:
```bash
# Run this first — confirm existing MediaPipe version
cat client/package.json | grep mediapipe
cat client/package.json | grep tensorflow
```

---

#### Sub-task 1.1.1 — Create the Sign Classifier Data Layer

**File to create**: `client/src/input/signLanguage/signConfig.js`

```js
// signConfig.js — Ground truth sign definitions
// Each sign is represented as a normalised landmark pattern (21 points × {x,y,z})
// Values here are PLACEHOLDER skeletons — replace with real landmark snapshots
// collected via the data-collection tool (sub-task 1.1.2)

export const SIGN_LABELS = [
  'Hello', 'Thank You', 'Yes', 'No',
  'Help', 'Please', 'Sorry', 'Goodbye'
];

// Threshold: cosine similarity score above which a sign is accepted
export const CONFIDENCE_THRESHOLD = 0.82;

// How long (ms) a sign must be held before it is emitted
export const DWELL_TIME_MS = 600;
```

**Verification**: File exists and exports the three named exports.

---

#### Sub-task 1.1.2 — Build a Landmark Data-Collection Tool

**File to create**: `client/src/input/signLanguage/SignDataCollector.jsx`

This component is a **developer-only utility**, not shown to end users. It:
1. Opens the camera (reuse the `GestureController.jsx` MediaPipe setup — do NOT duplicate the camera init logic; import the shared hook)
2. Displays a prompt: "Show sign: **Hello**"
3. On Space bar press, records the current 21-landmark array to `localStorage` under key `sign_data_<label>`
4. Collects 30 samples per sign (counter shown on screen)
5. Has an **Export JSON** button that downloads all collected samples as `sign_training_data.json`

**Why this first**: Without real landmark data, the classifier will hallucinate accuracy. This tool produces the training data that feeds 1.1.3.

**Verification**:
```bash
# After building, navigate to /dev/sign-collector in the app
# Collect 5 samples for "Hello", click Export
# Confirm the JSON file has structure: { "Hello": [[...21 landmarks...], ...] }
```

---

#### Sub-task 1.1.3 — Train and Export the Classifier

**File to create**: `client/src/input/signLanguage/trainClassifier.js`
(This is a **Node.js script**, not a React file. Run it once offline.)

```js
// trainClassifier.js
// Input:  sign_training_data.json  (from 1.1.2)
// Output: sign_model/  (TensorFlow.js LayersModel directory)
// Run:    node trainClassifier.js

const tf = require('@tensorflow/tfjs-node');
const data = require('./sign_training_data.json');

// Architecture: 63-input (21 landmarks × 3 coords) → 128 → 64 → 8-softmax
// Do NOT change the architecture without re-running this script
```

Complete the training loop:
- Normalise landmarks relative to wrist point (landmark[0]) so output is translation-invariant
- Use `tf.train.adam(0.001)` optimiser
- Train for 100 epochs with 80/20 split
- Save with `model.save('file://./sign_model')`
- Log final val_accuracy — must be ≥ 0.90 before proceeding

**Verification**:
```bash
ls client/src/input/signLanguage/sign_model/
# Must contain: model.json  group1-shard1of1.bin
```

---

#### Sub-task 1.1.4 — Create the Main Sign Language Controller

**File to create**: `client/src/input/SignLanguageController.jsx`

Exact responsibilities (implement each as a named function inside the component):

| Function | Responsibility |
|----------|---------------|
| `initCamera()` | Reuse the camera stream from `GestureController.jsx` via a shared context — do NOT open a second `getUserMedia` stream |
| `loadModel()` | Load `sign_model/model.json` using `tf.loadLayersModel()` once on mount |
| `normaliseLandmarks(landmarks)` | Subtract wrist (landmark[0]) x/y/z from all 21 points; return flat Float32Array of length 63 |
| `classifyFrame(landmarks)` | Run `model.predict()`, return `{ label, confidence }` |
| `handleDwell(label)` | Start/reset a `DWELL_TIME_MS` timer; emit sign only if same label held |
| `speakSign(label)` | Call `useTTS.js` hook to speak the label aloud |

**UI to render**:
- Small overlay (bottom-left, `position: fixed`) showing:
  - Current detected sign name (or "—" if below threshold)
  - Confidence bar (coloured progress bar)
  - Last 5 emitted signs as a scrolling text strip

**Verification**:
```bash
# Start the dev server
# Open Sign Language Controller
# Show a "Yes" hand sign (nod fist) — overlay should display "Yes" after 600ms dwell
```

---

#### Sub-task 1.1.5 — Wire into App

1. Open `client/src/App.jsx` (read the file first)
2. Add `SignLanguageController` to the accessibility input panel alongside `GestureController` and `EyeTracker`
3. Add a toggle in Settings: `signLanguageEnabled` (boolean, stored in SQLite via the existing UserProfile Prisma model — add the field in 1.1.6)

**File to edit**: `prisma/schema.prisma`
```prisma
model UserProfile {
  // ... existing fields ...
  signLanguageEnabled  Boolean @default(false)   // ADD THIS LINE ONLY
}
```
Then run: `npx prisma migrate dev --name add_sign_language_enabled`

---

### 1.2 Vision-Impaired Path Guidance

**Goal**: When the user presses Space bar on any screen, the OS reads aloud the focusable UI elements in the current window, guiding navigation by voice.

**Depends on**: `useTTS.js` hook — **verify it exists** before starting:
```bash
cat client/src/hooks/useTTS.js
# Must export: const { speak, stop } = useTTS()
```

---

#### Sub-task 1.2.1 — Build the `usePathGuidance` Hook

**File to create**: `client/src/hooks/usePathGuidance.js`

```js
// usePathGuidance.js
// Enumerates focusable DOM elements in the active window and reads them via TTS

import { useEffect, useCallback } from 'react';
import useTTS from './useTTS';

// Selector for all navigable elements — DO NOT broaden this selector arbitrarily
const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  'a[href]',
  '[role="button"]',
  '[role="menuitem"]',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])'
].join(', ');
```

Logic to implement inside the hook:
1. `getElements()` — query the currently focused WindowFrame's DOM subtree (not the entire document — scope to the active window container using a `windowId` prop)
2. `buildScript(elements)` — for each element, extract its accessible label in priority order: `aria-label` → `title` → `innerText` → tag name. Return an array of strings.
3. `readScript(script)` — call `speak()` for each string with a 400ms pause between items
4. `handleSpacebar(e)` — `keydown` listener; only fires if `e.target` is `body` (i.e., no input is focused); calls `getElements` → `buildScript` → `readScript`
5. Attach/detach the listener in `useEffect` with cleanup

**Verification**:
```bash
# Open any app window in FlexOS
# Click outside any input field
# Press Space bar
# Should hear: "Button: Close. Button: Minimise. Link: ..." etc.
```

---

#### Sub-task 1.2.2 — Integrate into WindowFrame

**File to edit**: `client/src/components/WindowFrame.jsx` (read file first)

1. Import `usePathGuidance`
2. Attach the hook inside `WindowFrame`, passing the window's root `ref` as the scope
3. Add a visual flash (100ms white overlay, opacity 0.15) on Space bar trigger to signal activation to low-vision users

---

#### Sub-task 1.2.3 — Add Setting Toggle

**File to edit**: `prisma/schema.prisma`
```prisma
model UserProfile {
  // ... existing + signLanguageEnabled ...
  pathGuidanceEnabled  Boolean @default(false)   // ADD THIS LINE ONLY
}
```
Run: `npx prisma migrate dev --name add_path_guidance_enabled`

Add toggle in Settings UI (same panel as other accessibility toggles).

---

## Phase 2 — Alzheimer's Support (Week 2–3)

> ⚠️ **Sensitive feature.** All face data must be stored locally — never sent to a cloud API. Verify Ollama/local inference is used for any LLM prompts in this phase.

---

### 2.1 Known Book — Database Schema

**File to edit**: `prisma/schema.prisma`

Add this **complete model** (do not split across migrations):

```prisma
model KnownPerson {
  id               Int      @id @default(autoincrement())
  userId           String                    // FK to user session
  name             String
  relationship     String                    // e.g. "daughter", "doctor"
  photoUrl         String?                   // local file path only — no CDN URLs
  notes            String?                   // freeform caregiver notes
  faceDescriptor   String?                   // JSON-serialised Float32Array (128-d)
  lastRecognized   DateTime?
  recognitionCount Int      @default(0)
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
}
```

Run: `npx prisma migrate dev --name add_known_person`

**Verification**:
```bash
npx prisma studio
# KnownPerson table must appear with all columns listed above
```

---

### 2.2 Known Book API Routes

**File to create**: `server/routes/knownBook.js`

Implement exactly these 5 routes — no more:

| Method | Path | Body / Params | Response |
|--------|------|---------------|----------|
| `POST` | `/api/known-book` | `{ name, relationship, photoUrl?, notes? }` | Created record |
| `GET` | `/api/known-book` | — | Array of all records for session user |
| `GET` | `/api/known-book/:id` | — | Single record |
| `PUT` | `/api/known-book/:id` | Any subset of writable fields | Updated record |
| `DELETE` | `/api/known-book/:id` | — | `{ deleted: true }` |

Use the existing Prisma client instance (import from wherever it is already initialised in the server — read `server/` directory to find it, do NOT create a second Prisma client).

Register routes in `server/index.js` (or equivalent entry file): `app.use('/api/known-book', knownBookRouter)`

---

### 2.3 Known Book UI (Settings App)

**File to create**: `client/src/apps/KnownBookApp.jsx`

Screens:
1. **List View** — Cards showing name + relationship + photo thumbnail + last recognised time
2. **Add/Edit Form** — Fields: Name, Relationship (dropdown: family / friend / caregiver / doctor / other), Notes, Photo (file upload → stored locally via `POST /api/upload`)
3. **Detail View** — Full card + recognition history log

Use existing design system components from `WindowFrame.jsx` for styling consistency (glass morphism, rounded corners, traffic light buttons).

---

### 2.4 Face Recognition Module

**Libraries** (pick exactly one, do not install both):
- **Recommended**: `face-api.js` v0.22.2 — browser-native, no server needed, ships with SSD MobileNet + 128-d descriptor
- Fallback: `@tensorflow-models/face-landmarks-detection` if face-api.js conflicts

Install verification:
```bash
cd client && npm install face-api.js@0.22.2
# If any peer conflict, resolve before proceeding — do NOT use --legacy-peer-deps silently
```

**File to create**: `client/src/input/FaceRecognition.jsx`

Exact implementation steps (implement in this order):

**Step A — Model Loading** (run once on component mount)
```js
import * as faceapi from 'face-api.js';

// Load exactly these three models — no others needed for this use case
await faceapi.nets.ssdMobilenetv1.loadFromUri('/models');
await faceapi.nets.faceLandmark68Net.loadFromUri('/models');
await faceapi.nets.faceRecognitionNet.loadFromUri('/models');
```
Copy model weights to `client/public/models/` — download from face-api.js GitHub releases (do NOT hotlink from CDN in production).

**Step B — Descriptor Storage**

When a new person is added to Known Book:
1. Load their photo as an `HTMLImageElement`
2. Call `faceapi.detectSingleFace(img).withFaceLandmarks().withFaceDescriptors()`
3. Serialise the resulting `Float32Array` to JSON string
4. `PUT /api/known-book/:id` with `{ faceDescriptor: JSON.stringify(Array.from(descriptor)) }`

**Step C — Live Recognition Loop**

```
Every 2000ms (not every frame — performance constraint):
  1. Capture a still frame from the camera canvas
  2. Run faceapi.detectAllFaces(frame).withFaceDescriptors()
  3. For each detected face:
     a. Load all KnownPerson descriptors from local state
     b. Build a FaceMatcher with threshold 0.5
     c. Call matcher.findBestMatch(descriptor)
     d. If match.distance < 0.5: recognised → show overlay
     e. If no match: show "Unknown person" overlay
  4. On recognition:
     a. Display: name + relationship in a floating card near the face bounding box
     b. Call useTTS: "This is [Name], your [relationship]"
     c. PUT /api/known-book/:id to increment recognitionCount and update lastRecognized
```

**Verification**:
```bash
# Add yourself to Known Book with a clear photo
# Open FaceRecognition view
# Look at camera — should overlay your name within 2 seconds
```

---

### 2.5 Alzheimer's Phase System

**File to edit**: `prisma/schema.prisma`
```prisma
model UserProfile {
  // ... existing fields ...
  alzheimerPhase  Int  @default(0)   // 0 = disabled, 1–5 = severity level
}
```
Run: `npx prisma migrate dev --name add_alzheimer_phase`

**File to create**: `client/src/hooks/useAlzheimerSupport.js`

Behaviour by phase (implement as a `switch` on `alzheimerPhase`):

| Phase | Behaviour |
|-------|-----------|
| 0 | Feature disabled — no hooks mounted |
| 1–2 | Known Book reminder every 30 minutes via TTS: "Remember, [Name] is your [relationship]" (cycle through all known people) |
| 3–4 | Trigger face recognition automatically on each new `WindowFrame` focus event |
| 5 | Continuous face recognition loop running at all times; voice prompt for any unrecognised face: "I don't recognise this person. Would you like to add them?" |

Phase selector must be accessible only to a **caregiver-role user** — add `role` field to `UserProfile`:
```prisma
role  String  @default("user")   // "user" | "caregiver"
```

---

## Phase 3 — AI & Cost Optimisation (Week 3–4)

---

### 3.1 Free LLM Integration (Ollama)

**Goal**: Replace paid API calls with a local Ollama fallback, making the chatbot free to run.

**Prerequisite**: Ollama must be installed on the host machine. Document this in `README.md`.

**File to edit**: `server/lib/anthropic.js` (read this file completely before editing)

Refactor the LLM call function to a **waterfall fallback chain**:

```
1. Try: OpenAI (if OPENAI_API_KEY present in env)
2. Try: Anthropic (if ANTHROPIC_API_KEY present in env)
3. Try: Ollama local (always available if installed)
   → POST http://localhost:11434/api/chat
   → model: "llama3" (configurable via OLLAMA_MODEL env var)
4. Throw: "No LLM available — please configure an API key or install Ollama"
```

**Do NOT** change the function's external signature. All callers must continue to work unchanged.

Rename `server/lib/anthropic.js` → `server/lib/llm.js` and update all imports across the server.

**Verification**:
```bash
# Unset all API keys, start Ollama
ollama pull llama3
# Start the server and send a chat message
# Response must come from Ollama (check server logs: "Using Ollama fallback")
```

---

### 3.2 Voice Assistant — Multilingual Support

**File to edit**: `client/src/input/VoiceController.jsx` (read file first)

**Languages to support** (Web Speech API locale codes):
| Language | Locale Code |
|----------|-------------|
| English | `en-US` |
| Hindi | `hi-IN` |
| Tamil | `ta-IN` |
| Telugu | `te-IN` |
| Bengali | `bn-IN` |
| Marathi | `mr-IN` |

**Implementation steps**:

**Step A — Language State**
```js
const [locale, setLocale] = useState(userProfile.voiceLocale ?? 'en-US');
```
Add `voiceLocale String @default("en-US")` to `UserProfile` Prisma model and migrate.

**Step B — Recognition Init**
```js
recognition.lang = locale;
// Set this BEFORE calling recognition.start()
// Re-init recognition when locale changes (useEffect dependency)
```

**Step C — Command Translation Map**

Create `client/src/input/voiceCommands.js`:
```js
export const COMMANDS = {
  'en-US': { open: ['open', 'launch'], close: ['close', 'quit'], ... },
  'hi-IN': { open: ['खोलो', 'शुरू करो'], close: ['बंद करो'], ... },
  'ta-IN': { open: ['திற', 'தொடங்கு'], close: ['மூடு'], ... },
  // ... fill in for all 6 locales
};
```

**Do NOT translate strings from memory.** Use Google Translate or a native speaker for the Hindi/Tamil/Telugu/Bengali/Marathi entries — mark any uncertain translation with `// NEEDS REVIEW` comment.

**Step D — Settings**

Add a language dropdown in Settings that writes `voiceLocale` to the UserProfile via `PUT /api/settings`.

---

## Phase 4 — Polish & Alignment (Week 4)

---

### 4.1 Gesture Mapping Alignment

**File to edit**: `client/src/input/gestureConfig.js` (read the file — confirm it exists with this exact name before editing)

Replace the existing mapping with the doc-specified mapping. **Do not delete** existing gesture detection logic — only change the action targets:

```js
export const GESTURE_ACTIONS = {
  THUMB_UP:          { action: 'OPEN_APP',   target: 'browser',    label: 'Open Browser' },
  THUMB_DOWN:        { action: 'CLOSE_WINDOW', target: 'active',   label: 'Close Window' },
  THUMB_INDEX_PINCH: { action: 'OPEN_APP',   target: 'calculator', label: 'Open Calculator' },
  THUMB_MIDDLE:      { action: 'OPEN_APP',   target: 'files',      label: 'Open File Explorer' },
  ALL_FINGERS_OPEN:  { action: 'OPEN_APP',   target: 'mail',       label: 'Open Mail' },
  // Keep existing gestures that are not in spec — do not remove them
  POINT:             { action: 'CURSOR_MOVE', target: null,         label: 'Move Cursor' },
  PEACE_SIGN:        { action: 'SCREENSHOT',  target: null,         label: 'Screenshot' },
};
```

**Verify Mail app exists**:
```bash
ls client/src/apps/ | grep -i mail
# If Mail app does not exist, create a stub MailApp.jsx with a "Coming soon" screen
# Register it in the app registry — then the gesture will open the stub
```

---

### 4.2 Scope-Based Permissions Middleware

**File to create**: `server/middleware/scopePermissions.js`

```js
// scopePermissions.js
// Enforces: READ allowed anywhere under CWD
//           WRITE restricted to user's home directory only

const path = require('path');

const USER_HOME_ROOT = process.env.USER_HOME_ROOT ?? '/home';

function getUserHomeDir(userId) {
  // Returns absolute path — no trailing slash
  return path.join(USER_HOME_ROOT, userId);
}

function isWithinHome(targetPath, userId) {
  const home = getUserHomeDir(userId);
  const resolved = path.resolve(targetPath);
  return resolved.startsWith(home + path.sep) || resolved === home;
}

module.exports = function scopePermissions(req, res, next) {
  const userId = req.session?.userId;
  if (!userId) return res.status(401).json({ error: 'Not authenticated' });

  const targetPath = req.body?.path ?? req.query?.path;
  if (!targetPath) return next(); // No path — let route handle it

  const method = req.method;

  // WRITE operations: POST, PUT, PATCH, DELETE
  const isWrite = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);

  if (isWrite && !isWithinHome(targetPath, userId)) {
    return res.status(403).json({
      error: 'Write access denied: path is outside your home directory',
      yourHome: getUserHomeDir(userId),
      attempted: targetPath
    });
  }

  next();
};
```

**File to edit**: `server/routes/fs.js` (read first)
Add this to the top of every file-system route:
```js
const scopePermissions = require('../middleware/scopePermissions');
router.use(scopePermissions);
```

**Verification**:
```bash
# Attempt a POST /api/fs with path: "/etc/passwd"
# Must return 403 with the error message above
# Attempt a GET /api/fs with path: "/etc/passwd"
# Must succeed (READ is allowed)
# Attempt a POST /api/fs with path: "/home/<userId>/test.txt"
# Must succeed
```

---

## Testing Checklist (Run After All 4 Phases)

| Feature | Test | Expected |
|---------|------|----------|
| Sign Language | Show "Yes" sign for 600ms | Overlay shows "Yes", TTS speaks "Yes" |
| Path Guidance | Space bar on empty desktop | Reads all taskbar/dock buttons aloud |
| Known Book API | POST then GET /api/known-book | Created record returned |
| Face Recognition | Photo added, face in camera | Name overlay + TTS within 2s |
| Alzheimer Phase 1 | Set phase=1, wait 30 min | TTS reads a Known Book entry |
| Free LLM | No API keys, send chat message | Ollama responds (logged) |
| Multilingual Voice | Set locale=hi-IN, say "खोलो" | Triggers OPEN_APP action |
| Gesture Thumb Up | Show thumbs up | Browser app opens |
| Scope Permissions | Write to /etc/ | 403 response |
| Scope Permissions | Read from anywhere | 200 response |

---

## Environment Variables Reference

Add all of these to `.env.example` (and `.env`):

```env
# LLM Config
OPENAI_API_KEY=           # Optional — leave blank to skip
ANTHROPIC_API_KEY=        # Optional — leave blank to skip
OLLAMA_MODEL=llama3       # Default local model

# File System
USER_HOME_ROOT=/home      # Root directory for user home scoping

# Prisma
DATABASE_URL=file:./dev.db
```

---

## Migration Order (Critical — Do Not Change)

Run Prisma migrations in this exact sequence:

```bash
# 1
npx prisma migrate dev --name add_sign_language_enabled

# 2
npx prisma migrate dev --name add_path_guidance_enabled

# 3
npx prisma migrate dev --name add_known_person

# 4
npx prisma migrate dev --name add_alzheimer_phase

# 5
npx prisma migrate dev --name add_caregiver_role

# 6
npx prisma migrate dev --name add_voice_locale

# Final — always run after all migrations
npx prisma generate
```

---

## Appendix — Dependency Install Commands

```bash
# Client
cd client
npm install face-api.js@0.22.2
npm install @tensorflow/tfjs@latest
# Do NOT install @mediapipe/hands again if already present

# Server
cd server
npm install  # No new server deps required for this roadmap
```

---

*End of FlexOS Implementation Master Guide — v1.0*
