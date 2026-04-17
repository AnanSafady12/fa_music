import { useState, useEffect } from 'react'
import type { Teacher } from '../types'
import { getTeachers, createTeacher, updateTeacher, deleteTeacher } from '../api'

import { INSTRUMENTS } from '../types'

const emptyForm = { name: '', phone: '', instrument: '', costPerLesson: 0 }

export default function TeachersPage() {
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Teacher | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [loading, setLoading] = useState(true)
  const [deleteConfirm, setDeleteConfirm] = useState<Teacher | null>(null)

  const load = async () => {
    try { setTeachers(await getTeachers()) } catch {} finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const openAdd = () => { setEditing(null); setForm(emptyForm); setModalOpen(true) }
  const openEdit = (t: Teacher) => {
    setEditing(t)
    setForm({ name: t.name, phone: t.phone || '', instrument: t.instrument || '', costPerLesson: t.costPerLesson })
    setModalOpen(true)
  }
  const closeModal = () => setModalOpen(false)

  const save = async () => {
    const payload = { ...form, instrument: form.instrument || null, costPerLesson: Number(form.costPerLesson) }
    if (editing) { await updateTeacher(editing.id, payload) } else { await createTeacher(payload) }
    closeModal(); load()
  }

  const remove = async (t: Teacher) => {
    await deleteTeacher(t.id)
    setDeleteConfirm(null); load()
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Teachers</div>
          <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 2 }}>{teachers.length} teachers on staff</div>
        </div>
        <button className="btn btn-primary" onClick={openAdd}>+ Add Teacher</button>
      </div>

      <div className="page-body">
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {loading ? (
            <div className="empty-state"><p style={{ animation: 'pulse 1.5s infinite' }}>Loading…</p></div>
          ) : teachers.length === 0 ? (
            <div className="empty-state"><h3>No teachers yet</h3><p>Add your first teacher to get started.</p></div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Instrument</th>
                  <th>Phone</th>
                  <th>Cost / Lesson</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {teachers.map(t => (
                  <tr key={t.id}>
                    <td style={{ fontWeight: 600 }}>{t.name}</td>
                    <td>{t.instrument ? <span className="tag tag-instrument">{t.instrument}</span> : '—'}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{t.phone || '—'}</td>
                    <td>
                      <span style={{ color: 'var(--gold)', fontWeight: 600 }}>
                        ₪{t.costPerLesson.toLocaleString()}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                        <button className="btn btn-ghost btn-sm btn-icon" onClick={() => openEdit(t)}>✏️</button>
                        <button className="btn btn-danger btn-sm btn-icon" onClick={() => setDeleteConfirm(t)}>🗑️</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {modalOpen && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">{editing ? 'Edit Teacher' : 'Add Teacher'}</div>
            <div className="form-row">
              <div className="form-group">
                <label>Name *</label>
                <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Teacher name" />
              </div>
              <div className="form-group">
                <label>Instrument</label>
                <select className="select" value={form.instrument} onChange={e => setForm(f => ({ ...f, instrument: e.target.value }))}>
                  <option value="">Select...</option>
                  {INSTRUMENTS.map(i => <option key={i} value={i}>{i}</option>)}
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Phone</label>
                <input className="input" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+961 …" />
              </div>
              <div className="form-group">
                <label>Cost per Lesson (₪)</label>
                <input className="input" type="number" min="0" step="0.5" value={form.costPerLesson} onChange={e => setForm(f => ({ ...f, costPerLesson: Number(e.target.value) }))} />
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={closeModal}>Cancel</button>
              <button className="btn btn-primary" onClick={save} disabled={!form.name.trim()}>
                {editing ? 'Save Changes' : 'Add Teacher'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div className="modal-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="modal" style={{ maxWidth: 360 }} onClick={e => e.stopPropagation()}>
            <div className="modal-title">Delete Teacher</div>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 20 }}>
              Are you sure you want to delete <strong style={{ color: 'var(--text-primary)' }}>{deleteConfirm.name}</strong>?
            </p>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setDeleteConfirm(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={() => remove(deleteConfirm)}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
