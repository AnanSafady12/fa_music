import { useState, useEffect, useCallback } from 'react'
import { DndContext, DragOverlay, useSensor, useSensors, PointerSensor } from '@dnd-kit/core'
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core'
import { INSTRUMENTS, PACKAGES, timeToMins, minsToTime, DAY_NAMES } from '../types'
import type { Schedule, Student, Room, Lesson } from '../types'
import {
  getStudents, getScheduleByDate, createSchedule, createLesson, updateLesson,
  deleteLesson, toggleAttendance, copyLastWeek, getSchedules,
  createStudent, updateStudent, deleteStudent, insertBreak
} from '../api'
import './SchedulePage.css'

export default function SchedulePage() {
  const [students, setStudents] = useState<Student[]>([])
  const [schedule, setSchedule] = useState<Schedule | null>(null)
  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date()
    return d.toISOString().split('T')[0]
  })
  const derivedDayName = DAY_NAMES[new Date(selectedDate + 'T12:00:00Z').getUTCDay()]
  const [search, setSearch] = useState('')
  const [filterInstrument, setFilterInstrument] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [dragging, setDragging] = useState<Student | null>(null)
  const [allSchedules, setAllSchedules] = useState<Schedule[]>([])
  const [quickPanelOpen, setQuickPanelOpen] = useState(false)
  const [quickTab, setQuickTab] = useState<'students'|'teachers'>('students')
  const [breakModal, setBreakModal] = useState<{ roomId: number; time: string } | null>(null)
  const [breakLabel, setBreakLabel] = useState('Break')
  const [breakDuration, setBreakDuration] = useState<number>(15)
  const [studentModal, setStudentModal] = useState(false)
  const [editingStudent, setEditingStudent] = useState<Student | null>(null)
  const [studentForm, setStudentForm] = useState({ name: '', parentName: '', phone: '', instrument: '', totalLessons: PACKAGES.STANDARD.lessons, completedLessons: 0, hasPaid: false, notes: '' })

  const loadStudents = async () => setStudents(await getStudents())
  const loadAllSchedules = async () => setAllSchedules(await getSchedules())

  const loadSchedule = useCallback(async (date: string) => {
    setLoading(true)
    try {
      const s = await getScheduleByDate(date)
      setSchedule(s)
    } catch {
      try {
        const derived = DAY_NAMES[new Date(date + 'T12:00:00Z').getUTCDay()]
        const s = await createSchedule({ dayName: derived, date })
        setSchedule(s)
        loadAllSchedules()
      } catch (err) {
        setSchedule(null)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadStudents()
    loadAllSchedules()
  }, [])

  useEffect(() => {
    loadSchedule(selectedDate)
  }, [selectedDate, loadSchedule])

  // Auto-creation now handles logic inside loadSchedule

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const handleDragStart = (e: DragStartEvent) => {
    const student = students.find(s => `student-${s.id}` === e.active.id)
    if (student) setDragging(student)
  }

  const handleDragEnd = async (e: DragEndEvent) => {
    setDragging(null)
    const { active, over } = e
    if (!over || !schedule) return

    const studentId = Number(String(active.id).replace('student-', ''))
    const [roomIdx, time] = String(over.id).split('::')
    const room = schedule.rooms[Number(roomIdx)]
    if (!room) return

    const existingLesson = room.lessons.find(l => l.startTime === time)
    if (existingLesson) return // slot occupied

    // Check if student is being moved from another slot
    let fromLesson: Lesson | null = null
    for (const r of schedule.rooms) {
      const l = r.lessons.find(l => l.studentId === studentId && !l.isBreak)
      if (l) { fromLesson = l; break }
    }

    setSaving(true)
    const newEnd = minsToTime(timeToMins(time) + 45)
    try {
      if (fromLesson) {
        await updateLesson(fromLesson.id, { roomId: room.id, studentId, startTime: time, endTime: newEnd, isBreak: false })
      } else {
        await createLesson({ roomId: room.id, studentId, startTime: time, endTime: newEnd, isBreak: false })
      }
      await loadSchedule(selectedDate)
    } finally { setSaving(false) }
  }

  const handleRemoveLesson = async (lessonId: number) => {
    setSaving(true)
    try { await deleteLesson(lessonId); await loadSchedule(selectedDate) } finally { setSaving(false) }
  }

  const handleToggleAttendance = async (lessonId: number) => {
    setSaving(true)
    try { await toggleAttendance(lessonId); await loadSchedule(selectedDate) } finally { setSaving(false) }
  }

  const handleCopyLastWeek = async () => {
    if (!allSchedules.length) return
    const sorted = [...allSchedules].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    const prev = sorted.find(s => s.date.split('T')[0] !== selectedDate)
    if (!prev) return alert('Could not find previous schedule to copy.')
    await copyLastWeek(prev.id, { targetDate: selectedDate, targetDayName: derivedDayName })
    await loadSchedule(selectedDate)
    await loadAllSchedules()
  }

  const handleAddBreak = async () => {
    if (!breakModal) return
    await insertBreak({ roomId: breakModal.roomId, startTime: breakModal.time, durationMins: breakDuration, label: breakLabel })
    setBreakModal(null); setBreakLabel('Break'); setBreakDuration(15)
    await loadSchedule(selectedDate)
  }

  // Quick student CRUD
  const openAddStudent = () => { setEditingStudent(null); setStudentForm({ name: '', parentName: '', phone: '', instrument: '', totalLessons: PACKAGES.STANDARD.lessons, completedLessons: 0, hasPaid: false, notes: '' }); setStudentModal(true) }
  const openEditStudent = (s: Student) => { setEditingStudent(s); setStudentForm({ name: s.name, parentName: s.parentName || '', phone: s.phone || '', instrument: s.instrument || '', totalLessons: s.totalLessons, completedLessons: s.completedLessons, hasPaid: s.hasPaid, notes: s.notes || '' }); setStudentModal(true) }
  const saveStudent = async () => {
    const payload = { ...studentForm, instrument: studentForm.instrument || null, totalLessons: Number(studentForm.totalLessons), completedLessons: Number(studentForm.completedLessons), hasPaid: studentForm.hasPaid }
    if (editingStudent) { await updateStudent(editingStudent.id, payload) } else { await createStudent(payload) }
    setStudentModal(false); loadStudents()
  }
  const removeStudent = async (id: number) => {
    if (!confirm('Are you sure you want to delete this student?')) return
    await deleteStudent(id); loadStudents()
  }

  const filteredStudents = students.filter(s => {
    const matchSearch = s.name.toLowerCase().includes(search.toLowerCase())
    const matchInstrument = !filterInstrument || s.instrument === filterInstrument
    return matchSearch && matchInstrument
  })

  return (
    <div className="schedule-page">
      {/* Top bar */}
      <div className="schedule-header">
        <div className="schedule-header-left">
          <span className="page-title">Schedule Builder</span>
          {saving && <span className="saving-indicator">💾 Saving...</span>}
        </div>
        <div className="schedule-header-right" style={{ alignItems: 'center', display: 'flex', gap: 20 }}>
          <div className="date-navigator" style={{ display: 'flex', alignItems: 'center', background: 'var(--surface)', borderRadius: '16px', padding: '6px 16px', border: '1px solid var(--border)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
            <button className="btn btn-ghost btn-icon" onClick={() => {
              const [y, m, d_] = selectedDate.split('-').map(Number);
              const dateObj = new Date(y, m - 1, d_);
              dateObj.setDate(dateObj.getDate() - 1);
              const newDate = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
              setSelectedDate(newDate);
            }} style={{ fontSize: 24, width: 40, height: 40 }}>&lsaquo;</button>
            
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '0 20px', cursor: 'pointer', position: 'relative' }}>
              <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent)' }}>{derivedDayName}</span>
              <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} style={{ position: 'absolute', opacity: 0, top: 0, left: 0, width: '100%', height: '100%', cursor: 'pointer' }} />
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{new Date(selectedDate).toLocaleDateString()}</span>
            </div>

            <button className="btn btn-ghost btn-icon" onClick={() => {
              const [y, m, d_] = selectedDate.split('-').map(Number);
              const dateObj = new Date(y, m - 1, d_);
              dateObj.setDate(dateObj.getDate() + 1);
              const newDate = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
              setSelectedDate(newDate);
            }} style={{ fontSize: 24, width: 40, height: 40 }}>&rsaquo;</button>
          </div>

          {schedule && (
            <button className="btn btn-gold" onClick={handleCopyLastWeek}>📋 Copy Last Week</button>
          )}
          <button className="btn btn-secondary" onClick={() => setQuickPanelOpen(p => !p)}>
            ⚙️ Quick Manage
          </button>
        </div>
      </div>

      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="schedule-body">
          {/* Left panel: student list */}
          <div className="student-panel">
            <div className="student-panel-header">
              <span style={{ fontWeight: 700, fontSize: 13 }}>Students</span>
              <span className="badge">{filteredStudents.length}</span>
            </div>
            <input className="input" placeholder="🔍 Search..." value={search} onChange={e => setSearch(e.target.value)} style={{ margin: '0 0 8px' }} />
            <select className="select" value={filterInstrument} onChange={e => setFilterInstrument(e.target.value)} style={{ marginBottom: 12 }}>
              <option value="">All Instruments</option>
              {INSTRUMENTS.map(i => <option key={i} value={i}>{i}</option>)}
            </select>
            <div className="student-list">
              {filteredStudents.map(s => (
                <DraggableStudentCard key={s.id} student={s} schedule={schedule} />
              ))}
              {filteredStudents.length === 0 && (
                <div style={{ color: 'var(--text-muted)', fontSize: 12, textAlign: 'center', padding: 20 }}>No students</div>
              )}
            </div>
          </div>

          {/* Right panel: rooms */}
          <div className="rooms-panel">
            {loading ? (
              <div className="empty-state" style={{ gridColumn: '1/-1' }}><p style={{ animation: 'pulse 1.5s infinite' }}>Loading Schedule...</p></div>
            ) : !schedule ? (
              <div className="no-schedule-state">
                <div className="no-schedule-icon">📅</div>
                <h3>Schedule unavailable</h3>
                <p>Failed to automatically generate schedule for this day.</p>
              </div>
            ) : (
              schedule.rooms.map((room, idx) => (
                <RoomTable
                  key={room.id}
                  room={room}
                  roomIndex={idx}
                  dayName={schedule.dayName}
                  onRemove={handleRemoveLesson}
                  onToggleAttendance={handleToggleAttendance}
                  onAddBreak={(time) => setBreakModal({ roomId: room.id, time })}
                />
              ))
            )}
          </div>
        </div>

        <DragOverlay>
          {dragging && (
            <div className="student-card dragging">
              <span className="student-card-name">{dragging.name}</span>
              {dragging.instrument && <span className="tag tag-instrument" style={{ fontSize: 10 }}>{dragging.instrument}</span>}
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {/* Quick Management Panel */}
      {quickPanelOpen && (
        <div className="quick-panel-overlay" onClick={() => setQuickPanelOpen(false)}>
          <div className="quick-panel" onClick={e => e.stopPropagation()}>
            <div className="quick-panel-header">
              <div style={{ display: 'flex', gap: 8 }}>
                <button className={`btn btn-sm ${quickTab === 'students' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setQuickTab('students')}>Students</button>
                <button className={`btn btn-sm ${quickTab === 'teachers' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setQuickTab('teachers')}>Teachers</button>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setQuickPanelOpen(false)}>✕</button>
            </div>
            {quickTab === 'students' && (
              <div className="quick-panel-body">
                <button className="btn btn-primary btn-sm" style={{ width: '100%', marginBottom: 12 }} onClick={openAddStudent}>+ Add Student</button>
                {students.map(s => (
                  <div className="quick-item" key={s.id}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{s.name}</div>
                      <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>{s.instrument || 'No Instrument'}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="btn btn-ghost btn-sm btn-icon" onClick={() => openEditStudent(s)}>✏️</button>
                      <button className="btn btn-danger btn-sm btn-icon" onClick={() => removeStudent(s.id)}>🗑️</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Break modal */}
      {breakModal && (
        <div className="modal-overlay" onClick={() => setBreakModal(null)}>
          <div className="modal" style={{ maxWidth: 340 }} onClick={e => e.stopPropagation()}>
            <div className="modal-title">Add Break</div>
            <div className="form-group">
              <label>Break Label</label>
              <input className="input" value={breakLabel} onChange={e => setBreakLabel(e.target.value)} placeholder="e.g. Lunch Break" />
            </div>
            <div className="form-group">
              <label>Duration (mins)</label>
              <input className="input" type="number" min="5" step="5" value={breakDuration} onChange={e => setBreakDuration(Number(e.target.value))} />
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setBreakModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleAddBreak}>Add Break</button>
            </div>
          </div>
        </div>
      )}

      {/* Quick student modal */}
      {studentModal && (
        <div className="modal-overlay" onClick={() => setStudentModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">{editingStudent ? 'Edit Student' : 'Add Student'}</div>
            <div className="form-row">
              <div className="form-group">
                <label>Name *</label>
                <input className="input" value={studentForm.name} onChange={e => setStudentForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>Instrument</label>
                <select className="select" value={studentForm.instrument} onChange={e => setStudentForm(f => ({ ...f, instrument: e.target.value }))}>
                  <option value="">Select...</option>
                  {INSTRUMENTS.map(i => <option key={i} value={i}>{i}</option>)}
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Parent Name</label>
                <input className="input" value={studentForm.parentName} onChange={e => setStudentForm(f => ({ ...f, parentName: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>Phone</label>
                <input className="input" value={studentForm.phone} onChange={e => setStudentForm(f => ({ ...f, phone: e.target.value }))} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>
                  Total
                  {!editingStudent && (
                    <span style={{color: 'var(--accent)', fontWeight: 600, marginLeft: 6, textTransform: 'none', fontSize: 10}}>
                      ({PACKAGES.STANDARD.name})
                    </span>
                  )}
                </label>
                <input className="input" type="number" min="0" value={studentForm.totalLessons} onChange={e => setStudentForm(f => ({ ...f, totalLessons: Number(e.target.value) }))} />
              </div>
              <div className="form-group">
                <label>Completed</label>
                <input className="input" type="number" min="0" value={studentForm.completedLessons} onChange={e => setStudentForm(f => ({ ...f, completedLessons: Number(e.target.value) }))} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <input type="checkbox" id="scheduleHasPaid" checked={studentForm.hasPaid} onChange={e => setStudentForm(f => ({ ...f, hasPaid: e.target.checked }))} style={{ width: 18, height: 18, cursor: 'pointer' }} />
                <label htmlFor="scheduleHasPaid" style={{ margin: 0, cursor: 'pointer' }}>Student has paid for the package</label>
              </div>
            </div>
            <div className="form-group">
              <label>Notes</label>
              <input className="input" value={studentForm.notes} onChange={e => setStudentForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setStudentModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveStudent} disabled={!studentForm.name.trim()}>
                {editingStudent ? 'Save' : 'Add'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ---- Sub-components ----

import { useDraggable, useDroppable } from '@dnd-kit/core'

function DraggableStudentCard({ student, schedule }: { student: Student; schedule: Schedule | null }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `student-${student.id}` })
  const rem = student.totalLessons - student.completedLessons
  const isScheduled = schedule?.rooms.some(r => r.lessons.some(l => l.studentId === student.id))

  return (
    <div
      ref={setNodeRef}
      className={`student-card ${isDragging ? 'dragging' : ''} ${isScheduled ? 'scheduled' : ''}`}
      {...listeners}
      {...attributes}
    >
      <div className="student-card-top">
        <span className="student-card-name">{student.name}</span>
        {isScheduled && <span style={{ fontSize: 10, color: 'var(--green)' }}>●</span>}
      </div>
      <div className="student-card-meta">
        {student.instrument && <span className="tag tag-instrument">{student.instrument}</span>}
        {rem <= 2 && student.totalLessons > 0 && (
          <span className="tag tag-warning" style={{ fontSize: 10 }}>{rem === 0 ? '⚠️ Completed' : `⚠️ ${rem}left`}</span>
        )}
      </div>
      {student.notes && <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3, fontStyle: 'italic' }}>{student.notes}</div>}
    </div>
  )
}

function generateRoomTimeline(dayName: string, lessons: Lesson[]) {
  const isWeekend = ['Friday','Saturday','Friday','Saturday'].includes(dayName)
  const startMins = timeToMins(isWeekend ? '10:00' : '16:00')
  const endMins = timeToMins(isWeekend ? '20:00' : '21:00')
  const SLOT_DURATION = 45

  const sortedLessons = [...lessons].sort((a, b) => timeToMins(a.startTime) - timeToMins(b.startTime))
  const items = []
  let cursor = startMins

  for (const lesson of sortedLessons) {
    const lStart = timeToMins(lesson.startTime)
    const lEnd = timeToMins(lesson.endTime)

    while (cursor < lStart) {
      const duration = Math.min(SLOT_DURATION, lStart - cursor)
      items.push({ type: 'empty', id: `empty-${cursor}`, startTime: minsToTime(cursor), endTime: minsToTime(cursor + duration), duration, lesson: null })
      cursor += duration
    }

    items.push({ type: lesson.isBreak ? 'break' : 'lesson', id: `lesson-${lesson.id}`, startTime: lesson.startTime, endTime: lesson.endTime, duration: lEnd - lStart, lesson })
    cursor = Math.max(cursor, lEnd)
  }

  while (cursor + SLOT_DURATION <= endMins) {
    items.push({ type: 'empty', id: `empty-${cursor}`, startTime: minsToTime(cursor), endTime: minsToTime(cursor + SLOT_DURATION), duration: SLOT_DURATION, lesson: null })
    cursor += SLOT_DURATION
  }

  if (cursor < endMins) {
    items.push({ type: 'empty', id: `empty-${cursor}`, startTime: minsToTime(cursor), endTime: minsToTime(endMins), duration: endMins - cursor, lesson: null })
  }

  return items
}

function RoomTable({ room, roomIndex, dayName, onRemove, onToggleAttendance, onAddBreak }: {
  room: Room; roomIndex: number; dayName: string;
  onRemove: (id: number) => void
  onToggleAttendance: (id: number) => void
  onAddBreak: (time: string) => void
}) {
  return (
    <div className="room-card">
      <div className="room-header">
        <span className="room-name">{room.name}</span>
        <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>{room.lessons.length} lessons</span>
      </div>
      <div className="room-slots">
        {generateRoomTimeline(dayName, room.lessons).map(slot => (
          <TimeSlot
            key={slot.id}
            roomIndex={roomIndex}
            time={slot.startTime}
            duration={slot.duration}
            lesson={slot.lesson || undefined}
            onRemove={onRemove}
            onToggleAttendance={onToggleAttendance}
            onAddBreak={onAddBreak}
          />
        ))}
      </div>
    </div>
  )
}

function TimeSlot({ roomIndex, time, duration, lesson, onRemove, onToggleAttendance, onAddBreak }: {
  roomIndex: number; time: string; duration: number; lesson?: Lesson
  onRemove: (id: number) => void
  onToggleAttendance: (id: number) => void
  onAddBreak: (time: string) => void
}) {
  const { isOver, setNodeRef } = useDroppable({ id: `${roomIndex}::${time}` })
  const endTimeStr = minsToTime(timeToMins(time) + duration)

  if (lesson?.isBreak) {
    return (
      <div className="time-slot break-slot">
        <span className="slot-time">{time} - {endTimeStr}</span>
        <span className="break-label">☕ {lesson.breakLabel || 'Break'} <span style={{opacity: 0.6, fontSize: 10}}>({duration}m)</span></span>
        <button className="slot-remove" onClick={() => onRemove(lesson.id)}>✕</button>
      </div>
    )
  }

  if (lesson?.student) {
    const rem = lesson.student.totalLessons - lesson.student.completedLessons
    return (
      <div className={`time-slot occupied ${!lesson.made ? 'not-made' : ''}`}>
        <span className="slot-time">{time} - {endTimeStr}</span>
        <div className="slot-student">
          <span className="slot-name">{lesson.student.name}</span>
          {rem <= 2 && lesson.student.totalLessons > 0 && (
            <span style={{ fontSize: 9, color: 'var(--red)' }}>⚠️</span>
          )}
          {lesson.student.notes && (
            <span title={lesson.student.notes} style={{ fontSize: 9, cursor: 'help' }}>📝</span>
          )}
        </div>
        {!lesson.made && <span className="not-made-label">Not Made</span>}
        <div className="slot-actions">
          <button
            className={`btn btn-sm ${lesson.made ? 'btn-ghost' : 'btn-danger'}`}
            onClick={() => onToggleAttendance(lesson.id)}
            title={lesson.made ? 'Mark as not made' : 'Mark as made'}
            style={{ padding: '2px 6px', fontSize: 10 }}
          >
            {lesson.made ? '✓' : '✗'}
          </button>
          <button className="slot-remove" onClick={() => onRemove(lesson.id)}>✕</button>
        </div>
      </div>
    )
  }

  return (
    <div ref={setNodeRef} className={`time-slot empty ${isOver ? 'drag-over' : ''}`}>
      <span className="slot-time">{time} - {endTimeStr}</span>
      <span className="slot-drop-hint">Drop here ({duration}m)</span>
      <button className="break-btn" onClick={() => onAddBreak(time)} title="Add break">☕</button>
    </div>
  )
}
