You are fixing critical security and runtime bugs in SavitaOS. Fix ONLY the issues listed below. Do not refactor, rename, or restructure unrelated code.

── CRITICAL FIX 1 — Auth guards on unprotected routes ──
Files: server/routes/upload.js, server/routes/terminal.js,
       server/routes/proxy.js, server/routes/whisper.js

Add requireAuth (or requireSession) middleware to:
  - POST /api/upload (upload.js)
  - POST /api/terminal/exec (terminal.js)
  - GET  /api/proxy (proxy.js)
  - POST /api/whisper/transcribe (whisper.js)

Import the middleware from ../middleware/auth and add it as the first
argument after the path string in each router.post / router.get call.

── CRITICAL FIX 2 — authRateLimiter memory leak + not applied ──
File: server/middleware/auth.js

1. Apply authRateLimiter to the auth router in server/routes/auth.js
   (add it to both POST /register and POST /login, before Zod validation).
2. Fix the in-memory Map leak: after filtering out expired entries,
   delete the Map key entirely if the resulting array is empty, so
   the Map doesn't accumulate dead keys for every unique IP forever.

── CRITICAL FIX 3 — SESSION_SECRET hardcoded fallback ──
File: server/index.js

Replace:
  secret: process.env.SESSION_SECRET || 'savitaos_demo_secret_change_me'
With:
  secret: (() => {
    if (!process.env.SESSION_SECRET)
      throw new Error('SESSION_SECRET env var is required');
    return process.env.SESSION_SECRET;
  })()

Also add SESSION_SECRET to .env.example with a placeholder value.

── CRITICAL FIX 4 — Rename route path traversal ──
File: server/routes/fs.js (rename handler, ~line 477)

After constructing newPath with path.join(dir, newName), add a
re-validation check:
  const resolvedNew = path.resolve(newPath);
  const resolvedRoot = path.resolve(FS_ROOT);
  if (!resolvedNew.startsWith(resolvedRoot + path.sep) &&
      resolvedNew !== resolvedRoot) {
    return res.status(403).json({ error: 'Destination outside FS_ROOT' });
  }
Place this check BEFORE the fs.renameSync call.

── CRITICAL FIX 5 — VoiceController undefined function calls ──
File: client/src/input/VoiceController.jsx (~line 188)

Import minimizeWindow and maximizeWindow from useWindowStore:
  const { minimizeWindow, maximizeWindow } = useWindowStore();
Add this line at the top of the VoiceController component body,
alongside other store destructures.

── CRITICAL FIX 6 — Remove real API key from .env ──
File: server/.env

Replace the real value of OPENAI_API_KEY with a placeholder:
  OPENAI_API_KEY=your_openai_api_key_here

Add server/.env to .gitignore if it isn't already there.
Also add a .env.example entry for OPENAI_API_KEY.

Four tabs — pick the right scope:
🔴 Critical (6 fixes) — paste this first, these are security holes and runtime crashes: unauthenticated upload/terminal/proxy/whisper routes, the authRateLimiter memory leak, hardcoded session secret, rename path traversal, minimizeWindow undefined in VoiceController, and the exposed API key in .env.
🟠 High (8 fixes) — broken logic: orphaned UserProfile fields never saved, AgentSession history overwriting itself every turn, the double-toggle bug in useAgent.js, and the gesture config split across two conflicting files.
🔵 Medium (10 fixes) — code quality: missing Zod validation on 5 routes, DEMO_FS_ROOT scattered in 3 files, the dead duplicate GestureController in useGesture.js, tree cache keyed incorrectly, and the missing Prisma indexes.
⚡ Full — all 24 fixes in one phased prompt, meant to be run as a single Claude Code session with commits after each phase.

Tip: If running in Claude Code, use the Full prompt and prepend Read the audit report first: [paste the audit doc path] so it has full context before touching any file.
