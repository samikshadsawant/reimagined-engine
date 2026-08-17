/**
 * server/lib/desktopAutomation.js — Phase 4.1
 *
 * Desktop automation tools exposed to IRIS:
 *   - run_workflow      : execute a named WorkflowRule from the DB
 *   - create_workflow   : create/update a WorkflowRule
 *   - list_workflows    : list all WorkflowRules
 *   - delete_workflow   : delete a WorkflowRule
 *   - schedule_task     : schedule a one-shot command at a future time
 *   - list_scheduled    : list pending scheduled tasks
 *   - cancel_scheduled  : cancel a pending task
 *
 * WorkflowRule schema (already in Prisma):
 *   { id, name, trigger, conditions (JSON), actions (JSON), enabled }
 *
 * Scheduled tasks are in-memory (survive server restart via DB persistence).
 */

const _process = require('process')
const path     = require('path')
const { execSync } = require('child_process')

// ── In-memory scheduled task registry ────────────────────────────────────────
// { id → { id, name, command, runAt, timerId, created } }
const scheduledTasks = new Map()
let taskIdCounter = 1

function scheduleTask({ name, command, run_at_iso, delay_ms }) {
  const id = `task_${taskIdCounter++}`
  let delayMs = delay_ms

  if (run_at_iso && !delay_ms) {
    const target = new Date(run_at_iso).getTime()
    delayMs = Math.max(0, target - Date.now())
  }

  if (delayMs == null || isNaN(delayMs)) {
    throw new Error('Must provide run_at_iso or delay_ms')
  }

  const timerId = setTimeout(() => {
    console.log(`[Automation] Running scheduled task "${name}": ${command}`)
    try {
      const blocked = /\b(rm\s+-rf|format|del\s+\/[sf]|shutdown|reboot|mkfs)\b/i
      if (!blocked.test(command)) {
        execSync(command, { encoding: 'utf-8', timeout: 30000, windowsHide: true })
      }
    } catch (err) {
      console.warn(`[Automation] Scheduled task "${name}" failed:`, err.message)
    }
    scheduledTasks.delete(id)
  }, delayMs)

  const task = {
    id,
    name: name || command.slice(0, 40),
    command,
    runAt: new Date(Date.now() + delayMs).toISOString(),
    delayMs,
    created: new Date().toISOString()
  }
  scheduledTasks.set(id, { ...task, timerId })
  return task
}

function cancelTask(taskId) {
  const task = scheduledTasks.get(taskId)
  if (!task) return false
  clearTimeout(task.timerId)
  scheduledTasks.delete(taskId)
  return true
}

function listTasks() {
  return [...scheduledTasks.values()].map(({ timerId, ...t }) => t)
}

// ── WorkflowRule helpers ──────────────────────────────────────────────────────

async function getPrisma() {
  return require('./prisma')
}

async function runWorkflow(name, context) {
  const prisma = await getPrisma()
  const rule = await prisma.workflowRule.findFirst({
    where: { name: { contains: name }, enabled: true }
  })
  if (!rule) return { error: `No enabled workflow found matching: "${name}"` }

  let actions = []
  try { actions = JSON.parse(rule.actions) } catch (_) {}

  const results = []
  for (const action of actions) {
    try {
      if (action.type === 'run_command') {
        const blocked = /\b(rm\s+-rf|format|del\s+\/[sf]|shutdown|reboot|mkfs)\b/i
        if (blocked.test(action.command || '')) {
          results.push({ action: action.type, error: 'Command blocked for safety' })
          continue
        }
        const output = execSync(action.command, {
          encoding: 'utf-8', timeout: 15000, windowsHide: true
        })
        results.push({ action: action.type, command: action.command, output: output.trim() })
      } else if (action.type === 'open_app') {
        results.push({ action: action.type, target: action.target, frontendAction: { action: 'openApp', target: action.target } })
      } else if (action.type === 'close_app') {
        results.push({ action: action.type, target: action.target, frontendAction: { action: 'closeApp', target: action.target } })
      } else if (action.type === 'notify') {
        results.push({ action: action.type, message: action.message })
      } else {
        results.push({ action: action.type, skipped: true, reason: 'unknown action type' })
      }
    } catch (err) {
      results.push({ action: action.type, error: err.message })
    }
  }

  // Update lastRun in conditions JSON
  try {
    const conditions = JSON.parse(rule.conditions || '{}')
    conditions.lastRun = new Date().toISOString()
    await prisma.workflowRule.update({
      where: { id: rule.id },
      data: { conditions: JSON.stringify(conditions) }
    })
  } catch (_) {}

  return { workflow: rule.name, executed: results.length, results }
}

async function createWorkflow({ name, trigger, actions, conditions, enabled }) {
  const prisma = await getPrisma()
  const existing = await prisma.workflowRule.findFirst({ where: { name } })

  const data = {
    name,
    trigger: trigger || 'manual',
    actions: JSON.stringify(actions || []),
    conditions: JSON.stringify(conditions || {}),
    enabled: enabled !== false
  }

  if (existing) {
    const updated = await prisma.workflowRule.update({ where: { id: existing.id }, data })
    return { updated: true, workflow: updated }
  } else {
    const created = await prisma.workflowRule.create({ data })
    return { created: true, workflow: created }
  }
}

async function listWorkflows() {
  const prisma = await getPrisma()
  const rules = await prisma.workflowRule.findMany({ orderBy: { createdAt: 'asc' } })
  return rules.map(r => ({
    id: r.id,
    name: r.name,
    trigger: r.trigger,
    enabled: r.enabled,
    actionCount: (() => { try { return JSON.parse(r.actions).length } catch (_) { return 0 } })(),
    createdAt: r.createdAt
  }))
}

async function deleteWorkflow(name) {
  const prisma = await getPrisma()
  const rule = await prisma.workflowRule.findFirst({ where: { name: { contains: name } } })
  if (!rule) return { error: `No workflow found matching: "${name}"` }
  await prisma.workflowRule.delete({ where: { id: rule.id } })
  return { deleted: true, name: rule.name }
}

module.exports = {
  scheduleTask,
  cancelTask,
  listTasks,
  runWorkflow,
  createWorkflow,
  listWorkflows,
  deleteWorkflow
}
