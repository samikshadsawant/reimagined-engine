/**
 * server/lib/irisTools.js — IRIS Tool Registry
 *
 * Maps tool names → handler functions that Gemini can invoke via
 * function-calling. Each handler receives the arguments object from
 * Gemini's tool call and returns a plain result object.
 *
 * Phase 1 implements: file management, system, notes, search (stub).
 * Phases 3-4 will add: vector search, vision/OCR, memory, web search,
 * desktop automation.
 */

const fs   = require('fs')
const path = require('path')
const { execSync } = require('child_process')
const _process = require('process')  // Reliable ref for Node 24

// ── Resolve the filesystem root (same as fs.js route) ───────────────────────
function fsRoot() {
  const raw = process.env.FS_ROOT
  if (raw && fs.existsSync(raw)) return path.resolve(raw)
  return require('os').homedir()
}

/**
 * Safely resolve a user-supplied path against FS_ROOT.
 * Prevents path-traversal above the root.
 */
function safePath(userPath) {
  const root = fsRoot()
  const resolved = path.resolve(root, userPath || '')
  if (!resolved.startsWith(root)) throw new Error('Path traversal blocked')
  return resolved
}

// ── Tool handler implementations ────────────────────────────────────────────

const handlers = {
  // ── File Management ─────────────────────────────────────────────────────
  async read_directory({ directory_path }) {
    const target = safePath(directory_path)
    const entries = fs.readdirSync(target, { withFileTypes: true })
    return entries.map(e => ({
      name: e.name,
      type: e.isDirectory() ? 'directory' : 'file',
      size: e.isFile() ? fs.statSync(path.join(target, e.name)).size : undefined
    }))
  },

  async create_folder({ folder_path }) {
    const target = safePath(folder_path)
    fs.mkdirSync(target, { recursive: true })
    return { created: target }
  },

  async read_file({ file_path }) {
    const target = safePath(file_path)
    const stat = fs.statSync(target)
    if (stat.size > 512 * 1024) return { error: 'File too large (>512 KB)' }
    const content = fs.readFileSync(target, 'utf-8')
    return { path: target, content, size: stat.size }
  },

  async write_file({ file_path, content }) {
    const target = safePath(file_path)
    // Ensure parent directory exists
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(target, content, 'utf-8')
    return { written: target, bytes: Buffer.byteLength(content) }
  },

  async manage_file({ action, source_path, destination_path, confirmed }) {
    const src = safePath(source_path)
    switch (action) {
      case 'delete':
        // Require explicit confirmation for destructive deletes
        if (!confirmed) {
          return {
            requiresConfirmation: true,
            message: `Are you sure you want to permanently delete "${source_path}"? This cannot be undone.`,
            confirmWith: { action: 'delete', source_path, confirmed: true }
          }
        }
        if (fs.statSync(src).isDirectory()) {
          fs.rmSync(src, { recursive: true, force: true })
        } else {
          fs.unlinkSync(src)
        }
        return { deleted: src }
      case 'rename':
      case 'move': {
        const dst = safePath(destination_path)
        fs.mkdirSync(path.dirname(dst), { recursive: true })
        fs.renameSync(src, dst)
        return { moved: src, to: dst }
      }
      case 'copy': {
        const dst = safePath(destination_path)
        fs.mkdirSync(path.dirname(dst), { recursive: true })
        fs.cpSync(src, dst, { recursive: true })
        return { copied: src, to: dst }
      }
      default:
        return { error: `Unknown action: ${action}` }
    }
  },

  // ── System ──────────────────────────────────────────────────────────────
  async open_app({ app_name }) {
    // Return action for the frontend to execute
    return { action: 'openApp', target: app_name }
  },

  async close_app({ app_name }) {
    return { action: 'closeApp', target: app_name }
  },

  async run_terminal({ command }) {
    // Safety: block destructive patterns
    const blocked = /\b(rm\s+-rf|format|del\s+\/[sf]|shutdown|reboot|mkfs)\b/i
    if (blocked.test(command)) {
      return { error: 'Command blocked for safety', command }
    }
    try {
      const output = execSync(command, {
        encoding: 'utf-8',
        timeout: parseInt(process.env.TERMINAL_TIMEOUT || '15000'),
        maxBuffer: parseInt(process.env.TERMINAL_MAX_OUTPUT || '50000'),
        windowsHide: true
      })
      return { command, output: output.trim() }
    } catch (err) {
      return { command, error: err.message, stderr: err.stderr?.trim() }
    }
  },

  // ── Notes ───────────────────────────────────────────────────────────────
  async save_note({ title, content }) {
    const notesDir = path.join(fsRoot(), 'SpiritOS Notes')
    fs.mkdirSync(notesDir, { recursive: true })
    const safeTitle = (title || 'note').replace(/[<>:"/\\|?*]/g, '_')
    const filePath = path.join(notesDir, `${safeTitle}.txt`)
    fs.writeFileSync(filePath, content || '', 'utf-8')
    return { saved: filePath }
  },

  async read_notes() {
    const notesDir = path.join(fsRoot(), 'SpiritOS Notes')
    if (!fs.existsSync(notesDir)) return { notes: [] }
    const files = fs.readdirSync(notesDir).filter(f => f.endsWith('.txt'))
    const notes = files.map(f => ({
      title: path.basename(f, '.txt'),
      content: fs.readFileSync(path.join(notesDir, f), 'utf-8'),
      path: path.join(notesDir, f)
    }))
    return { notes }
  },

  // ── Web Search (Tavily) ─────────────────────────────────────────────────
  async google_search({ query }) {
    const apiKey = _process.env.TAVILY_API_KEY
    if (!apiKey) {
      return {
        message: `Web search is not configured. Query: "${query}". ` +
                 `Add a TAVILY_API_KEY in .env to enable web search.`
      }
    }
    try {
      const res = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: apiKey,
          query,
          search_depth: 'basic',
          max_results: 5,
          include_answer: true
        })
      })
      if (!res.ok) throw new Error(`Tavily API error: ${res.status}`)
      const data = await res.json()
      return {
        answer: data.answer || null,
        results: (data.results || []).map(r => ({
          title: r.title,
          url: r.url,
          snippet: r.content?.substring(0, 200)
        }))
      }
    } catch (err) {
      return { error: `Web search failed: ${err.message}`, query }
    }
  },

  // ── Weather (wttr.in — free, no API key) ────────────────────────────────
  async weather_report({ city }) {
    try {
      const encoded = encodeURIComponent(city || 'auto')
      const res = await fetch(`https://wttr.in/${encoded}?format=j1`)
      if (!res.ok) throw new Error(`Weather API error: ${res.status}`)
      const data = await res.json()
      const cur = data.current_condition?.[0] || {}
      return {
        city: data.nearest_area?.[0]?.areaName?.[0]?.value || city,
        temp_c: cur.temp_C,
        temp_f: cur.temp_F,
        feels_like_c: cur.FeelsLikeC,
        condition: cur.weatherDesc?.[0]?.value,
        humidity: cur.humidity + '%',
        wind_kmph: cur.windspeedKmph,
        wind_dir: cur.winddir16Point
      }
    } catch (err) {
      return { error: `Weather lookup failed: ${err.message}`, city }
    }
  },

  // ── Memory (categorized persistence) ────────────────────────────────────
  async save_memory({ category, key, value }) {
    const memPath = path.join(__dirname, '..', 'data', 'memory.json')
    let mem = {}
    try { mem = JSON.parse(fs.readFileSync(memPath, 'utf-8')) } catch (_) {}
    const cat = category || 'notes'
    if (!mem[cat]) mem[cat] = {}
    mem[cat][key] = { value, ts: new Date().toISOString() }
    fs.mkdirSync(path.dirname(memPath), { recursive: true })
    fs.writeFileSync(memPath, JSON.stringify(mem, null, 2))
    return { saved: `${cat}/${key}` }
  },

  async recall_memory({ key, category }) {
    const memPath = path.join(__dirname, '..', 'data', 'memory.json')
    try {
      const mem = JSON.parse(fs.readFileSync(memPath, 'utf-8'))
      // If category specified, search within it
      if (category && mem[category]) {
        if (key && mem[category][key]) return { category, key, value: mem[category][key].value }
        return { category, memories: Object.entries(mem[category]).map(([k, v]) => ({ key: k, value: v.value })) }
      }
      // If just key, search all categories
      if (key) {
        for (const [cat, entries] of Object.entries(mem)) {
          if (entries[key]) return { category: cat, key, value: entries[key].value }
        }
        return { error: `No memory found for key: ${key}` }
      }
      // No key, no category — return everything
      const all = []
      for (const [cat, entries] of Object.entries(mem)) {
        for (const [k, v] of Object.entries(entries)) {
          all.push({ category: cat, key: k, value: v.value })
        }
      }
      return { memories: all }
    } catch (_) {
      return { memories: [] }
    }
  },

  // ── Vector Search ────────────────────────────────────────────────────────────
  async semantic_search({ query, top_k, min_score }) {
    const vs = require('./vectorSearch')
    const results = await vs.search(query, top_k || 5, min_score || 0.45)
    if (results.length === 0) {
      return { message: 'No matching files found. Try indexing a directory first with index_directory.', results: [] }
    }
    return {
      results: results.map(r => ({
        path:    r.path,
        name:    r.name,
        score:   Math.round(r.score * 100) / 100,
        preview: r.preview
      }))
    }
  },

  async index_directory({ directory_path, recursive }) {
    const vs = require('./vectorSearch')
    const target = safePath(directory_path)
    const stats = await vs.indexDirectory(target, recursive !== false ? 4 : 0)
    return {
      message: `Indexed ${stats.indexed} new files (${stats.skipped} skipped, ${stats.errors} errors) out of ${stats.total} total.`,
      ...stats
    }
  },

  // ── Vision & OCR ─────────────────────────────────────────────────────────────
  async capture_screen({ save_to_file }) {
    const { captureScreen } = require('./visionOcr')
    const result = await captureScreen({ save_to_file: !!save_to_file })
    return {
      message: save_to_file && result.savedPath
        ? `Screenshot saved to ${result.savedPath}`
        : 'Screenshot captured (not saved to disk)',
      size:      result.size,
      savedPath: result.savedPath || null,
      captured:  true
    }
  },

  async ocr_image({ file_path, lang }) {
    const { ocrImage } = require('./visionOcr')
    const result = await ocrImage({ file_path, lang: lang || 'eng' })
    return result
  },

  async analyze_screen({ prompt }) {
    const { captureAndAnalyze } = require('./visionOcr')
    const result = await captureAndAnalyze({ prompt })
    return { description: result.description }
  },

  async analyze_image({ file_path, prompt }) {
    const { analyzeImage } = require('./visionOcr')
    const result = await analyzeImage({ file_path, prompt })
    return result
  },

  // ── Document Parsing ──────────────────────────────────────────────────────────
  async parse_document({ file_path }) {
    const { parseDocument } = require('./docParser')
    const result = await parseDocument(file_path)
    return {
      text:      result.text.slice(0, 4000),
      length:    result.text.length,
      truncated: result.text.length > 4000,
      mimeType:  result.mimeType,
      pages:     result.pages || null,
      title:     result.title || null
    }
  },

  // ── Desktop Automation (Phase 4.1) ────────────────────────────────────────
  async run_workflow({ name }) {
    const auto = require('./desktopAutomation')
    return await auto.runWorkflow(name)
  },

  async create_workflow({ name, trigger, actions, conditions, enabled }) {
    const auto = require('./desktopAutomation')
    return await auto.createWorkflow({ name, trigger, actions, conditions, enabled })
  },

  async list_workflows() {
    const auto = require('./desktopAutomation')
    return { workflows: await auto.listWorkflows() }
  },

  async delete_workflow({ name }) {
    const auto = require('./desktopAutomation')
    return await auto.deleteWorkflow(name)
  },

  async schedule_task({ name, command, run_at_iso, delay_ms }) {
    const auto = require('./desktopAutomation')
    return auto.scheduleTask({ name, command, run_at_iso, delay_ms })
  },

  async list_scheduled() {
    const auto = require('./desktopAutomation')
    return { tasks: auto.listTasks() }
  },

  async cancel_scheduled({ task_id }) {
    const auto = require('./desktopAutomation')
    const ok = auto.cancelTask(task_id)
    return ok ? { cancelled: true, id: task_id } : { error: `Task not found: ${task_id}` }
  },

  // ── Biometric Vault (Phase 4.2) ───────────────────────────────────────────
  async vault_unlock({ pin }) {
    const v = require('./biometricVault')
    return v.vaultUnlock(pin)
  },

  async vault_add({ pin, category, label, secret, notes }) {
    const v = require('./biometricVault')
    return v.vaultAdd(pin, { category, label, secret, notes })
  },

  async vault_get({ pin, label }) {
    const v = require('./biometricVault')
    return v.vaultGet(pin, label)
  },

  async vault_list({ pin, category }) {
    const v = require('./biometricVault')
    return v.vaultList(pin, category)
  },

  async vault_delete({ pin, label }) {
    const v = require('./biometricVault')
    return v.vaultDelete(pin, label)
  },

  // ── Reminders ───────────────────────────────────────────────────────────
  async create_reminder({ title, time_of_day, body, days_mask }, context) {
    const prisma = require('./prisma')
    const userName = context?.sessionId || 'User'
    const created = await prisma.reminder.create({
      data: {
        userName,
        title,
        body: body || '',
        timeOfDay: time_of_day,
        daysMask: days_mask || '1111111',
        enabled: true,
        speakAloud: true
      }
    })
    return {
      message: `Created reminder "${title}" for ${time_of_day}`,
      reminder: created
    }
  },

  async list_reminders(_, context) {
    const prisma = require('./prisma')
    const userName = context?.sessionId || 'User'
    const items = await prisma.reminder.findMany({
      where: { userName },
      orderBy: { timeOfDay: 'asc' }
    })
    return { reminders: items }
  },

  async delete_reminder({ reminder_id, search_title }, context) {
    const prisma = require('./prisma')
    const userName = context?.sessionId || 'User'
    if (reminder_id) {
      const existing = await prisma.reminder.findFirst({ where: { id: reminder_id, userName } })
      if (!existing) return { error: `Reminder ID not found: ${reminder_id}` }
      await prisma.reminder.delete({ where: { id: reminder_id } })
      return { deleted: true, title: existing.title }
    } else if (search_title) {
      const needle = search_title.toLowerCase()
      const matches = await prisma.reminder.findMany({ where: { userName } })
      const target = matches.find(m => m.title.toLowerCase().includes(needle))
      if (!target) return { error: `No reminder found matching search: "${search_title}"` }
      await prisma.reminder.delete({ where: { id: target.id } })
      return { deleted: true, title: target.title }
    }
    return { error: 'Must provide reminder_id or search_title' }
  }
}

// ── Gemini Function Declarations (tool schemas) ─────────────────────────────
// These are passed to Gemini so it knows which tools are available.

const toolDeclarations = [
  {
    name: 'read_directory',
    description: 'List files and folders in a directory',
    parameters: {
      type: 'OBJECT',
      properties: {
        directory_path: { type: 'STRING', description: 'Path relative to the filesystem root' }
      },
      required: ['directory_path']
    }
  },
  {
    name: 'create_folder',
    description: 'Create a new folder/directory',
    parameters: {
      type: 'OBJECT',
      properties: {
        folder_path: { type: 'STRING', description: 'Path for the new folder, relative to filesystem root' }
      },
      required: ['folder_path']
    }
  },
  {
    name: 'read_file',
    description: 'Read the text content of a file (max 512KB)',
    parameters: {
      type: 'OBJECT',
      properties: {
        file_path: { type: 'STRING', description: 'Path to the file, relative to filesystem root' }
      },
      required: ['file_path']
    }
  },
  {
    name: 'write_file',
    description: 'Write content to a file (creates if not exists)',
    parameters: {
      type: 'OBJECT',
      properties: {
        file_path: { type: 'STRING', description: 'Path to the file' },
        content:   { type: 'STRING', description: 'Text content to write' }
      },
      required: ['file_path', 'content']
    }
  },
  {
    name: 'manage_file',
    description: 'Delete, rename/move, or copy a file or folder. Deletion requires confirmed=true.',
    parameters: {
      type: 'OBJECT',
      properties: {
        action:           { type: 'STRING', description: 'One of: delete, rename, move, copy' },
        source_path:      { type: 'STRING', description: 'Source file/folder path' },
        destination_path: { type: 'STRING', description: 'Destination path (for rename/move/copy)' },
        confirmed:        { type: 'BOOLEAN', description: 'Must be true to confirm destructive delete. Omit or false to get a confirmation prompt first.' }
      },
      required: ['action', 'source_path']
    }
  },
  {
    name: 'open_app',
    description: 'Open an application in SpiritOS (e.g. "notes", "calculator", "file explorer", "browser", "terminal", "settings", "reminders")',
    parameters: {
      type: 'OBJECT',
      properties: {
        app_name: { type: 'STRING', description: 'Name of the app to open' }
      },
      required: ['app_name']
    }
  },
  {
    name: 'close_app',
    description: 'Close an application in SpiritOS',
    parameters: {
      type: 'OBJECT',
      properties: {
        app_name: { type: 'STRING', description: 'Name of the app to close' }
      },
      required: ['app_name']
    }
  },
  {
    name: 'run_terminal',
    description: 'Run a terminal/shell command on the host OS (Windows). Destructive commands are blocked.',
    parameters: {
      type: 'OBJECT',
      properties: {
        command: { type: 'STRING', description: 'The shell command to execute' }
      },
      required: ['command']
    }
  },
  {
    name: 'save_note',
    description: 'Save a text note to the notes folder',
    parameters: {
      type: 'OBJECT',
      properties: {
        title:   { type: 'STRING', description: 'Title/filename for the note' },
        content: { type: 'STRING', description: 'Text content of the note' }
      },
      required: ['title', 'content']
    }
  },
  {
    name: 'read_notes',
    description: 'List and read all saved notes',
    parameters: {
      type: 'OBJECT',
      properties: {},
      required: []
    }
  },
  {
    name: 'google_search',
    description: 'Search the web for real-time information, news, facts, prices, or anything the user asks about. Uses Tavily search API.',
    parameters: {
      type: 'OBJECT',
      properties: {
        query: { type: 'STRING', description: 'Search query' }
      },
      required: ['query']
    }
  },
  {
    name: 'weather_report',
    description: 'Get the current weather for a city or location. Use this when the user asks about weather, temperature, or conditions.',
    parameters: {
      type: 'OBJECT',
      properties: {
        city: { type: 'STRING', description: 'City name (e.g. "Delhi", "New York", "London")' }
      },
      required: ['city']
    }
  },
  {
    name: 'save_memory',
    description: 'Silently save an important personal fact about the user to long-term memory. Call when the user reveals: name, age, city, job, preferences, hobbies, relationships, projects, or plans. Do NOT announce saving — just call silently.',
    parameters: {
      type: 'OBJECT',
      properties: {
        category: {
          type: 'STRING',
          description: 'identity | preferences | projects | relationships | wishes | notes'
        },
        key:   { type: 'STRING', description: 'Short snake_case key (e.g. name, favorite_food, sister_name)' },
        value: { type: 'STRING', description: 'Concise value (e.g. Ayush, pizza, React developer)' }
      },
      required: ['category', 'key', 'value']
    }
  },
  {
    name: 'recall_memory',
    description: 'Recall a previously stored memory by key and/or category, or list all memories',
    parameters: {
      type: 'OBJECT',
      properties: {
        key:      { type: 'STRING', description: 'Key to recall. Omit to list all.' },
        category: { type: 'STRING', description: 'Filter by category: identity, preferences, projects, relationships, wishes, notes' }
      },
      required: []
    }
  },
  {
    name: 'create_reminder',
    description: 'Create a new reminder/alarm with a title, time in 24-hour HH:mm format, and optional detail body',
    parameters: {
      type: 'OBJECT',
      properties: {
        title:       { type: 'STRING', description: 'Title of the reminder, e.g. "Take heart medicine"' },
        time_of_day: { type: 'STRING', description: 'Time of day in HH:mm 24-hour format, e.g. "08:30" or "21:00"' },
        body:        { type: 'STRING', description: 'Extra details or description, e.g. "Take one capsule with breakfast"' },
        days_mask:   { type: 'STRING', description: 'Repeat mask of 7 binary digits representing Sunday-Saturday repeats. Default is "1111111" (every day).' }
      },
      required: ['title', 'time_of_day']
    }
  },
  {
    name: 'list_reminders',
    description: 'Retrieve all set reminders/alarms for meds, meetings, or daily tasks',
    parameters: {
      type: 'OBJECT',
      properties: {},
      required: []
    }
  },
  {
    name: 'delete_reminder',
    description: 'Delete a reminder/alarm by its unique ID or by searching its title',
    parameters: {
      type: 'OBJECT',
      properties: {
        reminder_id:  { type: 'STRING', description: 'The unique database ID of the reminder' },
        search_title: { type: 'STRING', description: 'Search term in the reminder title to identify which one to delete' }
      },
      required: []
    }
  },
  // ── Phase 3: Vector Search ────────────────────────────────────────────────
  {
    name: 'semantic_search',
    description: 'Search indexed files semantically — finds files by meaning, not just keywords. Use when the user asks to find files about a topic.',
    parameters: {
      type: 'OBJECT',
      properties: {
        query:     { type: 'STRING', description: 'Natural language search query, e.g. "notes about my project deadline"' },
        top_k:     { type: 'NUMBER', description: 'Max results to return (default 5)' },
        min_score: { type: 'NUMBER', description: 'Minimum similarity score 0–1 (default 0.45)' }
      },
      required: ['query']
    }
  },
  {
    name: 'index_directory',
    description: 'Index a directory so its files can be found with semantic_search. Run this once on a folder before searching it.',
    parameters: {
      type: 'OBJECT',
      properties: {
        directory_path: { type: 'STRING', description: 'Path to the directory to index, relative to filesystem root' },
        recursive:      { type: 'BOOLEAN', description: 'Whether to index subdirectories (default true)' }
      },
      required: ['directory_path']
    }
  },
  // ── Phase 3: Vision & OCR ─────────────────────────────────────────────────
  {
    name: 'capture_screen',
    description: 'Take a screenshot of the current screen. Optionally save it to a file.',
    parameters: {
      type: 'OBJECT',
      properties: {
        save_to_file: { type: 'BOOLEAN', description: 'If true, saves the screenshot to the SpiritOS Screenshots folder' }
      },
      required: []
    }
  },
  {
    name: 'ocr_image',
    description: 'Extract text from an image file using OCR (Tesseract). Use when the user wants to read text from a photo or screenshot.',
    parameters: {
      type: 'OBJECT',
      properties: {
        file_path: { type: 'STRING', description: 'Path to the image file (jpg, png, etc.) relative to filesystem root' },
        lang:      { type: 'STRING', description: 'Tesseract language code, e.g. "eng", "fra", "deu" (default "eng")' }
      },
      required: ['file_path']
    }
  },
  {
    name: 'analyze_screen',
    description: 'Capture the screen and describe what is visible using AI vision. Use when the user asks "what do you see?" or "what is on my screen?"',
    parameters: {
      type: 'OBJECT',
      properties: {
        prompt: { type: 'STRING', description: 'What to look for or ask about the screen (optional)' }
      },
      required: []
    }
  },
  {
    name: 'analyze_image',
    description: 'Analyze or describe an image file using AI vision (Gemini). Can read text, describe scenes, identify objects.',
    parameters: {
      type: 'OBJECT',
      properties: {
        file_path: { type: 'STRING', description: 'Path to the image file relative to filesystem root' },
        prompt:    { type: 'STRING', description: 'What to ask about the image, e.g. "What text is in this image?"' }
      },
      required: ['file_path']
    }
  },
  // ── Phase 3: Document Parsing ─────────────────────────────────────────────
  {
    name: 'parse_document',
    description: 'Extract text content from a document file (PDF, DOCX, HTML, TXT, MD, etc.). Returns the text for reading or indexing.',
    parameters: {
      type: 'OBJECT',
      properties: {
        file_path: { type: 'STRING', description: 'Path to the document file relative to filesystem root' }
      },
      required: ['file_path']
    }
  },
  // ── Phase 4.1: Desktop Automation ────────────────────────────────────────
  {
    name: 'run_workflow',
    description: 'Run a saved automation workflow by name. Workflows can open apps, run commands, and send notifications.',
    parameters: {
      type: 'OBJECT',
      properties: {
        name: { type: 'STRING', description: 'Name of the workflow to run' }
      },
      required: ['name']
    }
  },
  {
    name: 'create_workflow',
    description: 'Create or update an automation workflow. A workflow is a named sequence of actions (open_app, run_command, notify) triggered manually or on a schedule.',
    parameters: {
      type: 'OBJECT',
      properties: {
        name:    { type: 'STRING', description: 'Unique workflow name' },
        trigger: { type: 'STRING', description: 'When to trigger: manual, schedule, file_create, directory_create' },
        actions: {
          type: 'ARRAY',
          description: 'List of actions. Each action: { type: "open_app"|"run_command"|"notify", target?: string, command?: string, message?: string }',
          items: {
            type: 'OBJECT',
            properties: {
              type:    { type: 'STRING',  description: 'Action type: open_app | run_command | notify' },
              target:  { type: 'STRING',  description: 'App name (for open_app)' },
              command: { type: 'STRING',  description: 'Shell command (for run_command)' },
              message: { type: 'STRING',  description: 'Notification text (for notify)' }
            },
            required: ['type']
          }
        },
        enabled: { type: 'BOOLEAN', description: 'Whether the workflow is active (default true)' }
      },
      required: ['name', 'actions']
    }
  },
  {
    name: 'list_workflows',
    description: 'List all saved automation workflows',
    parameters: { type: 'OBJECT', properties: {}, required: [] }
  },
  {
    name: 'delete_workflow',
    description: 'Delete an automation workflow by name',
    parameters: {
      type: 'OBJECT',
      properties: {
        name: { type: 'STRING', description: 'Name of the workflow to delete' }
      },
      required: ['name']
    }
  },
  {
    name: 'schedule_task',
    description: 'Schedule a shell command to run once at a future time. Use run_at_iso for a specific time or delay_ms for a relative delay.',
    parameters: {
      type: 'OBJECT',
      properties: {
        name:       { type: 'STRING', description: 'Friendly name for the task' },
        command:    { type: 'STRING', description: 'Shell command to run' },
        run_at_iso: { type: 'STRING', description: 'ISO 8601 datetime to run at, e.g. "2026-06-01T09:00:00"' },
        delay_ms:   { type: 'NUMBER', description: 'Milliseconds from now to run (alternative to run_at_iso)' }
      },
      required: ['command']
    }
  },
  {
    name: 'list_scheduled',
    description: 'List all pending scheduled tasks',
    parameters: { type: 'OBJECT', properties: {}, required: [] }
  },
  {
    name: 'cancel_scheduled',
    description: 'Cancel a pending scheduled task by its ID',
    parameters: {
      type: 'OBJECT',
      properties: {
        task_id: { type: 'STRING', description: 'Task ID returned by schedule_task' }
      },
      required: ['task_id']
    }
  },
  // ── Phase 4.2: Biometric Vault ────────────────────────────────────────────
  {
    name: 'vault_unlock',
    description: 'Unlock the secure vault with a PIN to verify access. Also initialises the vault on first use. Required before any vault operation.',
    parameters: {
      type: 'OBJECT',
      properties: {
        pin: { type: 'STRING', description: 'The vault PIN (minimum 4 characters)' }
      },
      required: ['pin']
    }
  },
  {
    name: 'vault_add',
    description: 'Add a new secret to the encrypted vault. Categories: passwords, pins, medical, insurance, financial, personal.',
    parameters: {
      type: 'OBJECT',
      properties: {
        pin:      { type: 'STRING', description: 'Vault PIN to authenticate' },
        category: { type: 'STRING', description: 'Category: passwords | pins | medical | insurance | financial | personal' },
        label:    { type: 'STRING', description: 'Name/label for this secret, e.g. "Gmail password" or "Blood type"' },
        secret:   { type: 'STRING', description: 'The secret value to store securely' },
        notes:    { type: 'STRING', description: 'Optional notes about this entry' }
      },
      required: ['pin', 'label', 'secret']
    }
  },
  {
    name: 'vault_get',
    description: 'Retrieve a secret from the vault by label. Returns the secret value. Requires PIN.',
    parameters: {
      type: 'OBJECT',
      properties: {
        pin:   { type: 'STRING', description: 'Vault PIN to authenticate' },
        label: { type: 'STRING', description: 'Label or partial label of the entry to retrieve' }
      },
      required: ['pin', 'label']
    }
  },
  {
    name: 'vault_list',
    description: 'List all vault entries (labels only, no secrets). Optionally filter by category.',
    parameters: {
      type: 'OBJECT',
      properties: {
        pin:      { type: 'STRING', description: 'Vault PIN to authenticate' },
        category: { type: 'STRING', description: 'Optional category filter: passwords | pins | medical | insurance | financial | personal' }
      },
      required: ['pin']
    }
  },
  {
    name: 'vault_delete',
    description: 'Delete a secret from the vault by label. Requires PIN.',
    parameters: {
      type: 'OBJECT',
      properties: {
        pin:   { type: 'STRING', description: 'Vault PIN to authenticate' },
        label: { type: 'STRING', description: 'Label of the entry to delete' }
      },
      required: ['pin', 'label']
    }
  }
]

// ── Registry: name → handler mapping ────────────────────────────────────────

const toolRegistry = {}
for (const decl of toolDeclarations) {
  if (handlers[decl.name]) {
    toolRegistry[decl.name] = handlers[decl.name]
  }
}

module.exports = { toolRegistry, toolDeclarations, handlers }
