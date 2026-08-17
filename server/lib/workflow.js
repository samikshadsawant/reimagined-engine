/**
 * Workflow Engine — Rule-based filesystem automation
 *
 * Supports triggers:
 *   - "directory_create" — fires when a new directory is created
 *   - "file_create"      — fires when a new file is created
 *   - "manual"           — only fires via API call
 *
 * Actions:
 *   - create_dir   { path }
 *   - create_file  { path, content }
 *
 * Placeholders in paths/content:
 *   {name}      — name of the triggering file/directory
 *   {parent}    — parent directory path
 *   {timestamp} — ISO timestamp
 */

const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const generateId = () => crypto.randomUUID()

// In-memory rule store (persisted to a JSON file so rules survive restarts)
const RULES_FILE = path.join(__dirname, '../data/workflow-rules.json')

// Ensure data directory exists
const dataDir = path.dirname(RULES_FILE)
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true })
}

/**
 * Load rules from disk
 */
function loadRules() {
  try {
    if (fs.existsSync(RULES_FILE)) {
      return JSON.parse(fs.readFileSync(RULES_FILE, 'utf-8'))
    }
  } catch (e) {
    console.error('[Workflow] Failed to load rules:', e.message)
  }
  return []
}

/**
 * Save rules to disk
 */
function saveRules(rules) {
  try {
    fs.writeFileSync(RULES_FILE, JSON.stringify(rules, null, 2), 'utf-8')
  } catch (e) {
    console.error('[Workflow] Failed to save rules:', e.message)
  }
}

/**
 * Replace placeholders in a string
 */
function interpolate(template, vars) {
  return template
    .replace(/\{name\}/g, vars.name || '')
    .replace(/\{parent\}/g, vars.parent || '')
    .replace(/\{timestamp\}/g, new Date().toISOString())
}

/**
 * Execute a single workflow action
 * @param {object} action   — { type, path, content }
 * @param {string} fsRoot   — absolute filesystem root
 * @param {object} vars     — interpolation variables
 * @returns {{ ok: boolean, detail: string }}
 */
function executeAction(action, fsRoot, vars) {
  const relPath = interpolate(action.path || '', vars)
  const fullPath = path.join(fsRoot, relPath)

  // Security: must stay within fsRoot
  if (!path.resolve(fullPath).startsWith(path.resolve(fsRoot))) {
    return { ok: false, detail: `Blocked: ${relPath} escapes root` }
  }

  try {
    switch (action.type) {
      case 'create_dir':
        fs.mkdirSync(fullPath, { recursive: true })
        return { ok: true, detail: `Created dir: ${relPath}` }

      case 'create_file': {
        // Ensure parent exists
        const dir = path.dirname(fullPath)
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
        const content = interpolate(action.content || '', vars)
        fs.writeFileSync(fullPath, content, 'utf-8')
        return { ok: true, detail: `Created file: ${relPath}` }
      }

      default:
        return { ok: false, detail: `Unknown action type: ${action.type}` }
    }
  } catch (err) {
    return { ok: false, detail: err.message }
  }
}

/**
 * Run all rules that match a given trigger + context
 * @param {string} trigger   — e.g. "directory_create"
 * @param {object} context   — { name, parentPath }
 * @param {string} fsRoot    — absolute filesystem root
 * @returns {Array<{ rule: string, results: Array }>}
 */
function runRules(trigger, context, fsRoot) {
  const rules = loadRules()
  const results = []

  for (const rule of rules) {
    if (!rule.enabled) continue
    if (rule.trigger !== trigger) continue

    // Check conditions (simple parentPath match)
    if (rule.conditions?.parentPath) {
      const normalised = context.parentPath?.replace(/\\/g, '/')
      if (!normalised?.startsWith(rule.conditions.parentPath)) continue
    }

    const vars = {
      name: context.name || '',
      parent: context.parentPath || ''
    }

    const actionResults = (rule.actions || []).map((a) => executeAction(a, fsRoot, vars))
    results.push({ rule: rule.name, id: rule.id, results: actionResults })
    console.log(`[Workflow] Rule "${rule.name}" fired:`, actionResults)
  }

  return results
}

// ---- CRUD helpers ---- //

function listRules() {
  return loadRules()
}

function getRule(id) {
  return loadRules().find((r) => r.id === id) || null
}

function createRule(data) {
  const rules = loadRules()
  const rule = {
    id: generateId(),
    name: data.name || 'Untitled Rule',
    trigger: data.trigger || 'manual',
    conditions: data.conditions || {},
    actions: data.actions || [],
    enabled: data.enabled !== false,
    createdAt: new Date().toISOString()
  }
  rules.push(rule)
  saveRules(rules)
  return rule
}

function updateRule(id, data) {
  const rules = loadRules()
  const idx = rules.findIndex((r) => r.id === id)
  if (idx === -1) return null
  rules[idx] = { ...rules[idx], ...data, id } // preserve id
  saveRules(rules)
  return rules[idx]
}

function deleteRule(id) {
  const rules = loadRules()
  const filtered = rules.filter((r) => r.id !== id)
  if (filtered.length === rules.length) return false
  saveRules(filtered)
  return true
}

module.exports = {
  loadRules,
  saveRules,
  runRules,
  listRules,
  getRule,
  createRule,
  updateRule,
  deleteRule,
  executeAction,
  interpolate
}
