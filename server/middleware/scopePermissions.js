/**
 * scopePermissions.js — Phase 6.1 (Fixed)
 *
 * Middleware that enforces path-based access control:
 *   READ  (GET)                      → allowed anywhere under FS_ROOT
 *   WRITE (POST, PUT, PATCH, DELETE) → restricted to user's home directory
 *
 * CRITICAL FIX: The old code used path.resolve(targetPath) which resolves
 * relative to the server's CWD (D:\codes\Savita_OS), not relative to FS_ROOT
 * (C:\Users\ayush). This caused ALL write operations to fail with 403.
 *
 * NEW BEHAVIOUR: If USER_HOME_ROOT is not explicitly set, writes are allowed
 * anywhere inside FS_ROOT (single-user desktop mode). When USER_HOME_ROOT is
 * set, writes are scoped to the user's subdirectory within it.
 */

const path = require('path')
const os   = require('os')

const FS_ROOT = process.env.FS_ROOT || os.homedir()
const USER_HOME_ROOT = process.env.USER_HOME_ROOT // undefined = single-user mode

/**
 * Returns the absolute path to a user's home directory.
 * In single-user mode (no USER_HOME_ROOT), returns FS_ROOT itself.
 */
function getUserHomeDir(userId) {
  if (!USER_HOME_ROOT) return path.resolve(FS_ROOT)
  return path.resolve(USER_HOME_ROOT, String(userId))
}

/**
 * Returns true if targetPath is equal to or inside the allowed directory.
 * Resolves targetPath relative to FS_ROOT to handle both absolute and
 * relative paths correctly on Windows (where drives differ).
 */
function isWithinHome(targetPath, userId) {
  const home = getUserHomeDir(userId)
  // If targetPath is already absolute, use it directly; otherwise resolve from FS_ROOT
  const resolved = path.isAbsolute(targetPath)
    ? path.resolve(targetPath)
    : path.resolve(FS_ROOT, targetPath)
  const normalHome = path.normalize(home).toLowerCase()
  const normalTarget = path.normalize(resolved).toLowerCase()
  return normalTarget === normalHome || normalTarget.startsWith(normalHome + path.sep)
}

/**
 * Express middleware — attaches to any route that accepts a `path` param.
 *
 * In single-user mode (no USER_HOME_ROOT), authentication is not required
 * and all writes within FS_ROOT are allowed. This makes the OS work like
 * a normal desktop where the user has full access to their home directory.
 */
module.exports = function scopePermissions(req, res, next) {
  // In single-user mode, skip auth entirely — just check path bounds.
  // Check all path fields: path, sourcePath, destPath, oldPath (move/rename/copy).
  if (!USER_HOME_ROOT) {
    const method = req.method.toUpperCase()
    const isWrite = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)

    if (isWrite) {
      const pathsToCheck = [
        req.body?.path,
        req.body?.sourcePath,
        req.body?.destPath,
        req.body?.oldPath
      ].filter(Boolean)

      for (const targetPath of pathsToCheck) {
        let resolved
        const cleaned = targetPath.replace(/^[\\/]+/, '')
        if (/^[A-Za-z]:/.test(cleaned)) {
          resolved = path.resolve(cleaned + '/')
        } else {
          resolved = path.resolve(path.join(FS_ROOT, cleaned))
        }
        const normalRoot   = path.normalize(FS_ROOT).toLowerCase()
        const normalTarget = path.normalize(resolved).toLowerCase()

        if (!(normalTarget === normalRoot || normalTarget.startsWith(normalRoot + path.sep))) {
          return res.status(403).json({
            error: 'Write access denied: path is outside the allowed root',
            allowedRoot: FS_ROOT,
            attempted: targetPath
          })
        }
      }
    }

    return next()
  }

  // Multi-user mode: require authentication
  const userId = req.session?.userName
  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' })
  }

  const targetPath = req.body?.path ?? req.query?.path
  if (!targetPath) return next()

  const method  = req.method.toUpperCase()
  const isWrite = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)

  if (isWrite && !isWithinHome(targetPath, userId)) {
    return res.status(403).json({
      error: 'Write access denied: path is outside your home directory',
      yourHome: getUserHomeDir(userId),
      attempted: targetPath
    })
  }

  next()
}
