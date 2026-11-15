const ACTION_REGISTRY = require('../../shared/voice-action-registry.json')
const ACTIONS_BY_ID = new Map(ACTION_REGISTRY.map((action) => [action.id, action]))

function validateActionParams(action, params) {
  if (!params || typeof params !== 'object' || Array.isArray(params)) {
    return { valid: false, error: 'Action params must be an object.' }
  }

  const definitions = action.params || {}
  const extraKeys = Object.keys(params).filter((key) => !Object.hasOwn(definitions, key))
  if (extraKeys.length) {
    return { valid: false, error: `Unexpected parameter: ${extraKeys[0]}` }
  }

  for (const [name, definition] of Object.entries(definitions)) {
    const value = params[name]
    if (value === undefined) {
      if (definition.required) return { valid: false, error: `Missing parameter: ${name}` }
      continue
    }

    if (typeof value !== definition.type || (definition.type === 'number' && !Number.isFinite(value))) {
      return { valid: false, error: `Parameter ${name} must be ${definition.type}.` }
    }
    if (definition.enum && !definition.enum.includes(value)) {
      return { valid: false, error: `Parameter ${name} has an unsupported value.` }
    }
    if (definition.maxLength && value.length > definition.maxLength) {
      return { valid: false, error: `Parameter ${name} is too long.` }
    }
    if (definition.minLength && value.length < definition.minLength) {
      return { valid: false, error: `Parameter ${name} is too short.` }
    }
    if (definition.minimum !== undefined && value < definition.minimum) {
      return { valid: false, error: `Parameter ${name} is too small.` }
    }
    if (definition.maximum !== undefined && value > definition.maximum) {
      return { valid: false, error: `Parameter ${name} is too large.` }
    }
  }

  if (action.id === 'media.volume' && params.direction === undefined && params.level === undefined) {
    return { valid: false, error: 'Volume direction or level is required.' }
  }
  if (action.id === 'web.open') {
    try {
      const url = new URL(params.url)
      if (!['http:', 'https:'].includes(url.protocol)) return { valid: false, error: 'Only web URLs can be opened.' }
    } catch {
      return { valid: false, error: 'A valid web URL is required.' }
    }
  }
  return { valid: true }
}

function validateVoicePlan(plan) {
  if (!plan || typeof plan !== 'object' || Array.isArray(plan)) {
    return { valid: false, error: 'Planner response must be an object.' }
  }
  const keys = Object.keys(plan)
  if (keys.length !== 3 || !['action', 'params', 'reply'].every((key) => Object.hasOwn(plan, key))) {
    return { valid: false, error: 'Planner response must contain only action, params, and reply.' }
  }
  if (plan.action !== null && typeof plan.action !== 'string') {
    return { valid: false, error: 'Planner action must be a string or null.' }
  }
  if (typeof plan.reply !== 'string' || !plan.reply.trim() || plan.reply.length > 500) {
    return { valid: false, error: 'Planner reply must be a short non-empty string.' }
  }
  if (plan.action === null) {
    if (!plan.params || typeof plan.params !== 'object' || Array.isArray(plan.params) || Object.keys(plan.params).length) {
      return { valid: false, error: 'A null action must have empty params.' }
    }
    return { valid: true, value: { action: null, params: {}, reply: plan.reply.trim() } }
  }

  const action = ACTIONS_BY_ID.get(plan.action)
  if (!action) return { valid: false, error: `Unknown action id: ${plan.action}` }
  const result = validateActionParams(action, plan.params)
  if (!result.valid) return result
  return {
    valid: true,
    value: { action: plan.action, params: plan.params, reply: plan.reply.trim() },
    actionDefinition: action
  }
}

function parseVoicePlanResponse(text) {
  if (typeof text !== 'string') return { valid: false, error: 'Planner response must be text.' }
  let parsed
  try {
    parsed = JSON.parse(text)
  } catch {
    return { valid: false, error: 'Planner response is not strict JSON.' }
  }
  return validateVoicePlan(parsed)
}

module.exports = {
  ACTION_REGISTRY,
  parseVoicePlanResponse,
  validateActionParams,
  validateVoicePlan
}
