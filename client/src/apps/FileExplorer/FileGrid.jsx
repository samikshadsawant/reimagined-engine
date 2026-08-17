/**
 * FileGrid Component
 * Displays files/folders in grid or list view for FileExplorer
 */

import React from 'react'
import {
  Folder,
  File,
  FileText,
  FileCode,
  Image,
  Video,
  Music,
  Archive,
  FileSpreadsheet
} from 'lucide-react'

/**
 * Get file icon based on extension
 * @param {string} name - File name
 * @param {string} type - File type
 * @returns {React.ReactNode} Icon component
 */
function getFileIcon(name, type) {
  if (type === 'directory') {
    return <Folder className="text-yellow-400" size={24} />
  }

  const ext = name.split('.').pop()?.toLowerCase()

  // Text files
  if (['txt', 'md', 'json', 'xml', 'yaml', 'yml'].includes(ext)) {
    return <FileText className="text-blue-400" size={24} />
  }

  // Code files
  if (['js', 'ts', 'jsx', 'tsx', 'py', 'html', 'css', 'scss', 'java', 'c', 'cpp', 'go', 'rs'].includes(ext)) {
    return <FileCode className="text-green-400" size={24} />
  }

  // Images
  if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp', 'ico'].includes(ext)) {
    return <Image className="text-purple-400" size={24} />
  }

  // Videos
  if (['mp4', 'webm', 'avi', 'mov', 'mkv'].includes(ext)) {
    return <Video className="text-red-400" size={24} />
  }

  // Audio
  if (['mp3', 'wav', 'ogg', 'flac', 'aac'].includes(ext)) {
    return <Music className="text-orange-400" size={24} />
  }

  // Archives
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) {
    return <Archive className="text-yellow-600" size={24} />
  }

  // Spreadsheets
  if (['xls', 'xlsx', 'csv'].includes(ext)) {
    return <FileSpreadsheet className="text-green-600" size={24} />
  }

  // Default
  return <File className="text-os-text-secondary" size={24} />
}

/**
 * Format file size
 * @param {number} bytes - Size in bytes
 * @returns {string} Formatted size
 */
function formatSize(bytes) {
  if (!bytes) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

/**
 * Format date
 * @param {string} dateString - ISO date string
 * @returns {string} Formatted date
 */
function formatDate(dateString) {
  if (!dateString) return '-'
  const date = new Date(dateString)
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

/**
 * Grid item component
 * @param {Object} props
 * @param {Object} props.item - File/folder item
 * @param {string} props.selected - Selected item path
 * @param {Function} props.onClick - Click handler
 * @param {Function} props.onDoubleClick - Double click handler
 */
function GridItem({ item, selected, onClick, onDoubleClick, onContextMenu }) {
  const isSelected = Array.isArray(selected) ? selected.includes(item.path) : selected === item.path

  return (
    <div
      className={`flex flex-col items-center p-3 rounded-lg cursor-pointer transition-colors ${
        isSelected
          ? 'bg-os-accent/20 border border-os-accent'
          : 'hover:bg-os-bg-tertiary border border-transparent'
      }`}
      onClick={(e) => onClick(item, e)}
      onDoubleClick={() => onDoubleClick(item)}
      onContextMenu={(e) => onContextMenu && onContextMenu(item, e)}
    >
      <div className="mb-2">{getFileIcon(item.name, item.type)}</div>
      <span className="text-xs text-center truncate w-full max-w-[100px]">
        {item.name}
      </span>
      {item.type !== 'directory' && item.size && (
        <span className="text-xs text-os-text-secondary mt-1">
          {formatSize(item.size)}
        </span>
      )}
    </div>
  )
}

/**
 * List item component
 * @param {Object} props
 * @param {Object} props.item - File/folder item
 * @param {string} props.selected - Selected item path
 * @param {Function} props.onClick - Click handler
 * @param {Function} props.onDoubleClick - Double click handler
 */
function ListItem({ item, selected, onClick, onDoubleClick, onContextMenu }) {
  const isSelected = Array.isArray(selected) ? selected.includes(item.path) : selected === item.path

  return (
    <div
      className={`flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors ${
        isSelected
          ? 'bg-os-accent/20'
          : 'hover:bg-os-bg-tertiary'
      }`}
      onClick={(e) => onClick(item, e)}
      onDoubleClick={() => onDoubleClick(item)}
      onContextMenu={(e) => onContextMenu && onContextMenu(item, e)}
    >
      <div className="w-6">{getFileIcon(item.name, item.type)}</div>
      <div className="flex-1 min-w-0">
        <span className="text-sm truncate block">{item.name}</span>
      </div>
      <div className="w-24 text-xs text-os-text-secondary text-right">
        {item.type !== 'directory' ? formatSize(item.size) : '-'}
      </div>
      <div className="w-40 text-xs text-os-text-secondary text-right">
        {formatDate(item.modified)}
      </div>
    </div>
  )
}

/**
 * FileGrid Component
 * @param {Object} props
 * @param {Array} props.items - Array of file/folder items
 * @param {string} props.viewMode - 'grid' or 'list'
 * @param {string} props.selected - Currently selected item path
 * @param {Function} props.onSelect - Selection handler
 * @param {Function} props.onOpen - Double-click handler
 */
function FileGrid({ items, viewMode = 'grid', selected, onSelect, onOpen, onContextMenu }) {
  if (!items || items.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-os-text-secondary">
        <p>This folder is empty</p>
      </div>
    )
  }

  if (viewMode === 'grid') {
    return (
      <div className="grid grid-cols-[repeat(auto-fill,minmax(100px,1fr))] gap-2 p-4">
        {items.map(item => (
          <GridItem
            key={item.path}
            item={item}
            selected={selected}
            onClick={onSelect}
            onDoubleClick={onOpen}
            onContextMenu={onContextMenu}
          />
        ))}
      </div>
    )
  }

  // List view
  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 px-3 py-2 border-b border-os-border text-xs text-os-text-secondary">
        <div className="w-6" />
        <div className="flex-1">Name</div>
        <div className="w-24 text-right">Size</div>
        <div className="w-40 text-right">Modified</div>
      </div>

      {/* Items */}
      {items.map(item => (
        <ListItem
          key={item.path}
          item={item}
          selected={selected}
          onClick={onSelect}
          onDoubleClick={onOpen}
          onContextMenu={onContextMenu}
        />
      ))}
    </div>
  )
}

export default FileGrid