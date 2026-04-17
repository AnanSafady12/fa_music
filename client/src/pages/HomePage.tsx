import { useState, useEffect } from 'react'
import { getSummary } from '../api'
import './HomePage.css'

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const YEARS = Array.from({ length: 7 }, (_, i) => 2024 + i)

export default function HomePage() {
  const [summary, setSummary] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())

  useEffect(() => {
    setLoading(true)
    getSummary(selectedMonth, selectedYear).then(data => {
      setSummary(data)
      setLoading(false)
    }).catch(err => {
      console.error(err)
      setLoading(false)
    })
  }, [selectedMonth, selectedYear])

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

      <div className="metrics-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <div className="metric-card">
          <div className="metric-title">Active Memberships</div>
          <div className="metric-value" style={{ color: 'var(--blue)' }}>
            {summary.students.activeStudents}
          </div>
          <div className="metric-subtitle">Students with remaining lessons</div>
        </div>

        <div className="metric-card">
          <div className="metric-title">Monthly Payroll</div>
          <div className="metric-value" style={{ color: 'var(--red)' }}>
            ₪{summary.totalTeacherLiabilities.toLocaleString()}
          </div>
          <div className="metric-subtitle">Total for {MONTHS[selectedMonth - 1]}</div>
        </div>
      </div>

      <div className="dashboard-tables">
        <div className="card">
          <h3>Teacher Breakdown - {MONTHS[selectedMonth - 1]}</h3>
          <table className="data-table">
            <thead>
              <tr>
                <th>Teacher Name</th>
                <th>Rate (/Lesson)</th>
                <th>Lessons Taught</th>
                <th>Total Earned (₪)</th>
              </tr>
            </thead>
            <tbody>
              {summary.teacherSalaries.map((t: any) => (
                <tr key={t.id}>
                  <td style={{ fontWeight: 600 }}>{t.name}</td>
                  <td style={{ color: 'var(--text-muted)' }}>₪{t.costPerLesson}</td>
                  <td>{t.lessonsTaught}</td>
                  <td style={{ color: 'var(--accent)', fontWeight: 700 }}>₪{t.earnedSalary}</td>
                </tr>
              ))}
              {summary.teacherSalaries.length === 0 && (
                <tr><td colSpan={4} style={{ textAlign: 'center', padding: 20 }}>No lessons taught yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
