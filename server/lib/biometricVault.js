/**
 * server/lib/biometricVault.js — Phase 4.2
 *
 * Secure local vault for sensitive data (passwords, PINs, medical info,
 * insurance numbers, etc.) stored AES-256-GCM encrypted in a JSON file.
 *
 * Security model:
 *   - Vault is encrypted with AES-256-GCM using a key derived from the
 *     user's vault PIN via PBKDF2 (100,000 iterations, SHA-256).
 *   - The salt is stored alongside the ciphertext (safe — salt is not secret).
 *   - The vault PIN is NEVER stored — only the derived key is used transiently.
 *   - Each vault entry has: id, category, label, secret, notes, createdAt.
 *   - The vault file lives at server/data/vault.enc (gitignored).
 *
 * Categories: passwords, pins, medical, insurance, financial, personal
 *
 * API (used by irisTools.js handlers):
 *   vault_unlock(pin)                    → { unlocked: true, entryCount }
 *   vault_add(pin, category, label, secret, notes) → { added: true, id }
 *   vault_get(pin, label_or_id)          → { entry }
 *   vault_list(pin)                      → { entries: [{ id, category, label, notes }] }
 *   vault_delete(pin, label_or_id)       → { deleted: true }
 *   vault_lock()                         → { locked: true }
 *
 * The PIN is required for every read/write operation (no session caching
 * on the server — the client must re-send it each time).
 */

const crypto = require('crypto')
const fs     = require('fs')
const path   = require('path')

const VAULT_PATH   = path.join(__dirname, '..', 'data', 'vault.enc')
const PBKDF2_ITERS = 100_000
const KEY_LEN      = 32   // 256 bits
const ALGO         = 'aes-256-gcm'
const IV_LEN       = 16
const TAG_LEN      = 16
const SALT_LEN     = 32

const VALID_CATEGORIES = ['passwords', 'pins', 'medical', 'insurance', 'financial', 'personal']

// ── Key derivation ────────────────────────────────────────────────────────────

function deriveKey(pin, salt) {
  return crypto.pbkdf2Sync(
    Buffer.from(String(pin), 'utf-8'),
    salt,
    PBKDF2_ITERS,
    KEY_LEN,
    'sha256'
  )
}

// ── Encrypt / Decrypt ─────────────────────────────────────────────────────────

function encrypt(plaintext, key) {
  const iv  = crypto.randomBytes(IV_LEN)
  const cipher = crypto.createCipheriv(ALGO, key, iv)
  const enc = Buffer.concat([cipher.update(plaintext, 'utf-8'), cipher.final()])
  const tag = cipher.getAuthTag()
  // Layout: salt(32) | iv(16) | tag(16) | ciphertext
  return Buffer.concat([iv, tag, enc])
}

function decrypt(buf, key) {
  const iv   = buf.slice(0, IV_LEN)
  const tag  = buf.slice(IV_LEN, IV_LEN + TAG_LEN)
  const enc  = buf.slice(IV_LEN + TAG_LEN)
  const decipher = crypto.createDecipheriv(ALGO, key, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf-8')
}

// ── Vault file I/O ────────────────────────────────────────────────────────────

function vaultExists() {
  return fs.existsSync(VAULT_PATH)
}

/**
 * Read and decrypt the vault. Returns parsed JSON array of entries.
 * Throws if PIN is wrong (GCM auth tag mismatch).
 */
function readVault(pin) {
  if (!vaultExists()) return { entries: [], salt: null }

  const raw  = fs.readFileSync(VAULT_PATH)
  // Layout: salt(32) | encrypted_blob
  const salt = raw.slice(0, SALT_LEN)
  const blob = raw.slice(SALT_LEN)
  const key  = deriveKey(pin, salt)

  let plaintext
  try {
    plaintext = decrypt(blob, key)
  } catch (_) {
    throw new Error('Wrong PIN — vault decryption failed')
  }

  const data = JSON.parse(plaintext)
  return { entries: data.entries || [], salt }
}

/**
 * Encrypt and write the vault.
 * If vault doesn't exist yet, generates a new salt (first-time setup).
 */
function writeVault(pin, entries, existingSalt) {
  fs.mkdirSync(path.dirname(VAULT_PATH), { recursive: true })

  const salt = existingSalt || crypto.randomBytes(SALT_LEN)
  const key  = deriveKey(pin, salt)
  const plaintext = JSON.stringify({ entries, version: 1 })
  const encrypted = encrypt(plaintext, key)

  // Write: salt(32) | encrypted_blob
  fs.writeFileSync(VAULT_PATH, Buffer.concat([salt, encrypted]))
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Unlock (verify PIN) and return entry count.
 * Also initialises an empty vault if none exists.
 */
function vaultUnlock(pin) {
  if (!pin) throw new Error('PIN is required')

  if (!vaultExists()) {
    // First-time setup — create empty vault with this PIN
    writeVault(pin, [])
    return { unlocked: true, entryCount: 0, firstTime: true }
  }

  const { entries } = readVault(pin)  // throws if wrong PIN
  return { unlocked: true, entryCount: entries.length }
}

/**
 * Add a new entry to the vault.
 */
function vaultAdd(pin, { category, label, secret, notes }) {
  if (!pin)    throw new Error('PIN is required')
  if (!label)  throw new Error('label is required')
  if (!secret) throw new Error('secret is required')

  const cat = category || 'personal'
  if (!VALID_CATEGORIES.includes(cat)) {
    throw new Error(`Invalid category. Use one of: ${VALID_CATEGORIES.join(', ')}`)
  }

  const { entries, salt } = readVault(pin)

  // Check for duplicate label in same category
  const dup = entries.find(e => e.category === cat && e.label.toLowerCase() === label.toLowerCase())
  if (dup) throw new Error(`Entry "${label}" already exists in ${cat}. Use vault_update to change it.`)

  const entry = {
    id:        crypto.randomUUID(),
    category:  cat,
    label,
    secret,
    notes:     notes || '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }

  entries.push(entry)
  writeVault(pin, entries, salt)

  return { added: true, id: entry.id, category: cat, label }
}

/**
 * Retrieve a single entry by label (fuzzy) or exact ID.
 */
function vaultGet(pin, labelOrId) {
  if (!pin)        throw new Error('PIN is required')
  if (!labelOrId)  throw new Error('label or id is required')

  const { entries } = readVault(pin)

  // Try exact ID first
  let entry = entries.find(e => e.id === labelOrId)

  // Then case-insensitive label match
  if (!entry) {
    const needle = labelOrId.toLowerCase()
    entry = entries.find(e => e.label.toLowerCase() === needle)
  }

  // Then partial label match
  if (!entry) {
    const needle = labelOrId.toLowerCase()
    entry = entries.find(e => e.label.toLowerCase().includes(needle))
  }

  if (!entry) throw new Error(`No vault entry found matching: "${labelOrId}"`)

  return {
    id:        entry.id,
    category:  entry.category,
    label:     entry.label,
    secret:    entry.secret,
    notes:     entry.notes,
    createdAt: entry.createdAt
  }
}

/**
 * List all entries (without secrets — labels and categories only).
 */
function vaultList(pin, category) {
  if (!pin) throw new Error('PIN is required')

  const { entries } = readVault(pin)

  let filtered = entries
  if (category && VALID_CATEGORIES.includes(category)) {
    filtered = entries.filter(e => e.category === category)
  }

  return {
    entries: filtered.map(e => ({
      id:        e.id,
      category:  e.category,
      label:     e.label,
      notes:     e.notes ? e.notes.slice(0, 60) : '',
      createdAt: e.createdAt
    })),
    total: filtered.length
  }
}

/**
 * Delete an entry by label or ID.
 */
function vaultDelete(pin, labelOrId) {
  if (!pin)       throw new Error('PIN is required')
  if (!labelOrId) throw new Error('label or id is required')

  const { entries, salt } = readVault(pin)

  const needle = labelOrId.toLowerCase()
  const idx = entries.findIndex(e =>
    e.id === labelOrId ||
    e.label.toLowerCase() === needle ||
    e.label.toLowerCase().includes(needle)
  )

  if (idx === -1) throw new Error(`No vault entry found matching: "${labelOrId}"`)

  const removed = entries.splice(idx, 1)[0]
  writeVault(pin, entries, salt)

  return { deleted: true, label: removed.label, category: removed.category }
}

/**
 * Update an existing entry's secret or notes.
 */
function vaultUpdate(pin, labelOrId, { secret, notes }) {
  if (!pin)       throw new Error('PIN is required')
  if (!labelOrId) throw new Error('label or id is required')

  const { entries, salt } = readVault(pin)

  const needle = labelOrId.toLowerCase()
  const entry = entries.find(e =>
    e.id === labelOrId ||
    e.label.toLowerCase() === needle ||
    e.label.toLowerCase().includes(needle)
  )

  if (!entry) throw new Error(`No vault entry found matching: "${labelOrId}"`)

  if (secret !== undefined) entry.secret = secret
  if (notes  !== undefined) entry.notes  = notes
  entry.updatedAt = new Date().toISOString()

  writeVault(pin, entries, salt)
  return { updated: true, label: entry.label, category: entry.category }
}

/**
 * Change the vault PIN (re-encrypts with new PIN).
 */
function vaultChangePin(oldPin, newPin) {
  if (!oldPin) throw new Error('Current PIN is required')
  if (!newPin) throw new Error('New PIN is required')
  if (String(newPin).length < 4) throw new Error('New PIN must be at least 4 characters')

  const { entries } = readVault(oldPin)  // validates old PIN
  writeVault(newPin, entries)            // re-encrypts with new PIN + new salt
  return { changed: true }
}

/**
 * Check if vault file exists (for UI to know whether to show setup vs unlock).
 */
function vaultStatus() {
  return {
    exists:     vaultExists(),
    path:       VAULT_PATH,
    categories: VALID_CATEGORIES
  }
}

module.exports = {
  vaultUnlock,
  vaultAdd,
  vaultGet,
  vaultList,
  vaultDelete,
  vaultUpdate,
  vaultChangePin,
  vaultStatus,
  VALID_CATEGORIES
}
