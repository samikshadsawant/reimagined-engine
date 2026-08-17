# SavitaOS — Development Roadmap

## Phase 5 — Orphaned Model Implementation (FIX H6)

These two Prisma models are fully defined in `schema.prisma` but have no active consumers yet.
They are intentional scaffolding for upcoming phases.

---

### AgentSession (Phase 5.1 — Persistent Conversation History)

**Model location:** `server/prisma/schema.prisma`
**Planned consumer:** `server/routes/agent.js`

**Implementation plan:**
1. On `POST /api/agent/chat`: look up or create an `AgentSession` by `req.session.userName`
2. Load `history` JSON from the DB and pass to `orchestrate()` as `sessionHistory`
3. After the response, append the exchange to `history` and save back via `prisma.agentSession.update()`
4. This replaces the current in-memory `updateSessionHistory()` which is lost on restart

```js
// Sketch — server/routes/agent.js
const session = await prisma.agentSession.upsert({
  where:  { sessionId: req.session.userName },
  create: { sessionId: req.session.userName, history: '[]' },
  update: {}
})
const history = JSON.parse(session.history || '[]')
// ... after response ...
await prisma.agentSession.update({
  where: { sessionId: req.session.userName },
  data:  { history: JSON.stringify([...history, { role: 'user', content: message }, { role: 'assistant', content: result.message }]) }
})
```

---

### FileActivity (Phase 4.3 — Audit Log)

**Model location:** `server/prisma/schema.prisma`
**Planned consumer:** `server/routes/fs.js`

**Implementation plan:**
1. After each successful create/write/delete/rename, call:
```js
await prisma.fileActivity.create({
  data: { path: reqPath, action: 'create' | 'delete' | 'write' | 'rename', userName: req.session.userName }
})
```
2. Expose a `GET /api/fs/activity` route that returns recent activity for the current user
3. Display in the FileExplorer sidebar as a "Recent Activity" panel

---

## Other Planned Phases

| Phase | Feature | Status |
|-------|---------|--------|
| 1.2 | Vision path guidance | Scaffolded |
| 2.5 | Alzheimer caregiver dashboard | In progress |
| 3.2 | Multilingual voice (voiceLocale) | Scaffolded |
| 4.1 | Workflow automation UI | Done |
| 4.2 | Scope-based FS permissions | Done |
| 4.3 | File activity audit log | Scaffolded |
| 5.1 | Persistent agent sessions | Scaffolded |
