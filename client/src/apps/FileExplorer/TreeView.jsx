/**
 * TreeView Component
 * Displays folder tree sidebar for FileExplorer
 */

import React, { useState, useEffect } from 'react'
import axios from 'axios'
import { ChevronRight, ChevronDown, Folder, FolderOpen } from 'lucide-react'

/**
 * TreeNode Component
 * @param {Object} props
 * @param {Object} props.node - Tree node
 * @param {string} props.path - Current path
 * @param {Function} props.onSelect - Callback when folder is selected
 * @param {number} props.depth - Nesting depth
 */
function TreeNode({ node, path, onSelect, depth = 0 }) {
  const [expanded, setExpanded] = useState(false)
  const [children, setChildren] = useState([])
  const [loading, setLoading] = useState(false)

  const isDirectory = node.type === 'directory'
  const isSelected = node.path === path || node.path === path + '/'

  useEffect(() => {
    if (expanded && isDirectory && children.length === 0) {
      loadChildren()
    }
  }, [expanded])

  const loadChildren = async () => {
    setLoading(true)
    try {
      const response = await axios.get(`/api/fs/list?path=${encodeURIComponent(node.path)}`)
      setChildren(response.data.children || [])
    } catch (err) {
      console.error('Failed to load children:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleClick = () => {
    if (isDirectory) {
      setExpanded(!expanded)
      onSelect(node.path)
    }
  }

  return (
    <div>
      <div
        className={`flex items-center gap-1 py-1 px-2 cursor-pointer hover:bg-os-bg-tertiary rounded ${
          isSelected ? 'bg-os-accent/20 text-os-accent' : 'text-os-text-primary'
        }`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={handleClick}
      >
        {/* Expand/collapse icon */}
        {isDirectory && (
          <span className="w-4 h-4 flex items-center justify-center">
            {expanded ? (
              <ChevronDown size={14} className="text-os-text-secondary" />
            ) : (
              <ChevronRight size={14} className="text-os-text-secondary" />
            )}
          </span>
        )}
        {!isDirectory && <span className="w-4" />}

        {/* Folder icon */}
        {isDirectory ? (
          expanded ? (
            <FolderOpen size={16} className="text-yellow-400" />
          ) : (
            <Folder size={16} className="text-yellow-400" />
          )
        ) : (
          <Folder size={16} className="text-os-text-secondary opacity-50" />
        )}

        {/* Name */}
        <span className="text-sm truncate">{node.name}</span>
      </div>

      {/* Children */}
      {expanded && isDirectory && (
        <div>
          {loading ? (
            <div
              className="text-xs text-os-text-secondary py-1"
              style={{ paddingLeft: `${(depth + 1) * 16 + 8}px` }}
            >
              Loading...
            </div>
          ) : (
            children
              .filter(c => c.type === 'directory')
              .map(child => (
                <TreeNode
                  key={child.path}
                  node={child}
                  path={path}
                  onSelect={onSelect}
                  depth={depth + 1}
                />
              ))
          )}
        </div>
      )}
    </div>
  )
}

/**
 * TreeView Component
 * @param {Object} props
 * @param {string} props.currentPath - Current directory path
 * @param {Function} props.onNavigate - Callback when folder is selected
 */
function TreeView({ currentPath, onNavigate }) {
  const [tree, setTree] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadTree()
  }, [])

  const loadTree = async () => {
    setLoading(true)
    try {
      const response = await axios.get('/api/fs/tree?depth=3')
      setTree(response.data)
    } catch (err) {
      console.error('Failed to load tree:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSelect = (path) => {
    onNavigate(path)
  }

  if (loading) {
    return (
      <div className="p-4 text-os-text-secondary text-sm">
        Loading...
      </div>
    )
  }

  if (!tree) {
    return (
      <div className="p-4 text-os-text-secondary text-sm">
        No folders available
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto py-2">
      <TreeNode
        node={tree}
        path={currentPath}
        onSelect={handleSelect}
        depth={0}
      />
    </div>
  )
}

export default TreeView