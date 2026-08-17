You are fixing bugs in the SavitaOS codebase. Apply every fix below precisely.
Do not refactor anything beyond the described change.

───────────────────────────────────────────────────────
FIX 1 — ReferenceError: minimizeWindow / maximizeWindow
File: client/src/hooks/useVoice.js : line 30

Change:
  const { openWindow, closeWindow, focusWindow, windows } = useWindowStore()

To:
  const { openWindow, closeWindow, focusWindow, minimizeWindow, maximizeWindow, windows } = useWindowStore()

───────────────────────────────────────────────────────
FIX 2 — changeSetting toggle logic is broken (both branches do the same thing)
File: client/src/ai/useAgent.js : lines 138–149

Replace the gestureEnabled and voiceEnabled blocks:

  } else if (action.target === 'gestureEnabled') {
    if (action.value === 'true') {
      osStore.toggleGesture()
    } else {
      osStore.toggleGesture()
    }
  } else if (action.target === 'voiceEnabled') {
    if (action.value === 'true') {
      osStore.toggleVoice()
    } else {
      osStore.toggleVoice()
    }
  }

With:

  } else if (action.target === 'gestureEnabled') {
    osStore.setGestureEnabled(action.value === true || action.value === 'true')
  } else if (action.target === 'voiceEnabled') {
    osStore.setVoiceEnabled(action.value === true || action.value === 'true')
  }

(osStore already exposes setGestureEnabled and setVoiceEnabled — no store changes needed.)

───────────────────────────────────────────────────────
FIX 3 — alzheimerPhase never defined in Zustand store
File: client/src/store/osStore.js

In the initial state object (inside the persist/create block), add after
  signLanguageEnabled: false,
  pathGuidanceEnabled: false,

  alzheimerPhase: 0,   // 0=disabled, 1–5=severity (Phase 2.5)
  userRole: 'user',    // 'user' | 'caregiver'

Also add a setter action alongside the other toggles:
  setAlzheimerPhase: (phase) => set({ alzheimerPhase: Math.min(5, Math.max(0, phase)) }),
  setUserRole: (role) => set({ userRole: role }),

Also add both fields to the partialize list:
  alzheimerPhase: state.alzheimerPhase,
  userRole: state.userRole,

───────────────────────────────────────────────────────
FIX 4 — sign_model directory missing
Action: Run the sign language training script OR add a guard so the app does
not crash when the model is absent.

In client/src/input/SignLanguageController.jsx, find the tf.loadLayersModel call
and wrap it:

  try {
    model = await tf.loadLayersModel(MODEL_URL)
  } catch (err) {
    console.warn('[SignLanguage] Model not found at', MODEL_URL,
      '— run trainClassifier.js to generate it. Sign language disabled.')
    setModelError('Sign language model not trained yet. See docs/SAVITAOS_BUILD_GUIDE.md.')
    return
  }

Add a modelError state variable and render a user-visible warning in the UI
when modelError is set, instead of a blank/crashing overlay.

───────────────────────────────────────────────────────
FIX 5 — Terminal hardcoded to Windows
File: server/routes/terminal.js

Replace the static ALLOWED_COMMANDS list and the exec() call with a
platform-aware version:

const IS_WINDOWS = process.platform === 'win32'

const ALLOWED_COMMANDS = IS_WINDOWS
  ? ['ipconfig','ping','nslookup','tracert','netstat','netsh',
     'systeminfo','hostname','whoami','ver','date','time','echo',
     'dir','type','findstr','find','where','tree',
     'tasklist','taskkill','wmic','net statistics','net user',
     'set','path','cls','more']
  : ['ping','nslookup','traceroute','netstat',
     'hostname','whoami','uname','uptime','date','echo',
     'ls','cat','find','grep','which','tree',
     'ps','top','df','du','free',
     'env','printenv','pwd','id']

In exec(), replace:
  exec(command, { shell: 'cmd.exe', windowsHide: true, ... }, ...)

With:
  const shellOptions = IS_WINDOWS
    ? { shell: 'cmd.exe', windowsHide: true }
    : { shell: '/bin/sh' }

  exec(command, { timeout: EXEC_TIMEOUT, maxBuffer: MAX_OUTPUT, ...shellOptions,
                  env: { ...process.env, TERM: 'dumb' } }, ...)

Also update BLOCKED_PATTERNS to include Linux-specific destructive commands:
  /\brm\s+-rf?\s+\//i,
  /\bmkfs\b/i,
  /\bdd\s+if=/i,
  /\bsudo\b/i,
  /\bchmod\s+777\b/i,

───────────────────────────────────────────────────────
FIX 6 — Duplicate export in useGesture.js
File: client/src/hooks/useGesture.js : last 2 lines

Remove the redundant named export. Keep only:
  export default useGesture

Delete:
  export { useGesture }

───────────────────────────────────────────────────────
FIX 7 — gesture_recognizer HEAD pre-check is redundant
File: client/src/hooks/useGestureRecognizer.js : lines 52–58

Remove the HEAD fetch block entirely:

  // DELETE these lines:
  const modelCheck = await fetch(MODEL_PATH, { method: 'HEAD' })
  if (!modelCheck.ok) {
    throw new Error(`Gesture model not found at ${MODEL_PATH}...`)
  }

The GestureRecognizer.createFromOptions call below it will throw its own
descriptive error if the file is missing. Catching at that level is sufficient.

───────────────────────────────────────────────────────
FIX 8 — webgazer.js (5.4 MB) orphaned in client/public/
Action: Delete the file.

  rm client/public/webgazer.js

It is not referenced anywhere in the codebase (index.html tag was already removed)
and will be bundled into the production build unnecessarily at 5.4 MB.

───────────────────────────────────────────────────────
FIX 9 — window variable shadows global in windowStore.js
File: client/src/store/windowStore.js

In focusWindow (line ~104), rename the local variable:
  const window = state.windows.find(w => w.id === id)
→ const win = state.windows.find(w => w.id === id)

Update the null-guard below it accordingly:
  if (!win) return state

Apply the same rename in restoreWindow (~line 174):
  const window = state.windows.find(w => w.id === id)
→ const win = state.windows.find(w => w.id === id)
  if (!win) return state

───────────────────────────────────────────────────────
FIX 10 — Duplicate ANTHROPIC_API_KEY and conflicting MODEL_NAME in root .env.example
File: .env.example

1. Remove the duplicate ANTHROPIC_API_KEY= on line ~47 (keep the one on line ~6
   with value your_key_here and a comment pointing to console.anthropic.com).

2. Reconcile MODEL_NAME: root .env.example and server/.env.example must agree.
   Set both to:
     MODEL_NAME=claude-sonnet-4-20250514
   and add a comment:
     # Must match a model available on your ANTHROPIC_API_KEY

3. Remove the orphaned OPENAI_API_KEY and gpt-4o references from server/.env.example
   unless OpenAI is intentionally supported (confirm with ROADMAP.md — it is listed
   as Phase 3.1 optional). If keeping it, add a comment:
     # Optional — only needed if OLLAMA and Anthropic are both unavailable

───────────────────────────────────────────────────────
POST-FIX VERIFICATION CHECKLIST

After applying all fixes, confirm:
□ Voice "minimize" and "maximize" commands work without console errors
□ Agent "set gestureEnabled to false" actually turns gesture off, not on
□ alzheimerPhase persists through page reload when set to a non-zero value
□ Enabling signLanguageEnabled with no model shows a warning UI, not a crash
□ Running `node server/index.js` on Linux does not crash in terminal/exec
□ `npm run build` produces no bundle containing webgazer.js
□ ESLint reports no duplicate-export warning on useGesture.js
□ No "window is not defined" or shadow-variable warnings in windowStore