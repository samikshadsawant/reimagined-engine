# SpiritOS × IRIS Integration — Implementation Plan

> Last updated: 2026-06-04  
> Incorporates Mark-XXXIX insights + all completed work + Phase 6 Innerve accessibility.

---

## ✅ Phase 0 + Phase 1 — Foundation (COMPLETE)

| Step | Status | What Was Built |
|------|--------|----------------|
| Dependencies | ✅ | `@google/generative-ai`, `groq-sdk`, `tesseract.js`, `screenshot-desktop`, `cheerio` |
| `irisEngine.js` | ✅ | Triple-engine router: Gemini → OpenRouter → Spirit |
| `irisTools.js` | ✅ | 15 tool handlers with Gemini function declarations |
| `agent.js` route | ✅ | `/api/agent/chat` → irisEngine, `/api/agent/status` → health check |
| `.env` config | ✅ | GEMINI, GROQ, TAVILY, OPENROUTER keys + engine vars |
| `memory.json` | ✅ | Persistent categorized memory storage |

---

## ✅ Phase 1.5 — Hardening & Quick Wins (COMPLETE)

| Step | Status | What Was Built |
|------|--------|----------------|
| Tavily Web Search | ✅ | `google_search` tool → real Tavily API (structured results) |
| Categorized Memory | ✅ | 6 categories: identity, preferences, projects, relationships, wishes, notes |
| OpenRouter Fallback | ✅ | `openRouterClient.js` — 7 free models with rate-limit rotation |
| Weather Tool | ✅ | `weather_report` → wttr.in (no API key needed) |
| Gemini Model Fallback | ✅ | Tries `gemini-2.5-flash` → `2.0-flash` → `2.0-flash-lite` (independent quotas) |
| 429 Caching | ✅ | Exhausted models cached 5min, auto-skip to next model |
| OpenRouter Error Handling | ✅ | Handles 402/404/429, skips dead models automatically |

### Current Architecture
```
User Message
    │
    ├── Gemini (gemini-2.5-flash → 2.0-flash → 2.0-flash-lite)
    │     ├── ✅ Success → tool-calling + natural response
    │     └── All 429'd ──┐
    │                      │
    ├── OpenRouter (7 free LLMs with rotation)
    │     ├── ✅ Success → conversational response (no tools)
    │     └── All failed ──┐
    │                       │
    └── Spirit (offline NLP engine)
          └── ✅ Always available, no internet needed
```

### Files Built So Far
| File | Size | Purpose |
|------|------|---------|
| `server/lib/irisEngine.js` | 14KB | Triple-engine router with model fallback + 429 cache |
| `server/lib/irisTools.js` | 15KB | 15 tools: file CRUD, system, notes, search, weather, memory |
| `server/lib/openRouterClient.js` | 6KB | Free-model rotation (7 models, auto rate-limit handling) |
| `server/routes/agent.js` | 3KB | Chat + status endpoints |

### Tools Available (17 total)
| Tool | Status | Source |
|------|--------|--------|
| `read_directory` | ✅ Live | Phase 1 |
| `create_folder` | ✅ Live | Phase 1 |
| `read_file` | ✅ Live | Phase 1 |
| `write_file` | ✅ Live | Phase 1 |
| `manage_file` | ✅ Live | Phase 1 |
| `open_app` | ✅ Live | Phase 1 |
| `close_app` | ✅ Live | Phase 1 |
| `run_terminal` | ✅ Live | Phase 1 |
| `save_note` | ✅ Live | Phase 1 |
| `read_notes` | ✅ Live | Phase 1 |
| `google_search` | ✅ Live | Phase 1.5 (Tavily) |
| `weather_report` | ✅ Live | Phase 1.5 (wttr.in) |
| `save_memory` | ✅ Live | Phase 1.5 (categorized) |
| `recall_memory` | ✅ Live | Phase 1.5 (categorized) |
| `create_reminder` | ✅ Live | Phase 2 (direct SQLite/Prisma) |
| `list_reminders` | ✅ Live | Phase 2 (direct SQLite/Prisma) |
| `delete_reminder` | ✅ Live | Phase 2 (direct SQLite/Prisma) |

### API Keys Status
| Key | Status | Used By |
|-----|--------|---------|
| GEMINI_API_KEY | ✅ Working (2.5-flash) | Primary engine |
| GROQ_API_KEY | ✅ Working | Reserved for future intent routing |
| TAVILY_API_KEY | ✅ Working | Web search tool |
| OPENROUTER_API_KEY | ✅ Working (nemotron-120b) | Fallback tier 1 |

---

## ✅ Phase 2 — Voice Engine & Reminders Integration (COMPLETE)

### Known Issue: Gemini Live API Not Available on Free Tier

> **WARNING**: The Gemini Live API (`bidiGenerateContent` WebSocket endpoint) requires
> models like `gemini-2.5-flash-live-preview` which are **not available on the free-tier
> API key**. All connection attempts fail with WS close code `1008`.

**Resolution: Hybrid Voice Pipeline (STT → IRIS text chat → TTS)**

```
Browser Mic → Web Speech API (STT) → text → POST /api/agent/chat → IRIS response
                                                                        │
Browser Speaker ← Web Speech API (TTS) ← text ← response.message ←────┘
```

### Files Built (Phase 2)
| File | Status | Purpose |
|------|--------|---------|
| `server/lib/geminiVoice.js` | ✅ Built (dormant) | Gemini Live WS relay — ready for paid key |
| `server/ws.js` | ✅ Modified | Voice message routing |
| `client/src/hooks/useGeminiVoice.js` | ✅ Built (dormant) | AudioWorklet mic capture + PCM playback |
| `server/routes/agent.js` | ✅ Modified | Added voice-status endpoint |
| `client/src/input/VoiceController.jsx` | ✅ Modified | Dual-mode UI (Commands / Live toggle) |
| `server/routes/knownBook.js` | ✅ Fixed | Removed 401 auth guard → graceful fallback |

### Step 2.A — Hybrid Voice Mode (COMPLETE)
### Step 2.B — Voice settings panel (COMPLETE)
### Step 2.C — Unified Session ID Resolution & Live Refresh (COMPLETE)

---

## ✅ Phase 3 — High-Value Tools (COMPLETE)

### Step 3.1 — Memory API endpoints ✅
### Step 3.2 — Vector Search ✅
### Step 3.3 — Vision and OCR ✅
### Step 3.4 — Document Parsers ✅

### Files Built (Phase 3)
| File | Purpose |
|------|---------|
| `server/lib/vectorSearch.js` | Embedding-based semantic search with JSON persistence |
| `server/lib/visionOcr.js` | Screen capture, OCR, Gemini Vision analysis |
| `server/lib/docParser.js` | PDF/DOCX/HTML/text extraction |
| `server/routes/memory.js` | REST API for categorized memory |
| `server/routes/search.js` | REST API for vector search + document parsing |

### New Tools (7 added, 24 total)
| Tool | Source |
|------|--------|
| `semantic_search` | Phase 3.2 |
| `index_directory` | Phase 3.2 |
| `capture_screen` | Phase 3.3 |
| `ocr_image` | Phase 3.3 |
| `analyze_screen` | Phase 3.3 |
| `analyze_image` | Phase 3.3 |
| `parse_document` | Phase 3.4 |

---

## ✅ Phase 4 — Advanced Features (COMPLETE)

### Step 4.1 — Desktop Automation ✅
### Step 4.2 — Biometric Vault ✅

### Files Built (Phase 4)
| File | Purpose |
|------|---------|
| `server/lib/desktopAutomation.js` | Workflow engine + in-memory task scheduler |
| `server/lib/biometricVault.js` | AES-256-GCM encrypted vault with PBKDF2 PIN |
| `server/routes/automation.js` | REST API for workflows + scheduled tasks |
| `server/routes/vault.js` | REST API for vault CRUD |
| `client/src/apps/Vault/index.jsx` | Full vault UI (lock/list/add/detail) |

### New Tools (12 added, 36 total)
| Tool | Phase |
|------|-------|
| `run_workflow` | 4.1 |
| `create_workflow` | 4.1 |
| `list_workflows` | 4.1 |
| `delete_workflow` | 4.1 |
| `schedule_task` | 4.1 |
| `list_scheduled` | 4.1 |
| `cancel_scheduled` | 4.1 |
| `vault_unlock` | 4.2 |
| `vault_add` | 4.2 |
| `vault_get` | 4.2 |
| `vault_list` | 4.2 |
| `vault_delete` | 4.2 |

---

## ✅ Phase 5 — Frontend Polish (COMPLETE)

- AI Status in Taskbar
- Enhanced Chat UI
- Smart Search in File Explorer
- AI and Voice Settings Page

---

## 🚀 Phase 6 — Core OS Fixes + File System Hardening + Innerve Features

### Audit Findings

| Feature | Current Status | Root Cause |
|---------|---------------|------------|
| **File search** | ❌ Broken — UI calls `/api/fs/search` but endpoint doesn't exist | Missing route in `fs.js` |
| **Create/Rename/Delete files** | ❌ 403 Forbidden on ALL writes | `scopePermissions.js` resolves paths relative to server CWD, not FS_ROOT |
| **Open images/PDFs** | ❌ "unsupported file type" | Only text extensions whitelisted; no raw file serving endpoint |
| **Desktop wallpaper** | ❌ Not applied — CSS hardcoded | `desktop-bg` doesn't read `osStore.wallpaper`; Settings picker sets store but nothing reads it |
| **Desktop right-click → New Folder** | ❌ Action defined but not handled | `Desktop.jsx` `handleContextAction` only handles `terminal`, `wallpaper`, `refresh` |
| **Clipboard copy/paste files** | ❌ Only "Copy Path" exists | No cut/copy/paste file operations |

---

### Step 6.1 — Fix scopePermissions.js (CRITICAL BUG)

**[MODIFY]** `server/middleware/scopePermissions.js`
- Import `FS_ROOT` (same env var `fs.js` uses)
- Rewrite `isWithinHome()` to resolve `targetPath` relative to `FS_ROOT` instead of `path.resolve(targetPath)`
- If `USER_HOME_ROOT` is not explicitly set, allow writes anywhere inside `FS_ROOT`

---

### Step 6.2 — Add File Search Endpoint

**[MODIFY]** `server/routes/fs.js`
- Add `GET /search?query=<term>&path=<dir>` endpoint
- Recursively walk directory tree, match filenames case-insensitively
- Return results with `{ name, path, type, size, modified }`
- Depth-limited to 5 levels to prevent runaway scans

---

### Step 6.3 — Add Raw File Serving Endpoint

**[MODIFY]** `server/routes/fs.js`
- Add `GET /view?path=<relative_path>` endpoint
- Uses `res.sendFile(fullPath)` — Express auto-detects MIME
- Path traversal protection via `resolvePath()` + ensure within `FS_ROOT`

---

### Step 6.4 — Fix Desktop Wallpaper Application

**[MODIFY]** `client/src/desktop/Desktop.jsx`
- Read `osStore.wallpaper` and apply it as inline `style={{ background: wallpaper }}`
- Override the hardcoded `desktop-bg` background when a custom wallpaper is set

**[MODIFY]** `client/src/desktop/Desktop.jsx` — Context Menu Actions
- Handle `newFolder` action: prompt for name, call `/api/fs/create` with FS_ROOT path
- Handle `newFile` action: prompt for name, call `/api/fs/create`

**[MODIFY]** `client/src/config/appConfig.js`
- Add "New File" option to `CONTEXT_MENU_ITEMS`

---

### Step 6.5 — File Explorer Multi-Type Opening + Clipboard

**[MODIFY]** `client/src/apps/FileExplorer/index.jsx`
- Enhance `openTextFile` → `openFile`:
  - **Images** (`.png`, `.jpg`, `.jpeg`, `.gif`, `.svg`, `.webp`, `.bmp`) → Open `ImageViewer`
  - **PDFs** (`.pdf`) → Open `PdfViewer`
  - **Other** → Offer download via `/api/fs/view`
- Add clipboard state: `cutItems`, `copiedItems`
- Context menu: add Cut, Copy, Paste actions
- Paste calls `/api/fs/move` (cut) or a new copy endpoint

---

### Step 6.6 — ImageViewer Application

**[NEW]** `client/src/apps/ImageViewer/index.jsx`
- Display image from `/api/fs/view?path=...`
- Zoom in/out with mouse wheel or +/− buttons
- Rotate left/right (90° increments)
- Fit-to-window toggle
- Dark/light background toggle for transparent images
- Image info bar (filename, dimensions)

---

### Step 6.7 — PdfViewer Application

**[NEW]** `client/src/apps/PdfViewer/index.jsx`
- Render PDFs via `<iframe src="/api/fs/view?path=...">` (browser-native)
- Page navigation controls (prev/next/go-to-page)
- Zoom controls
- **Read Aloud**: Extract text via `/api/search/parse`, use Web Speech API TTS
- **Search**: Client-side text search with match highlighting
- **Voice Commands**: Hook into VoiceController — "next page", "zoom in", "read this page"

---

### Step 6.8 — Interactive Reading (Face-Depth Zoom)

**[MODIFY]** `client/src/input/EyeTracker.jsx`
- Add face depth calculation using landmark distance (same formula as Innerve)
- Dispatch `spiritos:face-depth` event + update `osStore.faceZoomScale`

**[MODIFY]** `client/src/store/osStore.js`
- Add `faceZoomScale` state (default 1.0)

**[MODIFY]** `client/src/apps/Notes/index.jsx` + `PdfViewer/index.jsx`
- Add "Interactive Reading" toggle
- Apply dynamic font/zoom scale from `faceZoomScale`

---

### Step 6.9 — Register New Apps

**[MODIFY]** `client/src/config/appConfig.js`
- Add `PdfViewer` and `ImageViewer` to APPS registry + ICON_STYLES

**[MODIFY]** `client/src/desktop/WindowFrame.jsx`
- Add lazy imports + icon mappings for PdfViewer and ImageViewer

---

## Environment Variables

```env
GEMINI_API_KEY=...
GROQ_API_KEY=...
TAVILY_API_KEY=...
OPENROUTER_API_KEY=...
AI_PRIMARY_ENGINE=iris
AI_FALLBACK_TIMEOUT_MS=10000
ENABLE_PERSISTENT_MEMORY=true
```

---

## Timeline

| Phase | Status | Deliverable |
|-------|--------|-------------|
| Phase 0 | ✅ Complete | Repos studied, tools mapped |
| Phase 1 | ✅ Complete | Triple-engine routing, Gemini tool-calling |
| Phase 1.5 | ✅ Complete | Tavily, weather, memory, OpenRouter, model fallback |
| Phase 2 | ✅ Complete | Hybrid voice (STT→IRIS→TTS) + Voice Settings picker + Reminders tools & session resolution |
| Phase 3 | ✅ Complete | Memory API, vector search (Gemini embeddings), OCR/Vision, document parsers |
| Phase 4 | ✅ Complete | Desktop automation (workflows + scheduler) + AES-256 biometric vault |
| Phase 5 | ✅ Complete | Frontend polish, settings UI |
| Phase 6 | ✅ Complete | Core OS fixes + File search + Wallpaper + PdfViewer + ImageViewer + Interactive Reading |

---

## Verification Plan

1. **File Search**: Type in File Explorer search box → results appear from recursive directory scan
2. **Create/Rename/Delete**: Right-click file → Rename/Delete work without 403 errors
3. **New File/Folder from desktop**: Right-click desktop → New Folder/New File creates item
4. **Wallpaper**: Settings → change wallpaper → desktop background updates immediately
5. **Open PDF**: Double-click `.pdf` → PdfViewer opens with page controls + read aloud
6. **Open Image**: Double-click `.png`/`.jpg` → ImageViewer opens with zoom/rotate
7. **Interactive Reading**: Enable eye tracking + toggle → leaning closer scales text

---

## 📝 Error Log & Fixes

### 1. File Explorer & Desktop Duplicate Context Menus
- **Symptom**: Right-clicking inside the File Explorer triggered two menus simultaneously: the File Explorer context menu (e.g. rename, delete) and the Desktop wallpaper context menu (e.g. Change Wallpaper, New File). Left-clicking inside File Explorer container also had event bubbling issues.
- **Cause**: Event propagation was not stopped. Context menu trigger events bubbled up to the parent Desktop container, invoking the Desktop context menu handler in `Desktop.jsx`.
- **Fix**: Added `event.stopPropagation()` to `handleContextMenu` inside `FileExplorer/index.jsx` and added `onContextMenu={(e) => e.stopPropagation()}` to the main FileExplorer layout container.

### 2. Context Menu Coordinates Offset inside Draggable Windows
- **Symptom**: Right-clicking the empty area inside File Explorer rendered the context menu way off-screen at the bottom of the page.
- **Cause**: Position coordinates (`clientX`/`clientY`) were passed directly to `left`/`top` offsets on a container styled with `position: fixed`. Because the React Rnd window frames use CSS `transform` for viewport translation, the transformed parent acted as the viewport origin for the menu.
- **Fix**: Portaled the context menu to `document.body` via React `createPortal` to decouple it from transformed parent DOM elements. Added boundary constraints (`Math.min`) to prevent coordinate overflow beyond viewport edges.

### 3. Media Viewer App Clutter (PDF & Image Viewers on Home Page)
- **Symptom**: The PDF Viewer and Image Viewer apps rendered as icons on the desktop workspace grid and inside the App Launcher, cluttering the UI. The user wanted them to run dynamically as background viewer functions rather than standalone desktop apps.
- **Cause**: `DESKTOP_APPS` mapped over the entire registry `APPS`.
- **Fix**: Filtered out `PdfViewer` and `ImageViewer` entries from `DESKTOP_APPS` in `appConfig.js`, and filtered them out of the App Launcher list inside `AppLauncher.jsx` so they only spawn on-demand.

### 4. Blank Media Viewer Windows on File Double-Click
- **Symptom**: Double-clicking a PDF or image inside File Explorer opened the respective viewer window, but the frame content rendered completely blank.
- **Cause**: `WindowFrame.jsx` spreads the `props` flatly onto components (e.g. `<AppComponent {...props} />`), whereas `PdfViewer` and `ImageViewer` were expecting properties nested inside a single `windowData` parameter.
- **Fix**: Rewrote prop de-structuring in `ImageViewer/index.jsx` and `PdfViewer/index.jsx` to retrieve flat variables `filePath` and `fileName` from direct props, falling back to nested `windowData.props` as a fallback.

### 5. Multi-Instance Media Support
- **Symptom**: Double-clicking a second image or PDF closed the first one rather than opening them side-by-side.
- **Cause**: PDF and Image viewers were treated as single-instance apps.
- **Fix**: Registered `ImageViewer` and `PdfViewer` in `MULTI_INSTANCE_APPS` inside `windowStore.js` to support side-by-side viewer windows.
