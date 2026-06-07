import { useState, useEffect, useCallback } from 'react'
import { DndContext, DragOverlay, useSensor, useSensors, MouseSensor, TouchSensor } from '@dnd-kit/core'

import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core'
import { INSTRUMENTS, PACKAGES, timeToMins, minsToTime, DAY_NAMES } from '../types'
import type { Schedule, Student, Room, Lesson, Teacher } from '../types'
import {
  getStudents, getScheduleByDate, createSchedule, createLesson, updateLesson,
  deleteLesson, toggleAttendance, copyLastWeek, getSchedules,
  createStudent, updateStudent, deleteStudent, insertBreak, updateRoom,
  getTeachers
} from '../api'
import './SchedulePage.css'

export default function SchedulePage() {
  const [students, setStudents] = useState<Student[]>([])
  const [teachers, setTeachers] = useState<Teacher[]>([])
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
  const [studentForm, setStudentForm] = useState({ name: '', parentName: '', phone: '', phone2: '', age: '' as string | number, instrument: '', totalLessons: PACKAGES.STANDARD.lessons, completedLessons: 0, hasPaid: false, paidPacks: '', notes: '' })
  const [durationModal, setDurationModal] = useState<{ lesson: Lesson, duration: number } | null>(null)
  const [teacherSelectModal, setTeacherSelectModal] = useState<{
    studentId: number
    roomId: number
    time: string
    existingLessonId?: number
    sameInstrumentTeachers: Teacher[]
  } | null>(null)

  const loadStudents = async () => setStudents(await getStudents())
  const loadAllSchedules = async () => setAllSchedules(await getSchedules())
  const loadTeachers = async () => {
    try {
      setTeachers(await getTeachers())
    } catch (err) {
      console.error(err)
    }
  }

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
    loadTeachers()
  }, [])

  useEffect(() => {
    loadSchedule(selectedDate)
  }, [selectedDate, loadSchedule])

  const mouseSensor = useSensor(MouseSensor, {
    activationConstraint: {
      distance: 5,
    },
  })
  const touchSensor = useSensor(TouchSensor, {
    activationConstraint: {
      delay: 250,
      tolerance: 8,
    },
  })
  const sensors = useSensors(mouseSensor, touchSensor)

  const handleDragStart = (e: DragStartEvent) => {
    if (navigator.vibrate) {
      navigator.vibrate(50)
    }
    const activeId = String(e.active.id)
    if (activeId.startsWith('student-')) {
      const student = students.find(s => `student-${s.id}` === activeId)
      if (student) setDragging(student)
    } else if (activeId.startsWith('lesson-') && schedule) {
      const lessonId = Number(activeId.replace('lesson-', ''))
      for (const r of schedule.rooms) {
        const l = r.lessons.find(l => l.id === lessonId)
        if (l?.student) { setDragging(l.student); break }
      }
    }
  }

  const executeSaveLesson = async (params: {
    studentId: number
    roomId: number
    time: string
    existingLessonId?: number
    teacherId: number | null
  }) => {
    const { studentId, roomId, time, existingLessonId, teacherId } = params
    setSaving(true)
    const newEnd = minsToTime(timeToMins(time) + 45)
    try {
      // Find the room and the existing lesson in that room
      const room = schedule?.rooms.find(r => r.id === roomId)
      const existingLesson = room?.lessons.find(l => l.startTime === time)

      // Clean up ghost lesson (no student assigned) before dropping the new one
      if (existingLesson && !existingLesson.studentId && !existingLesson.isBreak) {
        await deleteLesson(existingLesson.id)
      }

      if (existingLessonId) {
        await updateLesson(existingLessonId, { roomId, studentId, teacherId, startTime: time, endTime: newEnd, isBreak: false })
      } else {
        await createLesson({ roomId, studentId, teacherId, startTime: time, endTime: newEnd, isBreak: false })
      }
      await loadSchedule(selectedDate)
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
      setTeacherSelectModal(null)
    }
  }

  const handleEditLessonTeacher = (lesson: Lesson) => {
    if (!lesson.studentId) return
    const student = students.find(s => s.id === lesson.studentId)
    if (!student?.instrument) {
      alert("This student has no instrument assigned, assign one first.")
      return
    }
    const matchingTeachers = teachers.filter(t => t.instrument === student.instrument)
    if (matchingTeachers.length > 0) {
      setTeacherSelectModal({
        studentId: lesson.studentId,
        roomId: lesson.roomId,
        time: lesson.startTime,
        existingLessonId: lesson.id,
        sameInstrumentTeachers: matchingTeachers
      })
    } else {
      alert(`No teachers registered for ${student.instrument}`)
    }
  }

  const handleDragEnd = async (e: DragEndEvent) => {
    setDragging(null)
    const { active, over } = e
    if (!over || !schedule) return

    const activeId = String(active.id)
    let studentId: number
    if (activeId.startsWith('student-')) {
      studentId = Number(activeId.replace('student-', ''))
    } else if (activeId.startsWith('lesson-')) {
      const lessonId = Number(activeId.replace('lesson-', ''))
      let found: Lesson | undefined
      for (const r of schedule.rooms) {
        found = r.lessons.find(l => l.id === lessonId)
        if (found) break
      }
      if (!found?.studentId) return
      studentId = found.studentId
    } else return

    const [roomIdx, time] = String(over.id).split('::')
    const room = schedule.rooms[Number(roomIdx)]
    if (!room) return

    const existingLesson = room.lessons.find(l => l.startTime === time)
    // Only block if slot has a different student or is a break
    if (existingLesson && (existingLesson.isBreak || (existingLesson.studentId && existingLesson.studentId !== studentId))) return

    let fromLesson: Lesson | null = null
    for (const r of schedule.rooms) {
      const l = r.lessons.find(l => l.studentId === studentId && !l.isBreak)
      if (l) { fromLesson = l; break }
    }

    const student = students.find(s => s.id === studentId)
    const matchingTeachers = teachers.filter(t => t.instrument && student?.instrument && t.instrument === student.instrument)

    // Preserve teacher if already assigned on fromLesson when moving
    if (fromLesson && fromLesson.teacherId) {
      await executeSaveLesson({
        studentId,
        roomId: room.id,
        time,
        existingLessonId: fromLesson.id,
        teacherId: fromLesson.teacherId
      })
    } else if (matchingTeachers.length > 1) {
      setTeacherSelectModal({
        studentId,
        roomId: room.id,
        time,
        existingLessonId: fromLesson?.id,
        sameInstrumentTeachers: matchingTeachers
      })
    } else {
      const assignedTeacherId = matchingTeachers.length === 1 ? matchingTeachers[0].id : null
      await executeSaveLesson({
        studentId,
        roomId: room.id,
        time,
        existingLessonId: fromLesson?.id,
        teacherId: assignedTeacherId
      })
    }
  }

  const handleRemoveLesson = async (lessonId: number) => {
    setSaving(true)
    try { await deleteLesson(lessonId); await loadSchedule(selectedDate) } finally { setSaving(false) }
  }

  const handleToggleAttendance = async (lessonId: number) => {
    setSaving(true)
    try { await toggleAttendance(lessonId); await loadSchedule(selectedDate) } finally { setSaving(false) }
  }

  const handleEditDurationSubmit = async () => {
    if (!schedule || !durationModal) return
    const { lesson, duration: newDuration } = durationModal
    setSaving(true)
    try {
      let targetRoom: Room | undefined
      for (const r of schedule.rooms) {
        if (r.lessons.find(l => l.id === lesson.id)) {
          targetRoom = r
          break
        }
      }
      if (!targetRoom) return

      const oldStart = timeToMins(lesson.startTime)
      const oldEnd = timeToMins(lesson.endTime)
      const oldDuration = oldEnd - oldStart
      const diff = newDuration - oldDuration

      if (diff === 0) {
        setDurationModal(null)
        return
      }

      const roomLessons = [...targetRoom.lessons].sort((a, b) => timeToMins(a.startTime) - timeToMins(b.startTime))
      const targetIndex = roomLessons.findIndex(l => l.id === lesson.id)
      
      const promises = []
      const newEndTime = minsToTime(oldEnd + diff)
      promises.push(updateLesson(lesson.id, { ...lesson, endTime: newEndTime }))

      for (let i = targetIndex + 1; i < roomLessons.length; i++) {
        const l = roomLessons[i]
        const lStart = timeToMins(l.startTime)
        const lEnd = timeToMins(l.endTime)
        promises.push(updateLesson(l.id, { 
          ...l,
          startTime: minsToTime(lStart + diff),
          endTime: minsToTime(lEnd + diff)
        }))
      }

      await Promise.all(promises)
    } catch (e) {
      console.error(e)
    } finally {
      await loadSchedule(selectedDate)
      setSaving(false)
      setDurationModal(null)
    }
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

  const handleRenameRoom = async (roomId: number, newName: string) => {
    setSaving(true)
    try {
      await updateRoom(roomId, { name: newName })
      await loadSchedule(selectedDate)
    } finally { setSaving(false) }
  }

  const openAddStudent = () => { setEditingStudent(null); setStudentForm({ name: '', parentName: '', phone: '', phone2: '', age: '', instrument: '', totalLessons: PACKAGES.STANDARD.lessons, completedLessons: 0, hasPaid: false, paidPacks: '', notes: '' }); setStudentModal(true) }
  const openEditStudent = (s: Student) => { setEditingStudent(s); setStudentForm({ name: s.name, parentName: s.parentName || '', phone: s.phone || '', phone2: s.phone2 || '', age: s.age || '', instrument: s.instrument || '', totalLessons: s.totalLessons, completedLessons: s.completedLessons, hasPaid: s.hasPaid, paidPacks: s.paidPacks || '', notes: s.notes || '' }); setStudentModal(true) }
  const saveStudent = async () => {
    const payload = { ...studentForm, age: studentForm.age === '' ? null : Number(studentForm.age), instrument: studentForm.instrument || null, totalLessons: Number(studentForm.totalLessons), completedLessons: Number(studentForm.completedLessons), hasPaid: studentForm.hasPaid, paidPacks: studentForm.paidPacks }
    if (editingStudent) { await updateStudent(editingStudent.id, payload) } else { await createStudent(payload) }
    setStudentModal(false); loadStudents()
  }

  const getFormPacks = () => {
    const numPacks = Math.ceil(Number(studentForm.totalLessons) / 4)
    const parts = studentForm.paidPacks ? studentForm.paidPacks.split(',') : []
    const list: boolean[] = []
    for (let i = 0; i < numPacks; i++) {
      list.push(i < parts.length ? parts[i] === '1' : studentForm.hasPaid)
    }
    return list
  }

  const toggleFormPack = (idx: number) => {
    const packsList = getFormPacks()
    packsList[idx] = !packsList[idx]
    const newPaidPacks = packsList.map(v => v ? '1' : '0').join(',')
    const newHasPaid = !packsList.includes(false)
    setStudentForm(f => ({ ...f, paidPacks: newPaidPacks, hasPaid: newHasPaid }))
  }

  const handleTotalLessonsChange = (val: number) => {
    const numPacks = Math.ceil(val / 4)
    const parts = studentForm.paidPacks ? studentForm.paidPacks.split(',') : []
    const newParts: string[] = []
    for (let i = 0; i < numPacks; i++) {
      newParts.push(i < parts.length ? parts[i] : (studentForm.hasPaid ? '1' : '0'))
    }
    const newPaidPacks = newParts.join(',')
    const newHasPaid = !newParts.includes('0')
    setStudentForm(f => ({ ...f, totalLessons: val, paidPacks: newPaidPacks, hasPaid: newHasPaid }))
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
                  onRenameRoom={handleRenameRoom}
                  onEditDuration={(lesson) => setDurationModal({ lesson, duration: timeToMins(lesson.endTime) - timeToMins(lesson.startTime) })}
                  onEditTeacher={handleEditLessonTeacher}
                  teachers={teachers}
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

      {studentModal && (
        <div className="modal-overlay" onClick={() => setStudentModal(false)}>
          <div className="modal" style={{ maxWidth: 500 }} onClick={e => e.stopPropagation()}>
            <div className="modal-title">{editingStudent ? 'Edit Student' : 'Add Student'}</div>
            <div className="form-row">
              <div className="form-group">
                <label>Name *</label>
                <input className="input" value={studentForm.name} onChange={e => setStudentForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>Age</label>
                <input type="number" className="input" value={studentForm.age} onChange={e => setStudentForm(f => ({ ...f, age: e.target.value }))} placeholder="Years" />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Instrument</label>
                <select className="select" value={studentForm.instrument} onChange={e => setStudentForm(f => ({ ...f, instrument: e.target.value }))}>
                  <option value="">Select...</option>
                  {INSTRUMENTS.map(i => <option key={i} value={i}>{i}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Parent Name</label>
                <input className="input" value={studentForm.parentName} onChange={e => setStudentForm(f => ({ ...f, parentName: e.target.value }))} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Phone 1</label>
                <input className="input" value={studentForm.phone} onChange={e => setStudentForm(f => ({ ...f, phone: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>Phone 2</label>
                <input className="input" value={studentForm.phone2} onChange={e => setStudentForm(f => ({ ...f, phone2: e.target.value }))} />
              </div>
            </div>
             <div className="form-row">
               <div className="form-group">
                 <label>Total Lessons</label>
                 <input className="input" type="number" min="0" value={studentForm.totalLessons} onChange={e => handleTotalLessonsChange(Number(e.target.value))} />
               </div>
               <div className="form-group">
                 <label>Completed</label>
                 <input className="input" type="number" min="0" value={studentForm.completedLessons} onChange={e => setStudentForm(f => ({ ...f, completedLessons: Number(e.target.value) }))} />
               </div>
             </div>
             <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '10px 0' }}>
               <input type="checkbox" id="scheduleHasPaid" checked={studentForm.hasPaid} onChange={e => {
                 const checkVal = e.target.checked
                 const numPacks = Math.ceil(Number(studentForm.totalLessons) / 4)
                 const newPaidPacks = Array(numPacks).fill(checkVal ? '1' : '0').join(',')
                 setStudentForm(f => ({ ...f, hasPaid: checkVal, paidPacks: newPaidPacks }))
               }} style={{ width: 18, height: 18, cursor: 'pointer' }} />
               <label htmlFor="scheduleHasPaid" style={{ margin: 0, cursor: 'pointer' }}>Fully Paid</label>
             </div>
             {Math.ceil(Number(studentForm.totalLessons) / 4) > 0 && (
               <div className="form-group" style={{ marginBottom: 14 }}>
                 <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Packs Payment Status</label>
                 <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                   {getFormPacks().map((isPaid, idx) => (
                     <label key={idx} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer', background: 'var(--bg-600)', padding: '6px 12px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 12, fontWeight: 'normal' }}>
                       <input
                         type="checkbox"
                         checked={isPaid}
                         onChange={() => toggleFormPack(idx)}
                         style={{ width: 16, height: 16, cursor: 'pointer' }}
                       />
                       <span>Pack #{idx + 1}</span>
                     </label>
                   ))}
                 </div>
               </div>
             )}
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

      {durationModal && (
        <div className="modal-overlay" onClick={() => setDurationModal(null)}>
          <div className="modal" style={{ maxWidth: 300 }} onClick={e => e.stopPropagation()}>
            <div className="modal-title">Edit Duration</div>
            <div className="form-group">
              <label>Duration (minutes)</label>
              <input 
                type="number" 
                className="input" 
                value={durationModal.duration} 
                onChange={e => setDurationModal(m => m ? { ...m, duration: Number(e.target.value) } : null)}
                min="5"
                step="5"
              />
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setDurationModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleEditDurationSubmit} disabled={saving}>
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {teacherSelectModal && (
        <div className="modal-overlay" onClick={() => setTeacherSelectModal(null)}>
          <div className="modal" style={{ maxWidth: 360 }} onClick={e => e.stopPropagation()}>
            <div className="modal-title">Select Teacher</div>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 16 }}>
              Choose a teacher for this lesson:
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {teacherSelectModal.sameInstrumentTeachers.map(teacher => (
                <button
                  key={teacher.id}
                  className="btn btn-secondary"
                  style={{ justifyContent: 'flex-start', padding: '12px 16px', fontSize: 14 }}
                  onClick={() => executeSaveLesson({
                    studentId: teacherSelectModal.studentId,
                    roomId: teacherSelectModal.roomId,
                    time: teacherSelectModal.time,
                    existingLessonId: teacherSelectModal.existingLessonId,
                    teacherId: teacher.id
                  })}
                >
                  🧑‍🏫 {teacher.name}
                </button>
              ))}
              <button
                className="btn btn-danger btn-ghost"
                style={{ justifyContent: 'flex-start', padding: '12px 16px', fontSize: 14, border: '1px dashed var(--red)' }}
                onClick={() => executeSaveLesson({
                  studentId: teacherSelectModal.studentId,
                  roomId: teacherSelectModal.roomId,
                  time: teacherSelectModal.time,
                  existingLessonId: teacherSelectModal.existingLessonId,
                  teacherId: null
                })}
              >
                🚫 Leave Unassigned
              </button>
            </div>
            <div className="modal-actions" style={{ marginTop: 20 }}>
              <button className="btn btn-secondary" onClick={() => setTeacherSelectModal(null)}>Cancel</button>
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

function generateRoomTimeline(_dayName: string, lessons: Lesson[]) {
  const startMins = timeToMins('10:00')
  const endMins = timeToMins('23:00')
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

function RoomTable({ room, roomIndex, dayName, onRemove, onToggleAttendance, onAddBreak, onRenameRoom, onEditDuration, onEditTeacher, teachers }: {
  room: Room; roomIndex: number; dayName: string;
  onRemove: (id: number) => void
  onToggleAttendance: (id: number) => void
  onAddBreak: (time: string) => void
  onRenameRoom: (id: number, name: string) => void
  onEditDuration: (lesson: Lesson) => void
  onEditTeacher: (lesson: Lesson) => void
  teachers: Teacher[]
}) {
  const [isRenaming, setIsRenaming] = useState(false)
  const [tempName, setTempName] = useState(room.name)

  return (
    <div className="room-card">
      <div className="room-header">
        {isRenaming ? (
          <input 
            className="input" 
            autoFocus 
            style={{ fontSize: 14, padding: '2px 8px', height: 28 }}
            value={tempName} 
            onChange={e => setTempName(e.target.value)}
            onBlur={() => { setIsRenaming(false); onRenameRoom(room.id, tempName); }}
            onKeyDown={e => e.key === 'Enter' && e.currentTarget.blur()}
          />
        ) : (
          <span className="room-name" onDoubleClick={() => setIsRenaming(true)} style={{ cursor: 'pointer' }} title="Double-click to rename">{room.name} ✏️</span>
        )}
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
            onEditDuration={onEditDuration}
            onEditTeacher={onEditTeacher}
            teachers={teachers}
          />
        ))}
      </div>
    </div>
  )
}

function TimeSlot({ roomIndex, time, duration, lesson, onRemove, onToggleAttendance, onAddBreak, onEditDuration, onEditTeacher, teachers }: {
  roomIndex: number; time: string; duration: number; lesson?: Lesson
  onRemove: (id: number) => void
  onToggleAttendance: (id: number) => void
  onAddBreak: (time: string) => void
  onEditDuration: (lesson: Lesson) => void
  onEditTeacher: (lesson: Lesson) => void
  teachers: Teacher[]
}) {
  const { isOver, setNodeRef } = useDroppable({ id: `${roomIndex}::${time}` })
  const endTimeStr = minsToTime(timeToMins(time) + duration)

  if (lesson?.isBreak) {
    return (
      <div ref={setNodeRef} className="time-slot break-slot">
        <span className="slot-time">{time} - {endTimeStr}</span>
        <span className="break-label">☕ {lesson.breakLabel || 'Break'} <span style={{opacity: 0.6, fontSize: 10}}>({duration}m)</span></span>
        <button className="slot-remove" onClick={() => onRemove(lesson.id)}>✕</button>
      </div>
    )
  }

  if (lesson?.student) {
    return (
      <DraggableOccupiedSlot
        setDropRef={setNodeRef}
        lesson={lesson}
        time={time}
        endTimeStr={endTimeStr}
        onRemove={onRemove}
        onToggleAttendance={onToggleAttendance}
        onEditDuration={onEditDuration}
        onEditTeacher={onEditTeacher}
        teachers={teachers}
      />
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

function DraggableOccupiedSlot({ setDropRef, lesson, time, endTimeStr, onRemove, onToggleAttendance, onEditDuration, onEditTeacher, teachers }: {
  setDropRef: (el: HTMLElement | null) => void
  lesson: Lesson
  time: string
  endTimeStr: string
  onRemove: (id: number) => void
  onToggleAttendance: (id: number) => void
  onEditDuration: (lesson: Lesson) => void
  onEditTeacher: (lesson: Lesson) => void
  teachers: Teacher[]
}) {
  const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({ id: `lesson-${lesson.id}` })
  const rem = (lesson.student?.totalLessons || 0) - (lesson.student?.completedLessons || 0)

  return (
    <div
      ref={(node) => { setDropRef(node); setDragRef(node); }}
      className={`time-slot occupied ${!lesson.made ? 'not-made' : ''} ${isDragging ? 'dragging' : ''}`}
      style={{ cursor: 'grab', ...(isDragging ? { opacity: 0.4 } : {}) }}
      {...listeners}
      {...attributes}
    >
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }}>
        <span className="slot-time">{time} - {endTimeStr}</span>
        {lesson.student?.instrument && <span className="tag tag-instrument" style={{ fontSize: 8, padding: '1px 4px' }}>{lesson.student.instrument}</span>}
      </div>
      
      <div className="slot-student" style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
        <span className="slot-name">{lesson.student?.name}</span>
        {rem <= 2 && (lesson.student?.totalLessons || 0) > 0 && (
          <span style={{ fontSize: 9, color: 'var(--red)' }}>⚠️</span>
        )}
        {lesson.student?.notes && (
          <span title={lesson.student.notes} style={{ fontSize: 9, cursor: 'help' }}>📝</span>
        )}

        {(() => {
          if (!lesson.student?.instrument) return null
          const matchingTeachers = teachers.filter(t => t.instrument === lesson.student?.instrument)
          if (matchingTeachers.length <= 1) return null

          return (
            <span 
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                onEditTeacher(lesson)
              }} 
              style={{ 
                fontSize: 9, 
                color: 'var(--text-secondary)', 
                cursor: 'pointer', 
                display: 'inline-flex', 
                alignItems: 'center', 
                gap: '2px', 
                background: 'var(--bg-600)', 
                padding: '1px 4px', 
                borderRadius: '4px', 
                border: '1px solid var(--border)',
                userSelect: 'none',
                whiteSpace: 'nowrap',
                flexShrink: 0
              }}
              title="Click to assign or change teacher"
            >
              🧑‍🏫 {lesson.teacher?.name || 'Assign'} ✏️
            </span>
          )
        })()}
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
        <button className="slot-remove" onClick={() => onEditDuration(lesson)} title="Edit Duration">⏱️</button>
        <button className="slot-remove" onClick={() => onRemove(lesson.id)}>✕</button>
      </div>
    </div>
  )
}
