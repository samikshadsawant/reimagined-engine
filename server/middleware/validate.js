/**
 * Validation Middleware
 * Zod-based request validation
 */

const { z } = require('zod')

/**
 * Create validation middleware for a specific schema
 * @param {z.ZodSchema} schema - Zod schema to validate against
 * @param {string} source - 'body' | 'query' | 'params'
 * @returns {Function} Express middleware
 */
function validate(schema, source = 'body') {
  return (req, res, next) => {
    try {
      const data = req[source]
      const result = schema.parse(data)
      req.validated = result
      next()
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Validation failed',
          details: err.errors.map(e => ({
            path: e.path.join('.'),
            message: e.message
          }))
        })
      }
      next(err)
    }
  }
}

/**
 * Common validation schemas
 */
const schemas = {
  // File operations
  pathParam: z.object({
    path: z.string().optional()
  }),

  // Agent chat — 4000 chars to accommodate voice transcripts
  chatMessage: z.object({
    message: z.string().min(1).max(4000),
    // Every inner field is optional. Anything else is allowed via passthrough
    // so the client can attach extra metadata without breaking validation.
    osState: z.object({
      openWindows:        z.array(z.string()).optional(),
      focusedWindow:      z.string().nullable().optional(),
      userProfile:        z.string().optional(),
      theme:              z.string().optional(),
      fontSize:           z.string().optional(),
      fontWeight:         z.string().optional(),
      contrast:           z.string().optional(),
      cursorSize:         z.string().optional(),
      gestureEnabled:     z.boolean().optional(),
      voiceEnabled:       z.boolean().optional(),
      eyeTrackingEnabled: z.boolean().optional(),
      sessionHistory: z.array(z.object({
        role:    z.string(),
        content: z.string()
      })).optional(),
      userName:         z.string().optional(),
      currentDirectory: z.string().optional()
    }).passthrough().optional()
  }),

  // Profile
  profileUpdate: z.object({
    profileName: z.string(),
    customSettings: z.record(z.any()).optional()
  }),

  // Auth
  login: z.object({
    userName: z.string().min(1),
    password: z.string().min(1)
  }),

  register: z.object({
    userName: z.string().min(1).max(50),
    password: z.string().min(6).max(100)
  })
}

/**
 * Validate with custom validator
 * @param {Function} validator - Custom validation function
 * @returns {Function} Express middleware
 */
function validateCustom(validator) {
  return (req, res, next) => {
    try {
      const result = validator(req)
      if (!result.valid) {
        return res.status(400).json({
          error: result.error || 'Validation failed'
        })
      }
      next()
    } catch (err) {
      next(err)
    }
  }
}

module.exports = {
  validate,
  validateCustom,
  schemas
}