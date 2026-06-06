import { useState, useEffect, useRef, createRef } from 'react'
import html2canvas from 'html2canvas'
import { saveAs } from 'file-saver'
import type { Schedule, Room } from '../types'
import { getSchedules } from '../api'
import './ExportPage.css'

export default function ExportPage() {
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [schedule, setSchedule] = useState<Schedule | null>(null)
  const [exporting, setExporting] = useState<Record<number, boolean>>({})
  const [exportResults, setExportResults] = useState<Record<number, string>>({})
  const [exportingAll, setExportingAll] = useState(false)
  const roomRefs = useRef<Record<number, React.RefObject<HTMLDivElement>>>({})

  useEffect(() => {
    setExportResults({})
  }, [selectedId, schedule])

  useEffect(() => {
    getSchedules().then((s: Schedule[]) => {
      setSchedules(s)
      if (s.length > 0) {
        const sortedDesc = [...s].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        const newestWithLessons = sortedDesc.find(sch =>
          sch.rooms.some(r => r.lessons && r.lessons.length > 0)
        )
        if (newestWithLessons) {
          setSelectedId(newestWithLessons.id)
        } else {
          setSelectedId(sortedDesc[0].id)
        }
      }
    })
  }, [])

  useEffect(() => {
    if (selectedId == null) return
    const s = schedules.find(sch => sch.id === selectedId) || null
    setSchedule(s)
  }, [selectedId, schedules])

  // Create refs for each room
  useEffect(() => {
    if (!schedule) return
    const refs: Record<number, React.RefObject<HTMLDivElement>> = {}
    schedule.rooms.forEach(room => {
      refs[room.id] = roomRefs.current[room.id] || createRef<HTMLDivElement>()
    })
    roomRefs.current = refs
  }, [schedule])

  const captureRoom = async (room: Room): Promise<{ dataUrl: string; blob: Blob | null }> => {
    const ref = roomRefs.current[room.id]
    if (!ref?.current) return { dataUrl: '', blob: null }

    const canvas = await html2canvas(ref.current, {
      scale: 3,
      backgroundColor: '#ffffff',
      useCORS: true,
      logging: false,
    })
    const dataUrl = canvas.toDataURL('image/png')
    const blob = await new Promise<Blob | null>(resolve => {
      canvas.toBlob(b => resolve(b), 'image/png')
    })
    return { dataUrl, blob }
  }

  const handleExportRoom = async (room: Room) => {
    setExporting(prev => ({ ...prev, [room.id]: true }))
    try {
      const { dataUrl, blob } = await captureRoom(room)
      setExportResults(prev => ({ ...prev, [room.id]: dataUrl }))
      if (blob) {
        const dateStr = schedule?.date?.split('T')[0] || 'export'
        const filename = `FA-Music-${room.name}-${dateStr}.png`
        saveAs(blob, filename)
      }
    } catch {
      // ignore
    } finally {
      setExporting(prev => ({ ...prev, [room.id]: false }))
    }
  }

  const handleExportAll = async () => {
    if (!schedule) return
    setExportingAll(true)
    try {
      for (const room of schedule.rooms) {
        await handleExportRoom(room)
        // Small delay between exports so browser can handle downloads
        await new Promise(r => setTimeout(r, 300))
      }
    } finally {
      setExportingAll(false)
    }
  }

  const formatDate = (d: string) => {
    try { return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) }
    catch { return d }
  }

  const allExported = schedule ? schedule.rooms.every(r => !!exportResults[r.id]) : false

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Export Schedule</div>
          <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 2 }}>Generate WhatsApp-ready PNG — one image per room</div>
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
            onClick={handleExportAll}
            disabled={!schedule || exportingAll || allExported}
          >
            {exportingAll ? '⏳ Generating All...' : allExported ? '✅ All Done!' : '🖼️ Export All Rooms'}
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
          <div className="export-rooms-grid">
            {schedule.rooms.map(room => (
              <div className="export-room-card" key={room.id}>
                {/* Individual room export button */}
                <div className="export-room-actions">
                  <span className="export-room-label">{room.name}</span>
                  <button
                    className={`btn ${exportResults[room.id] ? 'btn-success' : 'btn-primary'} btn-sm`}
                    onClick={() => handleExportRoom(room)}
                    disabled={exporting[room.id] || !!exportResults[room.id]}
                  >
                    {exporting[room.id] ? '⏳...' : exportResults[room.id] ? '✅ Done' : '📥 Export'}
                  </button>
                </div>

                {/* The template that gets captured — one per room */}
                <div ref={roomRefs.current[room.id]} className="export-template">
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

                  {/* Single room content */}
                  <div className="export-single-room">
                    <div className="export-room">
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
                  </div>

                  <div className="export-footer">FA Music Institute · {room.name}</div>
                </div>

                {/* Show generated image inline if exported */}
                {exportResults[room.id] && (
                  <div className="export-result-inline">
                    <p className="export-result-hint">
                      📱 <strong>Mobile:</strong> Long-press image → Save to Photos
                    </p>
                    <img src={exportResults[room.id]} alt={`${room.name} Export`} className="export-result-img-inline" />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
