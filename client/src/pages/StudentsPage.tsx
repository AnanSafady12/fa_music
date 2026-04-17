import { useState, useEffect } from 'react'
import type { Student } from '../types'
import { INSTRUMENTS, PACKAGES } from '../types'
import { getStudents, createStudent, updateStudent, deleteStudent } from '../api'

const emptyForm = { name: '', parentName: '', phone: '', instrument: '', totalLessons: PACKAGES.STANDARD.lessons, completedLessons: 0, hasPaid: false, notes: '' }

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([])
  const [search, setSearch] = useState('')
  const [filterInstrument, setFilterInstrument] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Student | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [loading, setLoading] = useState(true)
  const [deleteConfirm, setDeleteConfirm] = useState<Student | null>(null)

  const load = async () => {
    try { setStudents(await getStudents()) } catch {} finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const openAdd = () => { setEditing(null); setForm(emptyForm); setModalOpen(true) }
  const openEdit = (s: Student) => {
    setEditing(s)
    setForm({ name: s.name, parentName: s.parentName || '', phone: s.phone || '', instrument: s.instrument || '', totalLessons: s.totalLessons, completedLessons: s.completedLessons, hasPaid: s.hasPaid, notes: s.notes || '' })
    setModalOpen(true)
  }
  const closeModal = () => setModalOpen(false)

  const save = async () => {
    const payload = { ...form, instrument: form.instrument || null, totalLessons: Number(form.totalLessons), completedLessons: Number(form.completedLessons), hasPaid: form.hasPaid }
    if (editing) { await updateStudent(editing.id, payload) } else { await createStudent(payload) }
    closeModal(); load()
  }

  const remove = async (s: Student) => {
    await deleteStudent(s.id)
    setDeleteConfirm(null)
    load()
  }

  const togglePaid = async (s: Student) => {
    // Quick toggle for the paid status
    const newStatus = !s.hasPaid
    // Optimistic update
    setStudents(prev => prev.map(st => st.id === s.id ? { ...st, hasPaid: newStatus } : st))
    // Backend update
    await updateStudent(s.id, { ...s, hasPaid: newStatus })
  }

  const renewPack = async (s: Student) => {
    if (!confirm(`Renew packet for ${s.name}? This will add 4 lessons.`)) return
    
    // Add 4 to total lessons
    const newTotal = s.totalLessons + 4
    
    // Optimistic update
    setStudents(prev => prev.map(st => st.id === s.id ? { ...st, totalLessons: newTotal } : st))
    // Backend update
    await updateStudent(s.id, { ...s, totalLessons: newTotal })
  }

  const filtered = students.filter(s => {
    const matchSearch = s.name.toLowerCase().includes(search.toLowerCase())
    const matchInstrument = !filterInstrument || s.instrument === filterInstrument
    return matchSearch && matchInstrument
  })

  const leftaining = (s: Student) => s.totalLessons - s.completedLessons

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Students</div>
          <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 2 }}>{students.length} students enrolled</div>
        </div>
        <button className="btn btn-primary" onClick={openAdd}>+ Add Student</button>
      </div>

      <div className="page-body">
        {/* Filters */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
          <input className="input" placeholder="🔍 Search by name…" value={search} onChange={e => setSearch(e.target.value)} style={{ maxWidth: 260 }} />
          <select className="select" value={filterInstrument} onChange={e => setFilterInstrument(e.target.value)} style={{ maxWidth: 180 }}>
            <option value="">All Instruments</option>
            {INSTRUMENTS.map(i => <option key={i} value={i}>{i}</option>)}
          </select>
        </div>

        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {loading ? (
            <div className="empty-state"><p style={{ animation: 'pulse 1.5s infinite' }}>Loading…</p></div>
          ) : filtered.length === 0 ? (
            <div className="empty-state"><h3>No students found</h3><p>Try adjusting the search or add a new student.</p></div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Instrument</th>
                  <th>Parent</th>
                  <th>Phone</th>
                  <th>Lessons</th>
                  <th>Paid?</th>
                  <th>Notes</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(s => {
                  const left = leftaining(s)
                  const pct = s.totalLessons > 0 ? Math.round((s.completedLessons / s.totalLessons) * 100) : 0
                  return (
                    <tr key={s.id}>
                      <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{s.name}</td>
                      <td>{s.instrument ? <span className="tag tag-instrument">{s.instrument}</span> : '—'}</td>
                      <td style={{ color: 'var(--text-secondary)' }}>{s.parentName || '—'}</td>
                      <td style={{ color: 'var(--text-secondary)' }}>{s.phone || '—'}</td>
                      <td style={{ minWidth: 120 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{s.completedLessons}/{s.totalLessons}</span>
                          {left <= 2 && s.totalLessons > 0 && (
                            <span className="tag tag-warning" style={{ fontSize: 10 }}>{left === 0 ? 'Complete!' : `${left} left`}</span>
                          )}
                        </div>
                        <div className="lessons-bar" style={{ width: 100 }}>
                          <div className="lessons-bar-fill" style={{ width: `${pct}%`, ...(left <= 2 ? { background: 'var(--red)' } : {}) }} />
                        </div>
                      </td>
                      <td onClick={() => togglePaid(s)} style={{ cursor: 'pointer' }} title="Click to toggle paid status">
                        {s.hasPaid ? (
                          <span className="tag tag-instrument" style={{ background: 'var(--green)', color: '#fff', transition: '0.2s' }}>Paid</span>
                        ) : (
                          <span className="tag tag-warning" style={{ background: 'var(--surface)', border: '1px solid var(--red)', color: 'var(--red)', transition: '0.2s' }}>Unpaid</span>
                        )}
                      </td>
                      <td style={{ color: 'var(--text-muted)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.notes || '—'}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                          <button className="btn btn-secondary btn-sm" onClick={() => renewPack(s)} title="Add 4 lessons" style={{ fontSize: 11, padding: '2px 8px' }}>+ Pack</button>
                          <button className="btn btn-ghost btn-sm btn-icon" onClick={() => openEdit(s)} title="Edit">✏️</button>
                          <button className="btn btn-danger btn-sm btn-icon" onClick={() => setDeleteConfirm(s)} title="Delete">🗑️</button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Add/Edit Modal */}
      {modalOpen && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">{editing ? 'Edit Student' : 'Add Student'}</div>
            <div className="form-row">
              <div className="form-group">
                <label>Name *</label>
                <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Student name" />
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
                <label>Parent Name</label>
                <input className="input" value={form.parentName} onChange={e => setForm(f => ({ ...f, parentName: e.target.value }))} placeholder="Parent name" />
              </div>
              <div className="form-group">
                <label>Phone</label>
                <input className="input" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+961 …" />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>
                  Total Lessons
                  {!editing && (
                    <span style={{color: 'var(--accent)', fontWeight: 600, marginLeft: 6, textTransform: 'none'}}>
                      ({PACKAGES.STANDARD.name} - ₪{PACKAGES.STANDARD.price})
                    </span>
                  )}
                </label>
                <input className="input" type="number" min="0" value={form.totalLessons} onChange={e => setForm(f => ({ ...f, totalLessons: Number(e.target.value) }))} />
              </div>
              <div className="form-group">
                <label>Completed</label>
                <input className="input" type="number" min="0" value={form.completedLessons} onChange={e => setForm(f => ({ ...f, completedLessons: Number(e.target.value) }))} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <input type="checkbox" id="hasPaid" checked={form.hasPaid} onChange={e => setForm(f => ({ ...f, hasPaid: e.target.checked }))} style={{ width: 18, height: 18, cursor: 'pointer' }} />
                <label htmlFor="hasPaid" style={{ margin: 0, cursor: 'pointer' }}>Student has paid for the package</label>
              </div>
            </div>
            <div className="form-group">
              <label>Notes</label>
              <input className="input" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional notes…" />
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={closeModal}>Cancel</button>
              <button className="btn btn-primary" onClick={save} disabled={!form.name.trim()}>
                {editing ? 'Save Changes' : 'Add Student'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteConfirm && (
        <div className="modal-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="modal" style={{ maxWidth: 360 }} onClick={e => e.stopPropagation()}>
            <div className="modal-title">Delete Student</div>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 20 }}>
              Are you sure you want to delete <strong style={{ color: 'var(--text-primary)' }}>{deleteConfirm.name}</strong>? This will also remove their scheduled lessons.
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
