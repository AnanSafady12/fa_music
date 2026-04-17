import { useState, useEffect } from 'react'
import { 
  getSchedules, deleteSchedule,
  getStudents, deleteStudent,
  getTeachers, deleteTeacher
} from '../api'

export default function DatabasePage() {
  const [activeTab, setActiveTab] = useState<'schedules' | 'students' | 'teachers'>('schedules')
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: number, type: string, name: string } | null>(null)

  const loadData = async () => {
    setLoading(true)
    try {
      if (activeTab === 'schedules') {
        const res = await getSchedules()
        // Sort newest first
        res.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
        setData(res)
      } else if (activeTab === 'students') {
        setData(await getStudents())
      } else if (activeTab === 'teachers') {
        setData(await getTeachers())
      }
    } catch {
      // Ignore
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [activeTab])

  const handleDelete = async () => {
    if (!deleteConfirm) return
    try {
      if (deleteConfirm.type === 'schedules') await deleteSchedule(deleteConfirm.id)
      else if (deleteConfirm.type === 'students') await deleteStudent(deleteConfirm.id)
      else if (deleteConfirm.type === 'teachers') await deleteTeacher(deleteConfirm.id)
      setDeleteConfirm(null)
      loadData()
    } catch {
      alert('Failed to delete item.')
    }
  }

  const formatDate = (d: string) => {
    try { return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) }
    catch { return d }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Database Management</div>
          <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 2 }}>
            Central administration hub for managing raw data
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <button className={`btn ${activeTab === 'schedules' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab('schedules')}>Schedules</button>
        <button className={`btn ${activeTab === 'students' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab('students')}>Students</button>
        <button className={`btn ${activeTab === 'teachers' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab('teachers')}>Teachers</button>
      </div>

      <div className="page-body">
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {loading ? (
            <div className="empty-state"><p style={{ animation: 'pulse 1.5s infinite' }}>Loading…</p></div>
          ) : data.length === 0 ? (
            <div className="empty-state"><h3>No records found</h3></div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  {activeTab === 'schedules' && (
                    <>
                      <th>Day</th>
                      <th>Date</th>
                    </>
                  )}
                  {activeTab === 'students' && (
                    <>
                      <th>Name</th>
                      <th>Instrument</th>
                    </>
                  )}
                  {activeTab === 'teachers' && (
                    <>
                      <th>Name</th>
                      <th>Phone</th>
                    </>
                  )}
                  <th style={{ width: 80, textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {data.map(item => (
                  <tr key={item.id}>
                    {activeTab === 'schedules' && (
                       <>
                         <td style={{ fontWeight: 600 }}>{item.dayName}</td>
                         <td>{formatDate(item.date)}</td>
                       </>
                    )}
                    {activeTab === 'students' && (
                       <>
                         <td style={{ fontWeight: 600 }}>{item.name}</td>
                         <td>{item.instrument || '—'}</td>
                       </>
                    )}
                    {activeTab === 'teachers' && (
                       <>
                         <td style={{ fontWeight: 600 }}>{item.name}</td>
                         <td>{item.phone || '—'}</td>
                       </>
                    )}
                    <td>
                      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <button 
                          className="btn btn-danger btn-sm" 
                          onClick={() => setDeleteConfirm({ 
                            id: item.id, 
                            type: activeTab, 
                            name: activeTab === 'schedules' ? `${item.dayName} (${formatDate(item.date)})` : item.name 
                          })}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {deleteConfirm && (
        <div className="modal-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="modal" style={{ maxWidth: 360 }} onClick={e => e.stopPropagation()}>
            <div className="modal-title" style={{ color: 'var(--red)' }}>⚠️ Confirm Deletion</div>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 12 }}>
              Are you absolute sure you want to delete <strong style={{ color: 'var(--text-primary)' }}>{deleteConfirm.name}</strong>?
            </p>
            {deleteConfirm.type === 'schedules' && (
               <div style={{ padding: '10px 12px', background: 'var(--bg)', borderRadius: 6, fontSize: 12, color: 'var(--text-secondary)', marginBottom: 20 }}>
                 <strong style={{ color: 'var(--red)' }}>Warning:</strong> Removing a schedule will permanently delete all rooms and assigned lessons for this specific day.
               </div>
            )}
            <div className="modal-actions" style={{ marginTop: deleteConfirm.type === 'schedules' ? 0 : 20 }}>
              <button className="btn btn-secondary" onClick={() => setDeleteConfirm(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={handleDelete}>Permanently Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
