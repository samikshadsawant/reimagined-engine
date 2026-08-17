/**
 * Automation Routes — Phase 4.1
 * Mounted at /api/automation
 *
 * POST /api/automation/workflow/run      — run a workflow by name
 * POST /api/automation/workflow          — create/update a workflow
 * GET  /api/automation/workflow          — list all workflows
 * DELETE /api/automation/workflow/:name  — delete a workflow
 * POST /api/automation/schedule          — schedule a one-shot task
 * GET  /api/automation/schedule          — list pending tasks
 * DELETE /api/automation/schedule/:id   — cancel a task
 */

const express = require('express')
const router  = express.Router()
const { z }   = require('zod')
const auto    = require('../lib/desktopAutomation')

// ── Workflow routes ───────────────────────────────────────────────────────────

router.post('/workflow/run', async (req, res) => {
  try {
    const { name } = z.object({ name: z.string().min(1) }).parse(req.body)
    const result = await auto.runWorkflow(name, { sessionId: req.session?.anonId || 'User' })
    res.json(result)
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: 'Invalid', details: err.errors })
    res.status(500).json({ error: err.message })
  }
})

router.post('/workflow', async (req, res) => {
  try {
    const schema = z.object({
      name:       z.string().min(1).max(100),
      trigger:    z.enum(['manual', 'file_create', 'directory_create', 'schedule']).optional().default('manual'),
      actions:    z.array(z.object({
        type:    z.string(),
        command: z.string().optional(),
        target:  z.string().optional(),
        message: z.string().optional()
      })).min(1),
      conditions: z.record(z.any()).optional().default({}),
      enabled:    z.boolean().optional().default(true)
    })
    const data = schema.parse(req.body)
    const result = await auto.createWorkflow(data)
    res.status(result.created ? 201 : 200).json(result)
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: 'Invalid', details: err.errors })
    res.status(500).json({ error: err.message })
  }
})

router.get('/workflow', async (req, res) => {
  try {
    const workflows = await auto.listWorkflows()
    res.json(workflows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.delete('/workflow/:name', async (req, res) => {
  try {
    const result = await auto.deleteWorkflow(req.params.name)
    if (result.error) return res.status(404).json(result)
    res.json(result)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── Scheduled task routes ─────────────────────────────────────────────────────

router.post('/schedule', (req, res) => {
  try {
    const schema = z.object({
      name:       z.string().optional(),
      command:    z.string().min(1),
      run_at_iso: z.string().optional(),
      delay_ms:   z.number().int().min(1000).optional()
    }).refine(d => d.run_at_iso || d.delay_ms, {
      message: 'Must provide run_at_iso or delay_ms'
    })
    const data = schema.parse(req.body)
    const task = auto.scheduleTask(data)
    res.status(201).json(task)
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: 'Invalid', details: err.errors })
    res.status(500).json({ error: err.message })
  }
})

router.get('/schedule', (req, res) => {
  res.json(auto.listTasks())
})

router.delete('/schedule/:id', (req, res) => {
  const cancelled = auto.cancelTask(req.params.id)
  if (!cancelled) return res.status(404).json({ error: 'Task not found' })
  res.json({ cancelled: true, id: req.params.id })
})

module.exports = router
