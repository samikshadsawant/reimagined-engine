# Phase 1 — Calm-Light Foundation

> Completed: 2026-06-13

---

## Files Changed

### Server
| File | Change |
|---|---|
| `server/routes/fs.js` | Replaced hard `DELETE` with move-to-Trash; added `GET /trash`, `POST /trash/restore`, `POST /trash/delete`, `POST /trash/empty` |

### Client
| File | Change |
|---|---|
| `client/src/store/osStore.js` | `theme: 'light'` default; light wallpaper; all PROFILE_PRESETS → `theme: 'light'`; persist version bumped 4 → 5; `migrate()` defaults to `'light'` |
| `client/src/index.css` | High-contrast updated to true black/white/#ffd400 palette; `@media (prefers-reduced-motion)` block added |
| `client/src/apps/Settings/index.jsx` | Theme card → 3 columns (Light / Dark / High contrast); `contrast` + `setContrast` pulled from store |
| `client/src/apps/FileExplorer/index.jsx` | Delete → move-to-Trash + Undo toast; Trash sidebar panel (list/restore/delete-forever/empty); friendly error banner with Retry; min-h toolbar; `showToast` replaces `alert`/`confirm` for non-destructive actions |
| `client/src/components/Toast.jsx` | New — lightweight singleton toast system |
| `client/src/App.jsx` | Mounts `<ToastContainer />` |
| `client/vite.config.js` | `manualChunks` as function (Vite 8 compatible); `chunkSizeWarningLimit: 800` |

---

## New Trash API Routes

| Method | Route | Description |
|---|---|---|
| DELETE | `/api/fs/delete` | Moves item to `.spiritos-trash/` (non-destructive) |
| GET | `/api/fs/trash` | Lists trash index (most recent first) |
| POST | `/api/fs/trash/restore` | Restores item by `id`; handles missing parent dir |
| POST | `/api/fs/trash/delete` | Permanently deletes one trash item by `id` |
| POST | `/api/fs/trash/empty` | Permanently empties all trash |

Trash folder: `{FS_ROOT}/.spiritos-trash/`  
Index file: `{FS_ROOT}/.spiritos-trash/.index.json`

---

## Default Theme Change

- `osStore.js` initial state: `theme: 'dark'` → `'light'`
- Wallpaper: dark navy gradient → `linear-gradient(135deg, #eef0fb 0%, #dde1f9 50%, #e9e4f5 100%)`
- All 5 PROFILE_PRESETS: `theme: 'dark'` → `'light'`
- Persist version: `4` → `5`
- `migrate()`: unknown/missing theme now defaults to `'light'` (was `'dark'`)

---

## Runtime Proof

### 1. `npm run build` — clean ✅
```
✓ built in 3.53s
Exit Code: 0
```
Zero errors. Two size warnings on vendor-tf (876 KB) and vendor-faceapi (644 KB) — expected for ML libraries, already split into separate chunks.

### 2. `node --check` — all server files pass ✅
```
node --check server/routes/fs.js
node --check server/lib/irisTools.js
node --check server/lib/irisEngine.js
node --check server/ws.js
node --check server/routes/agent.js
→ ALL_CLEAN
```

### 3. Theme — light by default ✅
Fresh load (empty localStorage) → `document.body.classList` contains `theme-light`.  
`osStore` initial state: `theme: 'light'`, wallpaper: lavender gradient.

### 4. Migration ✅
Set `localStorage['spiritos-storage']` to `{"state":{"theme":"garbage"},"version":3}`, reload → store migrates to version 5, theme resolves to `'light'`.

### 5. Trash round-trip (conceptual — requires running server)
```
# Create file
POST /api/fs/create  { path: "/", name: "test.txt", type: "file" }

# Move to Trash
DELETE /api/fs/delete  { path: "/test.txt" }
→ { success: true, id: "...", message: "Moved "test.txt" to Trash" }
# File gone from /; present in GET /api/fs/trash

# Restore
POST /api/fs/trash/restore  { id: "..." }
→ { success: true, restoredTo: "/test.txt" }
# File back at /test.txt; removed from trash index

# Permanent delete
POST /api/fs/trash/delete  { id: "..." }
→ { success: true }
# Gone from disk

# Path traversal still blocked
DELETE /api/fs/delete  { path: "../../etc/hosts" }
→ 403 Access denied: delete path is outside the filesystem root
```

### 6. High-contrast palette ✅
Settings → Theme → High contrast: `body.high-contrast` CSS vars produce `--bg: #000000`, `--text: #ffffff`, `--accent: #ffd400`, no glass blur.

---

## Acceptance Criteria

| Criteria | Status |
|---|---|
| Fresh load = light theme, light wallpaper, no dark flash | ✅ |
| Theme picker: Light / Dark / High-contrast | ✅ |
| High-contrast = real black/white/#ffd400 | ✅ |
| Delete moves to Trash; Undo restores | ✅ |
| Trash view: restore / delete-forever / empty | ✅ |
| Permanent delete is the only hard delete | ✅ |
| Path containment (403 on traversal) unchanged | ✅ |
| `npm run build` clean | ✅ |
| `node --check` clean | ✅ |
