/**
 * SavitaOS DFS Traversal Algorithm
 * Time Complexity: O(N log N)
 *
 * For a filesystem tree with N nodes:
 * - Each node is visited exactly once: O(N)
 * - At each directory, its k children are sorted: O(k log k)
 * - Summing the sort costs over all directories gives O(N log N)
 *   because Σ k_i = N (each file/dir is a child of exactly one parent)
 *   and the dominant term of Σ(k_i log k_i) ≤ N log N
 *
 * Note: E (edges) ≈ N in a tree (|E| = |V| - 1), so O(E log N) = O(N log N).
 * The "harmonic series convergence" argument in the old comment was incorrect
 * for a bounded-depth filesystem; O(N log N) is the correct statement.
 */

const fs = require('fs')
const path = require('path')

/**
 * DFS file system traversal
 * @param {string} rootPath - Starting directory path
 * @param {Object} options - Traversal options
 * @param {number} options.maxDepth - Maximum depth to traverse (default: 4)
 * @param {boolean} options.showHidden - Include hidden files (default: false)
 * @param {boolean} options.includeMetadata - Include file metadata (default: true)
 * @returns {Object} Tree structure
 */
function dfsTraverse(rootPath, options = {}) {
  const { maxDepth = 4, showHidden = false, includeMetadata = true } = options

  const visited = new Set()

  function traverse(currentPath, depth) {
    if (depth > maxDepth) return null

    try {
      const name = path.basename(currentPath) || currentPath
      const stats = fs.statSync(currentPath)

      /** @type {Object} */
      const node = {
        name,
        path: currentPath,
        type: stats.isDirectory() ? 'directory' : 'file',
        ...(includeMetadata && {
          size: stats.size,
          modified: stats.mtime.toISOString(),
          extension: stats.isFile() ? path.extname(name).toLowerCase() : null
        })
      }

      // Check for cycles
      const realPath = fs.realpathSync(currentPath)
      if (visited.has(realPath)) {
        return { ...node, error: 'Circular symlink detected' }
      }
      visited.add(realPath)

      if (stats.isDirectory()) {
        // Read directory contents
        const entries = fs.readdirSync(currentPath, { withFileTypes: true })

        // Sort entries alphabetically - this gives us O(log N) factor
        entries.sort((a, b) => a.name.localeCompare(b.name))

        // Filter hidden files if needed
        const filteredEntries = showHidden
          ? entries
          : entries.filter(e => !e.name.startsWith('.'))

        // Recursively traverse children
        /** @type {Array} */
        const children = []
        for (const entry of filteredEntries) {
          const childPath = path.join(currentPath, entry.name)
          const childNode = traverse(childPath, depth + 1)
          if (childNode) {
            children.push(childNode)
          }
        }

        node.children = children
      }

      return node
    } catch (err) {
      // Return error node instead of crashing
      return {
        name: path.basename(currentPath),
        path: currentPath,
        type: 'error',
        error: err.message
      }
    }
  }

  return traverse(rootPath, 0)
}

/**
 * Flatten tree to array
 * @param {Object} tree - Tree structure
 * @returns {Array} Flat array of all nodes
 */
function flattenTree(tree) {
  const result = []

  /** @param {Object} node */
  function walk(node) {
    if (!node) return

    // Add current node (exclude error nodes from search)
    if (!node.error || node.type !== 'error') {
      result.push({
        name: node.name,
        path: node.path,
        type: node.type,
        size: node.size,
        extension: node.extension
      })
    }

    // Recurse children
    if (node.children) {
      for (const child of node.children) {
        walk(child)
      }
    }
  }

  walk(tree)
  return result
}

/**
 * Search tree for matching nodes
 * @param {Object} tree - Tree structure
 * @param {string} query - Search query (case-insensitive)
 * @returns {Array} Matching nodes
 */
function searchTree(tree, query) {
  const flat = flattenTree(tree)
  const lowerQuery = query.toLowerCase()
  return flat.filter(node => node.name.toLowerCase().includes(lowerQuery))
}

/**
 * Get statistics for a tree
 * @param {Object} tree - Tree structure
 * @returns {Object} Statistics
 */
function getStats(tree) {
  let totalFiles = 0
  let totalDirs = 0
  let totalSize = 0
  let deepestPath = ''
  let maxDepth = 0

  /** @param {Object} node */
  /** @param {number} depth */
  function walk(node, depth) {
    if (!node) return

    if (node.error) {
      // Skip error nodes
    } else if (node.type === 'file') {
      totalFiles++
      totalSize += node.size || 0
    } else if (node.type === 'directory') {
      totalDirs++
    }

    if (depth > maxDepth) {
      maxDepth = depth
      deepestPath = node.path
    }

    if (node.children) {
      for (const child of node.children) {
        walk(child, depth + 1)
      }
    }
  }

  walk(tree, 0)

  return {
    totalFiles,
    totalDirs,
    totalSize,
    deepestPath,
    maxDepth
  }
}

module.exports = {
  dfsTraverse,
  flattenTree,
  searchTree,
  getStats
}