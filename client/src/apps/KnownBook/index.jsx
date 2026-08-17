/**
 * KnownBookApp.jsx — Phase 2.3
 *
 * Three-screen app for managing known people (Alzheimer's support feature):
 *   1. List View     — cards with photo, name, relationship, last recognised time
 *   2. Add/Edit Form — name, relationship dropdown, notes, photo upload
 *   3. Detail View   — full card + recognition history summary
 *
 * Uses glass-morphism design consistent with WindowFrame.jsx styling.
 * Photo uploads go to POST /api/upload (stored locally — no CDN).
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import FaceRecognition from '../../input/FaceRecognition'; // Phase 2.4 — face descriptor enrollment

const API_BASE   = '/api/known-book';
const UPLOAD_URL = '/api/upload'; // Assumed to exist per guide

const RELATIONSHIPS = ['family', 'friend', 'caregiver', 'doctor', 'other'];

// ── Helpers ──────────────────────────────────────────────────────────────────
function timeAgo(dateStr) {
  if (!dateStr) return 'Never';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function RelationshipBadge({ value }) {
  const colors = {
    family:    ['#7c3aed', 'rgba(124, 58, 237, 0.2)'],
    friend:    ['#0891b2', 'rgba(8, 145, 178, 0.2)'],
    caregiver: ['#059669', 'rgba(5, 150, 105, 0.2)'],
    doctor:    ['#d97706', 'rgba(217, 119, 6, 0.2)'],
    other:     ['#64748b', 'rgba(100, 116, 139, 0.2)']
  };
  const [fg, bg] = colors[value] || colors.other;
  return (
    <span style={{
      background: bg, color: fg,
      fontSize: 11, fontWeight: 700, padding: '2px 8px',
      borderRadius: 99, textTransform: 'capitalize', letterSpacing: 0.3
    }}>
      {value}
    </span>
  );
}

// ── PersonCard (List View) ───────────────────────────────────────────────────
function PersonCard({ person, onEdit, onDelete, onSelect }) {
  return (
    <div
      onClick={() => onSelect(person)}
      className="bg-os-surface/50 border border-os-border"
      style={{
        borderRadius: 14, padding: '16px',
        display: 'flex', alignItems: 'center', gap: 14,
        cursor: 'pointer', transition: 'background 0.15s',
        marginBottom: 10
      }}
      onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
      onMouseLeave={e => e.currentTarget.style.background = ''}
    >
      {/* Photo thumbnail */}
      <div className="bg-os-bg-secondary border border-os-border/50"
        style={{
          width: 52, height: 52, borderRadius: '50%', flexShrink: 0,
          overflow: 'hidden',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
        {person.photoUrl ? (
          <img src={person.photoUrl} alt={person.name}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <span className="material-symbols-outlined text-os-text-secondary" style={{ fontSize: 28 }}>person</span>
        )}
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span className="text-os-text-primary" style={{ fontSize: 15, fontWeight: 700, lineHeight: 1 }}>
            {person.name}
          </span>
          <RelationshipBadge value={person.relationship} />
        </div>
        <div className="text-os-text-secondary" style={{ fontSize: 11 }}>
          Last seen: {timeAgo(person.lastRecognized)} ·{' '}
          {person.recognitionCount || 0} recognition{person.recognitionCount !== 1 ? 's' : ''}
        </div>
        {person.notes && (
          <div className="text-os-text-secondary/70" style={{ fontSize: 11, marginTop: 3,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {person.notes}
          </div>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}
        onClick={e => e.stopPropagation()}>
        <button id={`edit-person-${person.id}`} onClick={() => onEdit(person)}
          style={iconBtnStyle('#334155')}>✏️</button>
        <button id={`delete-person-${person.id}`} onClick={() => onDelete(person.id)}
          style={iconBtnStyle('#991b1b')}>🗑️</button>
      </div>
    </div>
  );
}

// ── PersonForm (Add / Edit) ───────────────────────────────────────────────────
function PersonForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState({
    name:         initial?.name         || '',
    relationship: initial?.relationship || 'family',
    notes:        initial?.notes        || '',
    photoUrl:     initial?.photoUrl     || ''
  });
  const [uploading, setUploading] = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [error,     setError]     = useState(null);
  const fileRef = useRef();

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handlePhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res  = await fetch(UPLOAD_URL, { method: 'POST', body: fd, credentials: 'include' });
      const data = await res.json();
      set('photoUrl', data.url || data.path || '');
    } catch (err) {
      setError('Photo upload failed: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return setError('Name is required');
    setSaving(true);
    setError(null);
    try {
      // Auto-enroll face descriptor when a photo is available
      let faceDescriptor = initial?.faceDescriptor || null;
      if (form.photoUrl && !initial?.faceDescriptor) {
        try {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
            img.src = form.photoUrl;
          });
          faceDescriptor = await FaceRecognition.computeDescriptor(img);
        } catch {
          // descriptor enrollment failed — save without it
        }
      }

      const method = initial ? 'PUT' : 'POST';
      const url    = initial ? `${API_BASE}/${initial.id}` : API_BASE;
      const res = await fetch(url, {
        method, credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, ...(faceDescriptor ? { faceDescriptor } : {}) })
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Save failed');
      onSave();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <h3 className="text-os-text-primary" style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
        {initial ? 'Edit Person' : 'Add to Known Book'}
      </h3>

      {error && <div className="text-red-400 text-xs bg-red-500/10 border border-red-500/20"
        style={{ padding: '8px 12px', borderRadius: 8 }}>{error}</div>}

      {/* Photo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div className="bg-os-bg-secondary border border-os-border/50"
          style={{
            width: 72, height: 72, borderRadius: '50%',
            overflow: 'hidden',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
          }}>
          {form.photoUrl
            ? <img src={form.photoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <span className="material-symbols-outlined text-os-text-secondary" style={{ fontSize: 36 }}>person</span>}
        </div>
        <div>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }}
            onChange={handlePhoto} />
          <button type="button" id="upload-photo-btn" onClick={() => fileRef.current?.click()}
            style={btnStyle('#334155', false)}>
            {uploading ? 'Uploading…' : '📷 Choose Photo'}
          </button>
          <div className="text-os-text-secondary" style={{ fontSize: 11, marginTop: 4 }}>
            Stored locally — not sent to any server
          </div>
        </div>
      </div>

      {/* Name */}
      <div>
        <label style={labelStyle}>Full Name *</label>
        <input id="person-name" value={form.name} onChange={e => set('name', e.target.value)}
          placeholder="e.g. Priya Sharma" style={inputStyle} required />
      </div>

      {/* Relationship */}
      <div>
        <label style={labelStyle}>Relationship *</label>
        <select id="person-relationship" value={form.relationship}
          onChange={e => set('relationship', e.target.value)} style={inputStyle}>
          {RELATIONSHIPS.map(r => (
            <option key={r} value={r}>
              {r.charAt(0).toUpperCase() + r.slice(1)}
            </option>
          ))}
        </select>
      </div>

      {/* Notes */}
      <div>
        <label style={labelStyle}>Notes (optional)</label>
        <textarea id="person-notes" value={form.notes}
          onChange={e => set('notes', e.target.value)}
          placeholder="Caregiver notes, reminders…"
          rows={3} style={{ ...inputStyle, resize: 'vertical', minHeight: 72 }} />
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button type="button" id="cancel-person-form" onClick={onCancel}
          style={btnStyle('#334155', false)}>Cancel</button>
        <button type="submit" id="save-person-form" disabled={saving}
          style={btnStyle('#7c3aed', saving)}>
          {saving ? 'Saving…' : initial ? 'Save Changes' : 'Add Person'}
        </button>
      </div>
    </form>
  );
}

// ── Detail View ────────────────────────────────────────────────────────────────
function PersonDetail({ person, onBack, onEdit }) {
  return (
    <div style={{ padding: 20 }}>
      <button id="back-to-list" onClick={onBack}
        style={{ ...btnStyle('#334155', false), marginBottom: 16 }}>
        ← Back
      </button>

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 18, marginBottom: 20 }}>
        <div className="bg-os-bg-secondary border border-os-border"
          style={{
            width: 88, height: 88, borderRadius: '50%',
            overflow: 'hidden', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
          {person.photoUrl
            ? <img src={person.photoUrl} alt={person.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <span className="material-symbols-outlined text-os-text-secondary" style={{ fontSize: 44 }}>person</span>}
        </div>
        <div>
          <h2 className="text-os-text-primary" style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>{person.name}</h2>
          <div style={{ marginTop: 6 }}><RelationshipBadge value={person.relationship} /></div>
          <button id="edit-person-detail" onClick={() => onEdit(person)}
            style={{ ...btnStyle('#334155', false), marginTop: 10, fontSize: 12, padding: '6px 14px' }}>
            ✏️ Edit
          </button>
        </div>
      </div>

      {/* Recognition stats */}
      <div className="bg-os-surface/50 border border-os-border"
        style={{ borderRadius: 12, padding: 16, marginBottom: 16 }}>
        <h4 className="text-os-text-secondary" style={{ margin: '0 0 12px', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8 }}>
          Recognition History
        </h4>
        <div style={{ display: 'flex', gap: 24 }}>
          <div>
            <div className="text-indigo-400" style={{ fontSize: 28, fontWeight: 800 }}>{person.recognitionCount || 0}</div>
            <div className="text-os-text-secondary" style={{ fontSize: 11 }}>Total recognitions</div>
          </div>
          <div>
            <div className="text-os-text-secondary" style={{ fontSize: 18, fontWeight: 700 }}>{timeAgo(person.lastRecognized)}</div>
            <div className="text-os-text-secondary" style={{ fontSize: 11 }}>Last recognised</div>
          </div>
        </div>
      </div>

      {/* Notes */}
      {person.notes && (
        <div className="bg-os-surface/50 border border-os-border"
          style={{ borderRadius: 12, padding: 16 }}>
          <h4 className="text-os-text-secondary" style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8 }}>
            Notes
          </h4>
          <p className="text-os-text-primary" style={{ margin: 0, fontSize: 13, lineHeight: 1.7 }}>{person.notes}</p>
        </div>
      )}

      {/* Face descriptor badge */}
      <div style={{ marginTop: 16, fontSize: 11 }} className={person.faceDescriptor ? 'text-emerald-400' : 'text-amber-400'}>
        {person.faceDescriptor
          ? '✅ Face data enrolled — ready for recognition'
          : '⚠️ No face data — add a photo to enable recognition'}
      </div>
    </div>
  );
}

// ── Main App ─────────────────────────────────────────────────────────────────
export default function KnownBookApp() {
  const [people,     setPeople]     = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [view,       setView]       = useState('list'); // 'list' | 'form' | 'detail'
  const [selected,   setSelected]   = useState(null);
  const [editTarget, setEditTarget] = useState(null);

  const loadPeople = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch(API_BASE, { credentials: 'include' });
      const data = await res.json();
      setPeople(Array.isArray(data) ? data : []);
    } catch {
      setPeople([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadPeople(); }, [loadPeople]);

  const handleDelete = async (id) => {
    if (!window.confirm('Remove this person from your Known Book?')) return;
    await fetch(`${API_BASE}/${id}`, { method: 'DELETE', credentials: 'include' });
    loadPeople();
  };

  const handleEdit   = (p) => { setEditTarget(p); setView('form'); };
  const handleSelect = (p) => { setSelected(p);   setView('detail'); };
  const handleSaved  = ()  => { setEditTarget(null); setView('list'); loadPeople(); };

  return (
    <div className="bg-transparent text-os-text-primary"
      style={{
        height: '100%', overflow: 'auto',
        fontFamily: 'Inter, system-ui, sans-serif'
      }}>
      {view === 'list' && (
        <div style={{ padding: 20 }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <div>
              <h2 className="text-os-text-primary" style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>Known Book</h2>
              <p className="text-os-text-secondary" style={{ margin: '2px 0 0', fontSize: 12 }}>
                {people.length} {people.length === 1 ? 'person' : 'people'} enrolled
              </p>
            </div>
            <button id="add-person-btn" onClick={() => { setEditTarget(null); setView('form'); }}
              style={btnStyle('#7c3aed', false)}>
              + Add Person
            </button>
          </div>

          {loading ? (
            <div className="text-os-text-secondary text-center" style={{ fontSize: 13, padding: 40 }}>Loading…</div>
          ) : people.length === 0 ? (
            <div className="text-center" style={{ padding: 40 }}>
              <span className="material-symbols-outlined text-os-text-secondary" style={{ fontSize: 56, display: 'block', marginBottom: 12 }}>
                contacts
              </span>
              <p className="text-os-text-secondary" style={{ margin: 0, fontSize: 13 }}>
                No one added yet.<br />Add family, friends, and caregivers to enable face recognition.
              </p>
            </div>
          ) : (
            people.map(p => (
              <PersonCard key={p.id} person={p}
                onEdit={handleEdit} onDelete={handleDelete} onSelect={handleSelect} />
            ))
          )}
        </div>
      )}

      {view === 'form' && (
        <PersonForm
          initial={editTarget}
          onSave={handleSaved}
          onCancel={() => { setEditTarget(null); setView(selected ? 'detail' : 'list'); }}
        />
      )}

      {view === 'detail' && selected && (
        <PersonDetail
          person={people.find(p => p.id === selected.id) || selected}
          onBack={() => setView('list')}
          onEdit={handleEdit}
        />
      )}
    </div>
  );
}

// ── Style helpers ──────────────────────────────────────────────────────────────
function btnStyle(bg, disabled) {
  return {
    background: disabled ? 'var(--theme-surface)' : bg,
    color: disabled ? 'var(--theme-text)' : '#f1f5f9',
    border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13,
    fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.6 : 1, transition: 'opacity 0.15s'
  };
}
function iconBtnStyle(bg) {
  return {
    background: bg, border: 'none', borderRadius: 7, padding: '6px 9px',
    cursor: 'pointer', fontSize: 14, lineHeight: 1
  };
}
const labelStyle = { fontSize: 12, fontWeight: 600, color: 'var(--theme-text)', opacity: 0.7, display: 'block', marginBottom: 5 };
const inputStyle = {
  width: '100%', boxSizing: 'border-box',
  background: 'var(--theme-surface)', border: '1px solid var(--theme-border)',
  borderRadius: 8, padding: '9px 12px', fontSize: 13,
  color: 'var(--theme-text)', outline: 'none', fontFamily: 'inherit'
};
