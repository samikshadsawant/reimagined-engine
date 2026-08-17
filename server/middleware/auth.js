/**
 * Auth Middleware
 * Session and authentication verification
 */

/**
 * Check if user is authenticated
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @param {Function} next - Express next
 */
function requireAuth(req, res, next) {
  if (req.session && req.session.userName) {
    req.user = {
      userName: req.session.userName
    }
    next()
  } else {
    res.status(401).json({
      error: 'Authentication required',
      message: 'Please log in to access this resource'
    })
  }
}

/**
 * Optional authentication (doesn't fail if not logged in)
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @param {Function} next - Express next
 */
function optionalAuth(req, res, next) {
  if (req.session && req.session.userName) {
    req.user = {
      userName: req.session.userName
    }
  }
  next()
}

/**
 * Check for admin role (for future use)
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @param {Function} next - Express next
 */
function requireAdmin(req, res, next) {
  if (req.session && req.session.userName === 'admin') {
    next()
  } else {
    res.status(403).json({
      error: 'Admin access required'
    })
  }
}

/**
 * Rate limiter for auth endpoints
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @param {Function} next - Express next
 */
const authRateLimiter = (() => {
  const attempts = new Map()

  return (req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress
    const now = Date.now()
    const windowMs = 15 * 60 * 1000 // 15 minutes
    const maxAttempts = 5

    const userAttempts = attempts.get(ip) || []

    // Filter old attempts — FIX 2: delete the key entirely when empty to prevent Map leak
    const recentAttempts = userAttempts.filter(t => now - t < windowMs)

    if (recentAttempts.length >= maxAttempts) {
      return res.status(429).json({
        error: 'Too many attempts',
        message: 'Please try again later'
      })
    }

    // Add this attempt
    recentAttempts.push(now)
    if (recentAttempts.length === 0) {
      attempts.delete(ip)   // FIX 2: evict dead key
    } else {
      attempts.set(ip, recentAttempts)
    }

    next()
  }
})()

/**
 * Session refresh middleware
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @param {Function} next - Express next
 */
function refreshSession(req, res, next) {
  if (req.session) {
    // Touch the session to extend it
    req.session.touch()
  }
  next()
}

module.exports = {
  requireAuth,
  optionalAuth,
  requireAdmin,
  authRateLimiter,
  refreshSession
}