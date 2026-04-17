import { useState, useEffect, useRef } from 'react'
import html2canvas from 'html2canvas'
import { saveAs } from 'file-saver'
import type { Schedule } from '../types'
import { getSchedules } from '../api'
import './ExportPage.css'

export default function ExportPage() {
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [schedule, setSchedule] = useState<Schedule | null>(null)
  const [exporting, setExporting] = useState(false)
  const [exportResult, setExportResult] = useState<string | null>(null)
  const previewRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setExportResult(null)
  }, [selectedId, schedule])

  useEffect(() => {
    getSchedules().then(s => {
      setSchedules(s)
      if (s.length > 0) setSelectedId(s[0].id)
    })
  }, [])

  useEffect(() => {
    if (selectedId == null) return
    const s = schedules.find(sch => sch.id === selectedId) || null
    setSchedule(s)
  }, [selectedId, schedules])

  const handleExport = async () => {
    if (!previewRef.current) return
    setExporting(true)
    try {
      const canvas = await html2canvas(previewRef.current, {
        scale: 3,
        backgroundColor: '#ffffff',
        useCORS: true,
        logging: false,
      })
      const dataUrl = canvas.toDataURL('image/png')
      setExportResult(dataUrl)
      
      // Still attempt standard download for compatible browsers
      try {
        const filename = `FA-Music-Schedule-${schedule?.date?.split('T')[0] || 'export'}.png`
        canvas.toBlob((b) => { if(b) saveAs(b, filename) }, 'image/png')
      } catch {}
    } catch {
      // ignore
    } finally {
      setExporting(false)
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
          <div className="page-title">Export Schedule</div>
          <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 2 }}>Generate WhatsApp-ready PNG image</div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <select
            className="select"
            style={{ width: 220 }}
            value={selectedId ?? ''}
            onChange={e => setSelectedId(Number(e.target.value))}
          >
            <option value="">Select a day...</option>
            {schedules.map(s => (
              <option key={s.id} value={s.id}>
                {s.dayName} — {formatDate(s.date)}
              </option>
            ))}
          </select>
          <button
            className="btn btn-primary"
            onClick={handleExport}
            disabled={!schedule || exporting || !!exportResult}
          >
            {exporting ? '⏳ Generating...' : exportResult ? '✅ Ready!' : '🖼️ Generate PNG'}
          </button>
        </div>
      </div>

      <div className="page-body">
        {!schedule ? (
          <div className="empty-state">
            <h3>No schedule selected</h3>
            <p>Create a schedule first, then return here to export.</p>
          </div>
        ) : (
          <div className="export-wrapper">
            <div className="export-preview-card">
              {/* The template that gets captured */}
              <div ref={previewRef} className="export-template">
                {/* Header */}
                <div className="export-header">
                  <img src="/fa-logo.jpg" alt="FA Music Logo" className="export-logo" style={{ width: '80px', height: '80px', objectFit: 'contain', borderRadius: '4px', background: 'transparent' }} />
                  <div>
                    <h1 className="export-institute">FA Music Institute</h1>
                    <div className="export-date-line">
                      {schedule.dayName} &nbsp;·&nbsp; {formatDate(schedule.date)}
                    </div>
                  </div>
                </div>

                <div className="export-rooms">
                  {schedule.rooms.map(room => (
                    <div className="export-room" key={room.id}>
                      <div className="export-room-title">{room.name}</div>
                      <table className="export-table">
                        <thead>
                          <tr>
                            <th>Time</th>
                            <th>Student</th>
                          </tr>
                        </thead>
                        <tbody>
                          {room.lessons.length === 0 ? (
                            <tr><td colSpan={2} style={{ textAlign: 'center', color: '#bbb', fontStyle: 'italic' }}>No lessons</td></tr>
                          ) : (
                            [...room.lessons]
                              .sort((a, b) => a.startTime.localeCompare(b.startTime))
                              .map(l => (
                                <tr key={l.id} className={l.isBreak ? 'export-break-row' : (!l.made ? 'export-not-made-row' : '')}>
                                  <td className="export-time">{l.startTime} - {l.endTime}</td>
                                  <td className="export-student">
                                    {l.isBreak ? `☕ ${l.breakLabel || 'Break'}` : (l.student?.name || '—')}
                                    {!l.made && !l.isBreak && <span className="export-not-made"> (Not made)</span>}
                                  </td>
                                </tr>
                              ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  ))}
                </div>

                <div className="export-footer">FA Music Institute · Schedule</div>
              </div>

              {exportResult && (
                <div className="export-result-overlay">
                  <div className="export-result-message">
                    <h3>✅ Image Generated Successfully!</h3>
                    <p>Your browser blocked the automatic download filename.</p>
                    <p style={{ marginTop: 8 }}>
                      <strong>Mac/PC:</strong> Right-click and select "Save Image As..."
                    </p>
                    <p>
                      <strong>Mobile:</strong> Long-press and select "Save to Photos" or "Share".
                    </p>
                    <button className="btn btn-secondary" onClick={() => setExportResult(null)} style={{ marginTop: 12 }}>
                      Close & Edit
                    </button>
                  </div>
                  <img src={exportResult} alt="Schedule Export" className="export-result-img" />
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
