import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const {
  ACTION_REGISTRY,
  parseVoicePlanResponse,
  validateActionParams,
  validateVoicePlan
} = require('../../../server/lib/voicePlannerValidation.js')

test('registry IDs are unique and every action names its client executor', () => {
  const ids = ACTION_REGISTRY.map(({ id }) => id)
  assert.equal(new Set(ids).size, ids.length)
  assert.ok(ACTION_REGISTRY.every(({ description, params, risky, executor }) =>
    typeof description === 'string' && params && typeof risky === 'boolean' && typeof executor === 'string'
  ))
})

test('validates an allowed action and typed parameters', () => {
  const result = validateVoicePlan({
    action: 'app.open',
    params: { app: 'Calculator' },
    reply: 'Opening Calculator.'
  })
  assert.equal(result.valid, true)
  assert.equal(result.value.action, 'app.open')
  for (const app of ['Mail', 'KnownBook']) {
    assert.equal(validateActionParams(ACTION_REGISTRY.find(({ id }) => id === 'app.open'), { app }).valid, true)
  }
})

test('voice language schema accepts Tamil and rejects the removed Hinglish mode', () => {
  const action = ACTION_REGISTRY.find(({ id }) => id === 'voice.language')
  assert.equal(validateActionParams(action, { language: 'tamil' }).valid, true)
  assert.equal(validateActionParams(action, { language: 'hinglish-auto' }).valid, false)
})

test('rejects unknown actions, invalid types, missing values, and extra values', () => {
  assert.equal(validateVoicePlan({ action: 'terminal.run', params: { command: 'dir' }, reply: 'Done' }).valid, false)
  assert.equal(validateActionParams(ACTION_REGISTRY.find(({ id }) => id === 'app.open'), { app: 42 }).valid, false)
  assert.equal(validateActionParams(ACTION_REGISTRY.find(({ id }) => id === 'reminder.create'), { title: 'Water' }).valid, false)
  assert.equal(validateActionParams(ACTION_REGISTRY.find(({ id }) => id === 'reminder.delete'), { match: '' }).valid, false)
  assert.equal(validateActionParams(ACTION_REGISTRY.find(({ id }) => id === 'window.close_active'), { command: 'close' }).valid, false)
  assert.equal(validateActionParams(ACTION_REGISTRY.find(({ id }) => id === 'media.volume'), {}).valid, false)
})

test('validates registered file-operation parameters and rejects malformed file actions', () => {
  const examples = [
    ['file.open', { path: '/report.txt' }],
    ['file.rename', { oldPath: '/report.txt', newName: 'summary.txt' }],
    ['file.move', { sourcePath: '/report.txt', destPath: '/archive/report.txt' }],
    ['file.copy', { sourcePath: '/report.txt', destPath: '/archive/report.txt' }],
    ['file.delete', { path: '/report.txt' }]
  ]
  for (const [actionId, params] of examples) {
    const result = validateVoicePlan({ action: actionId, params, reply: 'Done.' })
    assert.equal(result.valid, true, actionId)
  }
  assert.equal(validateVoicePlan({
    action: 'file.rename',
    params: { oldPath: '/report.txt', newName: '' },
    reply: 'Renamed.'
  }).valid, false)
  assert.equal(validateVoicePlan({
    action: 'file.move',
    params: { sourcePath: '/report.txt' },
    reply: 'Moved.'
  }).valid, false)
})

test('parses only strict JSON planner objects', () => {
  const parsed = parseVoicePlanResponse('{"action":"window.close_active","params":{},"reply":"Done."}')
  assert.equal(parsed.valid, true)
  assert.equal(parseVoicePlanResponse('not JSON').valid, false)
  assert.equal(parseVoicePlanResponse('```json\\n{}\\n```').valid, false)
  assert.equal(parseVoicePlanResponse('{"action":"unknown","params":{},"reply":"Done."}').valid, false)
  assert.equal(parseVoicePlanResponse('{"action":null,"params":{},"reply":"कृपया स्पष्ट करें।"}').valid, true)
  assert.equal(parseVoicePlanResponse('{"action":null,"params":{"x":1},"reply":"No action"}').valid, false)
})
