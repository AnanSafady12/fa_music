import { useState, useEffect } from 'react'
import { getSummary, updateTeacherStats, updateWorker } from '../api'
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
  
  // Local state for editing teacher notes/salary
  const [editingTeacherId, setEditingTeacherId] = useState<number | null>(null)
  const [teacherForm, setTeacherForm] = useState({ notes: '', manualSalary: '' as string | number })

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
  }

  useEffect(() => {
    load()
  }, [selectedMonth, selectedYear])

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

  const startEditTeacher = (t: any) => {
    setEditingTeacherId(t.id)
    setTeacherForm({ notes: t.notes || '', manualSalary: t.earnedSalary })
  }

  const saveTeacherStats = async () => {
    if (editingTeacherId === null) return
    await updateTeacherStats({
      teacherId: editingTeacherId,
      month: selectedMonth,
      year: selectedYear,
      notes: teacherForm.notes,
      manualSalary: Number(teacherForm.manualSalary)
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
      <div className="dashboard-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '2.5rem' }}>
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

      <div className="metrics-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
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
                <th>Manual Salary (Override)</th>
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
                    {editingTeacherId === t.id ? (
                      <input 
                        type="number" 
                        className="input" 
                        style={{ width: 100, padding: '4px 8px' }}
                        value={teacherForm.manualSalary}
                        onChange={e => setTeacherForm(f => ({ ...f, manualSalary: e.target.value }))}
                      />
                    ) : (
                      <span style={{ color: 'var(--accent)', fontWeight: 700 }}>₪{t.earnedSalary}</span>
                    )}
                  </td>
                  <td>
                    {editingTeacherId === t.id ? (
                      <input 
                        className="input" 
                        style={{ minWidth: 200, padding: '4px 8px' }}
                        value={teacherForm.notes}
                        onChange={e => setTeacherForm(f => ({ ...f, notes: e.target.value }))}
                        placeholder="Add note..."
                      />
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>{t.notes || '—'}</span>
                    )}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {editingTeacherId === t.id ? (
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        <button className="btn btn-primary btn-sm" onClick={saveTeacherStats}>Save</button>
                        <button className="btn btn-secondary btn-sm" onClick={() => setEditingTeacherId(null)}>Cancel</button>
                      </div>
                    ) : (
                      <button className="btn btn-ghost btn-sm" onClick={() => startEditTeacher(t)}>✏️ Edit Row</button>
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
        <div className="card worker-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h3 style={{ margin: 0 }}>Institute Worker</h3>
            {!isEditingWorker ? (
              <button className="btn btn-ghost btn-sm" onClick={() => setIsEditingWorker(true)}>✏️ Edit Worker</button>
            ) : (
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-primary btn-sm" onClick={saveWorker} disabled={isSavingWorker}>
                  {isSavingWorker ? 'Saving...' : 'Save Changes'}
                </button>
                <button className="btn btn-secondary btn-sm" onClick={() => { setIsEditingWorker(false); setWorkerForm(summary.worker); }}>Cancel</button>
              </div>
            )}
          </div>
          
          <div className="form-row" style={{ gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
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
            <div className="form-group">
              <label>Hours Worked</label>
              {isEditingWorker ? (
                <input 
                  type="number"
                  className="input" 
                  value={workerForm?.totalHours || 0} 
                  onChange={e => setWorkerForm((f: any) => ({ ...f, totalHours: Number(e.target.value) }))} 
                />
              ) : (
                <div style={{ padding: '8px 0', color: 'var(--text-secondary)' }}>{workerForm?.totalHours || 0} hrs</div>
              )}
            </div>
          </div>
          
          <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'var(--bg-800)', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Current Month Payout:</span>
            <span style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--gold)' }}>
              ₪{( (workerForm?.costPerHour || 0) * (workerForm?.totalHours || 0) ).toLocaleString()}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

