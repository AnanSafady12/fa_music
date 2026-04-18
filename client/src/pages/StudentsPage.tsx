import { useState, useEffect } from 'react'
import type { Student } from '../types'
import { INSTRUMENTS, PACKAGES } from '../types'
import { getStudents, createStudent, updateStudent, deleteStudent, getStudentHistory } from '../api'

const emptyForm = { name: '', parentName: '', phone: '', phone2: '', age: '' as string | number, instrument: '', totalLessons: PACKAGES.STANDARD.lessons, completedLessons: 0, hasPaid: false, notes: '' }

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([])
  const [search, setSearch] = useState('')
  const [filterInstrument, setFilterInstrument] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Student | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [loading, setLoading] = useState(true)
  const [deleteConfirm, setDeleteConfirm] = useState<Student | null>(null)
  
  // History Modal State
  const [historyStudent, setHistoryStudent] = useState<Student | null>(null)
  const [history, setHistory] = useState<any[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)

  const load = async () => {
    try { setStudents(await getStudents()) } catch {} finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const openAdd = () => { setEditing(null); setForm(emptyForm); setModalOpen(true) }
  const openEdit = (s: Student) => {
    setEditing(s)
    setForm({ 
      name: s.name, 
      parentName: s.parentName || '', 
      phone: s.phone || '', 
      phone2: s.phone2 || '',
      age: s.age || '',
      instrument: s.instrument || '', 
      totalLessons: s.totalLessons, 
      completedLessons: s.completedLessons, 
      hasPaid: s.hasPaid, 
      notes: s.notes || '' 
    })
    setModalOpen(true)
  }
  const closeModal = () => setModalOpen(false)

  const openHistory = async (s: Student) => {
    setHistoryStudent(s)
    setLoadingHistory(true)
    try {
      const data = await getStudentHistory(s.id)
      setHistory(data)
    } catch {
      setHistory([])
    } finally {
      setLoadingHistory(false)
    }
  }

  const save = async () => {
    const payload = { 
      ...form, 
      age: form.age === '' ? null : Number(form.age),
      instrument: form.instrument || null, 
      totalLessons: Number(form.totalLessons), 
      completedLessons: Number(form.completedLessons), 
      hasPaid: form.hasPaid 
    }
    if (editing) { await updateStudent(editing.id, payload) } else { await createStudent(payload) }
    closeModal(); load()
  }

  const remove = async (s: Student) => {
    await deleteStudent(s.id)
    setDeleteConfirm(null)
    load()
  }

  const togglePaid = async (s: Student) => {
    const newStatus = !s.hasPaid
    setStudents(prev => prev.map(st => st.id === s.id ? { ...st, hasPaid: newStatus } : st))
    await updateStudent(s.id, { ...s, hasPaid: newStatus })
  }

  const renewPack = async (s: Student) => {
    if (!confirm(`Renew packet for ${s.name}? This will add 4 lessons.`)) return
    const newTotal = s.totalLessons + 4
    setStudents(prev => prev.map(st => st.id === s.id ? { ...st, totalLessons: newTotal } : st))
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
                  <th>Age</th>
                  <th>Phones</th>
                  <th>Lessons</th>
                  <th>Paid?</th>
                  <th>Registered</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(s => {
                  const left = leftaining(s)
                  const pct = s.totalLessons > 0 ? Math.round((s.completedLessons / s.totalLessons) * 100) : 0
                  return (
                    <tr 
                      key={s.id} 
                      onDoubleClick={() => openHistory(s)} 
                      style={{ cursor: 'pointer' }}
                      title="Double-click to view history"
                    >
                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{s.name}</div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{s.parentName || 'No Parent'}</div>
                      </td>
                      <td>{s.instrument ? <span className="tag tag-instrument">{s.instrument}</span> : '—'}</td>
                      <td style={{ color: 'var(--text-secondary)' }}>{s.age || '—'}</td>
                      <td>
                        <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{s.phone || '—'}</div>
                        {s.phone2 && <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>{s.phone2}</div>}
                      </td>
                      <td style={{ minWidth: 120 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{s.completedLessons}/{s.totalLessons}</span>
                        </div>
                        <div className="lessons-bar" style={{ width: 100 }}>
                          <div className="lessons-bar-fill" style={{ width: `${pct}%`, ...(left <= 2 ? { background: 'var(--red)' } : {}) }} />
                        </div>
                      </td>
                      <td onClick={(e) => { e.stopPropagation(); togglePaid(s); }} style={{ cursor: 'pointer' }}>
                        {s.hasPaid ? (
                          <span className="tag tag-instrument" style={{ background: 'var(--green)', color: '#fff' }}>Paid</span>
                        ) : (
                          <span className="tag tag-warning" style={{ background: 'var(--surface)', border: '1px solid var(--red)', color: 'var(--red)' }}>Unpaid</span>
                        )}
                      </td>
                      <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                        {new Date(s.registrationDate).toLocaleDateString()}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                          <button className="btn btn-secondary btn-sm" onClick={(e) => { e.stopPropagation(); renewPack(s); }} title="Add 4 lessons">+ Pack</button>
                          <button className="btn btn-ghost btn-sm btn-icon" onClick={(e) => { e.stopPropagation(); openEdit(s); }}>✏️</button>
                          <button className="btn btn-danger btn-sm btn-icon" onClick={(e) => { e.stopPropagation(); setDeleteConfirm(s); }}>🗑️</button>
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
          <div className="modal" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
            <div className="modal-title">{editing ? 'Edit Student' : 'Add Student'}</div>
            
            <div className="form-row">
              <div className="form-group">
                <label>Name *</label>
                <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Student name" />
              </div>
              <div className="form-group">
                <label>Age</label>
                <input type="number" className="input" value={form.age} onChange={e => setForm(f => ({ ...f, age: e.target.value }))} placeholder="Years" />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Instrument</label>
                <select className="select" value={form.instrument} onChange={e => setForm(f => ({ ...f, instrument: e.target.value }))}>
                  <option value="">Select...</option>
                  {INSTRUMENTS.map(i => <option key={i} value={i}>{i}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Parent Name</label>
                <input className="input" value={form.parentName} onChange={e => setForm(f => ({ ...f, parentName: e.target.value }))} placeholder="Parent name" />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Phone 1</label>
                <input className="input" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="Primary number" />
              </div>
              <div className="form-group">
                <label>Phone 2</label>
                <input className="input" value={form.phone2} onChange={e => setForm(f => ({ ...f, phone2: e.target.value }))} placeholder="Secondary number" />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Total Lessons</label>
                <input className="input" type="number" min="0" value={form.totalLessons} onChange={e => setForm(f => ({ ...f, totalLessons: Number(e.target.value) }))} />
              </div>
              <div className="form-group">
                <label>Completed (Auto-tracked)</label>
                <input className="input" type="number" readOnly value={form.completedLessons} style={{ opacity: 0.7, cursor: 'not-allowed', background: 'var(--surface)' }} />
              </div>
            </div>

            <div className="form-group" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 12, margin: '10px 0' }}>
              <input type="checkbox" id="hasPaid" checked={form.hasPaid} onChange={e => setForm(f => ({ ...f, hasPaid: e.target.checked }))} style={{ width: 18, height: 18 }} />
              <label htmlFor="hasPaid" style={{ margin: 0 }}>Student has paid for the package</label>
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

      {/* History Modal */}
      {historyStudent && (
        <div className="modal-overlay" onClick={() => setHistoryStudent(null)}>
          <div className="modal" style={{ maxWidth: 600 }} onClick={e => e.stopPropagation()}>
            <div className="modal-title">Lesson History: {historyStudent.name}</div>
            
            <div style={{ maxHeight: 400, overflowY: 'auto', marginTop: 15 }}>
              {loadingHistory ? (
                <div style={{ textAlign: 'center', padding: 40 }}>Loading history…</div>
              ) : history.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>No completed lessons recorded.</div>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Room</th>
                      <th>Time</th>
                      <th>Duration</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((h: any) => {
                      const startTime = h.startTime
                      const endTime = h.endTime
                      const dateObj = new Date(h.room.schedule.date)
                      const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long' })
                      const dateStr = dateObj.toLocaleDateString()
                      return (
                        <tr key={h.id}>
                          <td>
                            <div style={{ fontWeight: 600 }}>{dayName}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{dateStr}</div>
                          </td>
                          <td>{h.room.name}</td>
                          <td>{startTime} - {endTime}</td>
                          <td>{h.isBreak ? '—' : 'Lesson'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
            
            <div className="modal-actions">
              <button className="btn btn-primary" onClick={() => setHistoryStudent(null)}>Close</button>
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

