import { useState, useEffect } from 'react'
import { getSummary, updateTeacherStats, updateWorker, getWorkerLogs, createWorkerLog, updateWorkerLog, deleteWorkerLog } from '../api'
import './HomePage.css'

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const YEARS = Array.from({ length: 7 }, (_, i) => 2024 + i)

export default function HomePage() {
  const [summary, setSummary] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  
  // Local state for editing worker
  const [workerForm, setWorkerForm] = useState<any>(null)
  const [isEditingWorker, setIsEditingWorker] = useState(false)
  const [isSavingWorker, setIsSavingWorker] = useState(false)
  
  // Local state for worker logs
  const [logs, setLogs] = useState<any[]>([])
  const [newLogForm, setNewLogForm] = useState({
    date: new Date().toISOString().split('T')[0],
    hours: '',
    notes: ''
  })

  // Local state for editing individual log rows
  const [editingLogId, setEditingLogId] = useState<number | null>(null)
  const [editingLogForm, setEditingLogForm] = useState({
    date: '',
    hours: '',
    costPerHour: '',
    notes: ''
  })
  // Local state for editing teacher notes
  const [editingTeacherId, setEditingTeacherId] = useState<number | null>(null)
  const [teacherNotes, setTeacherNotes] = useState('')



  const load = () => {
    setLoading(true)
    getSummary(selectedMonth, selectedYear).then(data => {
      setSummary(data)
      setWorkerForm(data.worker)
      setLoading(false)
    }).catch(err => {
      console.error(err)
      setLoading(false)
    })

    getWorkerLogs(selectedMonth, selectedYear).then(data => {
      setLogs(data)
    }).catch(err => {
      console.error(err)
    })
  }

  useEffect(() => {
    load()
  }, [selectedMonth, selectedYear])

  const handleAddLog = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newLogForm.date || !newLogForm.hours) return
    try {
      await createWorkerLog({
        date: newLogForm.date,
        hours: Number(newLogForm.hours),
        costPerHour: summary.worker.costPerHour,
        notes: newLogForm.notes
      })
      setNewLogForm({
        date: new Date().toISOString().split('T')[0],
        hours: '',
        notes: ''
      })
      load()
    } catch (err) {
      console.error(err)
    }
  }

  const handleDeleteLog = async (logId: number) => {
    if (!confirm('Are you sure you want to delete this log?')) return
    try {
      await deleteWorkerLog(logId)
      load()
    } catch (err) {
      console.error(err)
    }
  }

  const startEditLog = (log: any) => {
    setEditingLogId(log.id)
    setEditingLogForm({
      date: log.date.split('T')[0],
      hours: String(log.hours),
      costPerHour: String(log.costPerHour),
      notes: log.notes || ''
    })
  }

  const saveLogEdit = async (logId: number) => {
    if (!editingLogForm.date || !editingLogForm.hours || !editingLogForm.costPerHour) return
    try {
      await updateWorkerLog(logId, {
        date: editingLogForm.date,
        hours: Number(editingLogForm.hours),
        costPerHour: Number(editingLogForm.costPerHour),
        notes: editingLogForm.notes
      })
      setEditingLogId(null)
      load()
    } catch (err) {
      console.error(err)
    }
  }

  const saveWorker = async () => {
    setIsSavingWorker(true)
    try {
      await updateWorker(workerForm)
      setIsEditingWorker(false)
      load()
    } finally {
      setIsSavingWorker(false)
    }
  }

  const startEditNotes = (t: any) => {
    setEditingTeacherId(t.id)
    setTeacherNotes(t.notes || '')
  }

  const saveTeacherNotes = async () => {
    if (editingTeacherId === null) return
    await updateTeacherStats({
      teacherId: editingTeacherId,
      month: selectedMonth,
      year: selectedYear,
      notes: teacherNotes,
      manualSalary: null
    })
    setEditingTeacherId(null)
    load()
  }

  if (loading) {
    return <div className="page-loading">Loading Dashboard...</div>
  }

  if (!summary) {
    return <div className="page-error">Failed to load summary.</div>
  }

  return (
    <div className="home-page">
      <div className="dashboard-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '1rem', marginBottom: '2.5rem' }}>
        <div>
          <h1 style={{ margin: 0 }}>Institute Overview</h1>
          <p style={{ margin: '4px 0 0 0', color: 'var(--text-muted)' }}>Viewing stats for {MONTHS[selectedMonth - 1]} {selectedYear}</p>
        </div>
        
        <div className="dashboard-filters" style={{ display: 'flex', gap: 12 }}>
          <div className="form-group" style={{ margin: 0 }}>
            <select className="select" value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))} style={{ minWidth: 140 }}>
              {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <select className="select" value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))} style={{ minWidth: 100 }}>
              {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-title">Total Students</div>
          <div className="metric-value">
            {summary.students.totalStudents}
          </div>
          <div className="metric-subtitle">All registered students</div>
        </div>

        <div className="metric-card">
          <div className="metric-title">Active Memberships</div>
          <div className="metric-value" style={{ color: 'var(--accent)' }}>
            {summary.students.activeStudents}
          </div>
          <div className="metric-subtitle">Remaining lessons available</div>
        </div>

        <div className="metric-card">
          <div className="metric-title">Teachers Payroll</div>
          <div className="metric-value" style={{ color: 'var(--gold)' }}>
            ₪{summary.totalTeacherLiabilities.toLocaleString()}
          </div>
          <div className="metric-subtitle">Lessons taught total</div>
        </div>

        <div className="metric-card">
          <div className="metric-title">Monthly Payroll</div>
          <div className="metric-value" style={{ color: 'var(--red)' }}>
            ₪{(summary.grandTotalLiabilities || 0).toLocaleString()}
          </div>
          <div className="metric-subtitle">Including workers & teachers</div>
        </div>
      </div>

      <div className="dashboard-tables">
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h3 style={{ margin: 0 }}>Teacher Breakdown - {MONTHS[selectedMonth - 1]}</h3>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Teacher Name</th>
                <th>Rate (/Lesson)</th>
                <th>Lessons Taught</th>
                <th>Total Salary</th>
                <th>Notes</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {summary.teacherSalaries.map((t: any) => (
                <tr key={t.id}>
                  <td style={{ fontWeight: 600 }}>{t.name}</td>
                  <td style={{ color: 'var(--text-muted)' }}>₪{t.costPerLesson}</td>
                  <td>{t.lessonsTaught}</td>
                  <td>
                    <span style={{ color: 'var(--accent)', fontWeight: 700 }}>₪{t.calculatedSalary}</span>
                  </td>
                  <td>
                    {editingTeacherId === t.id ? (
                      <input 
                        className="input" 
                        style={{ minWidth: 200, padding: '4px 8px' }}
                        value={teacherNotes}
                        onChange={e => setTeacherNotes(e.target.value)}
                        placeholder="Add note..."
                      />
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>{t.notes || '—'}</span>
                    )}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {editingTeacherId === t.id ? (
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        <button className="btn btn-primary btn-sm" onClick={saveTeacherNotes}>Save</button>
                        <button className="btn btn-secondary btn-sm" onClick={() => setEditingTeacherId(null)}>Cancel</button>
                      </div>
                    ) : (
                      <button className="btn btn-ghost btn-sm" onClick={() => startEditNotes(t)}>✏️</button>
                    )}
                  </td>
                </tr>
              ))}
              {summary.teacherSalaries.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 20 }}>No lessons taught yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Worker Section */}
        <div className="card worker-card" style={{ gridColumn: '1 / -1' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h3 style={{ margin: 0 }}>Institute Worker & Daily Logs</h3>
            {!isEditingWorker ? (
              <button className="btn btn-ghost btn-sm" onClick={() => setIsEditingWorker(true)}>⚙️ Configure Worker</button>
            ) : (
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-primary btn-sm" onClick={saveWorker} disabled={isSavingWorker}>
                  {isSavingWorker ? 'Saving...' : 'Save Config'}
                </button>
                <button className="btn btn-secondary btn-sm" onClick={() => { setIsEditingWorker(false); setWorkerForm(summary.worker); }}>Cancel</button>
              </div>
            )}
          </div>
          
          <div className="form-row" style={{ gridTemplateColumns: 'repeat(2, 1fr)', gap: '20px', marginBottom: '1.5rem' }}>
            <div className="form-group">
              <label>Worker Name</label>
              {isEditingWorker ? (
                <input 
                  className="input" 
                  value={workerForm?.name || ''} 
                  onChange={e => setWorkerForm((f: any) => ({ ...f, name: e.target.value }))} 
                />
              ) : (
                <div style={{ padding: '8px 0', fontWeight: 600 }}>{workerForm?.name || 'Worker'}</div>
              )}
            </div>
            <div className="form-group">
              <label>Cost / Hour (₪)</label>
              {isEditingWorker ? (
                <input 
                  type="number"
                  className="input" 
                  value={workerForm?.costPerHour || 0} 
                  onChange={e => setWorkerForm((f: any) => ({ ...f, costPerHour: Number(e.target.value) }))} 
                />
              ) : (
                <div style={{ padding: '8px 0', color: 'var(--text-secondary)' }}>₪{workerForm?.costPerHour || 0}</div>
              )}
            </div>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '1.5rem 0' }} />

          <h4 style={{ marginBottom: '1rem' }}>Log Hours for {MONTHS[selectedMonth - 1]}</h4>
          <form onSubmit={handleAddLog} className="form-row" style={{ gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', alignItems: 'flex-end', marginBottom: '1.5rem' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label>Date</label>
              <input 
                type="date" 
                className="input" 
                value={newLogForm.date} 
                onChange={e => setNewLogForm(f => ({ ...f, date: e.target.value }))}
                required
              />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label>Hours Worked</label>
              <input 
                type="number" 
                step="0.1" 
                min="0"
                placeholder="e.g. 5" 
                className="input" 
                value={newLogForm.hours} 
                onChange={e => setNewLogForm(f => ({ ...f, hours: e.target.value }))}
                required
              />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label>Day/Description Notes</label>
              <input 
                type="text" 
                placeholder="e.g. Sunday 1 June" 
                className="input" 
                value={newLogForm.notes} 
                onChange={e => setNewLogForm(f => ({ ...f, notes: e.target.value }))}
              />
            </div>
            <button type="submit" className="btn btn-primary" style={{ height: 38, justifyContent: 'center' }}>
              ➕ Add Daily Log
            </button>
          </form>

          <div style={{ maxHeight: 300, overflowY: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Hours Worked</th>
                  <th>Rate (/Hour)</th>
                  <th>Payout</th>
                  <th>Notes/Description</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log: any) => {
                  const isEditingThisRow = editingLogId === log.id
                  const logDate = new Date(log.date)
                  const weekday = logDate.toLocaleDateString('en-US', { weekday: 'long' })
                  const dateStr = logDate.toLocaleDateString('en-GB')
                  return (
                    <tr key={log.id}>
                      {isEditingThisRow ? (
                        <>
                          <td>
                            <input 
                              type="date" 
                              className="input" 
                              style={{ padding: '4px 8px', fontSize: 13, height: 32 }}
                              value={editingLogForm.date}
                              onChange={e => setEditingLogForm(f => ({ ...f, date: e.target.value }))}
                            />
                          </td>
                          <td>
                            <input 
                              type="number" 
                              step="0.1"
                              min="0"
                              className="input" 
                              style={{ width: 80, padding: '4px 8px', fontSize: 13, height: 32 }}
                              value={editingLogForm.hours}
                              onChange={e => setEditingLogForm(f => ({ ...f, hours: e.target.value }))}
                            />
                          </td>
                          <td>
                            <input 
                              type="number" 
                              className="input" 
                              style={{ width: 80, padding: '4px 8px', fontSize: 13, height: 32 }}
                              value={editingLogForm.costPerHour}
                              onChange={e => setEditingLogForm(f => ({ ...f, costPerHour: e.target.value }))}
                            />
                          </td>
                          <td style={{ color: 'var(--gold)', fontWeight: 600 }}>
                            ₪{((Number(editingLogForm.hours) || 0) * (Number(editingLogForm.costPerHour) || 0)).toLocaleString()}
                          </td>
                          <td>
                            <input 
                              type="text" 
                              className="input" 
                              style={{ minWidth: 150, padding: '4px 8px', fontSize: 13, height: 32 }}
                              value={editingLogForm.notes}
                              onChange={e => setEditingLogForm(f => ({ ...f, notes: e.target.value }))}
                              placeholder="Description..."
                            />
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                              <button className="btn btn-primary btn-sm" onClick={() => saveLogEdit(log.id)}>Save</button>
                              <button className="btn btn-secondary btn-sm" onClick={() => setEditingLogId(null)}>Cancel</button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td style={{ fontWeight: 600 }}>{weekday}, {dateStr}</td>
                          <td>{log.hours} hrs</td>
                          <td style={{ color: 'var(--text-muted)' }}>₪{log.costPerHour}</td>
                          <td style={{ color: 'var(--gold)', fontWeight: 600 }}>₪{(log.hours * log.costPerHour).toLocaleString()}</td>
                          <td style={{ color: 'var(--text-secondary)' }}>{log.notes || '—'}</td>
                          <td style={{ textAlign: 'right' }}>
                            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                              <button className="btn btn-ghost btn-sm" onClick={() => startEditLog(log)}>✏️</button>
                              <button className="btn btn-danger btn-sm btn-icon" onClick={() => handleDeleteLog(log.id)}>🗑️</button>
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  )
                })}
                {logs.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)' }}>
                      No hours logged for {MONTHS[selectedMonth - 1]} {selectedYear}.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          
          <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'var(--bg-800)', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Total Month Hours: </span>
              <span style={{ fontWeight: 700, color: 'var(--text-primary)', marginLeft: 6 }}>
                {logs.reduce((sum, l) => sum + l.hours, 0)} hrs
              </span>
            </div>
            <div>
              <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Current Month Payout: </span>
              <span style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--gold)', marginLeft: 6 }}>
                ₪{summary.workerLiability.toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

