import { Router } from 'express'
import { PrismaClient } from '@prisma/client'

const router = Router()
const prisma = new PrismaClient()

// GET all schedules
router.get('/', async (_req, res) => {
  try {
    const schedules = await prisma.schedule.findMany({
      orderBy: { date: 'asc' },
      include: { rooms: { orderBy: { id: 'asc' }, include: { lessons: { include: { student: true, teacher: true } } } } }
    })
    res.json(schedules)
  } catch {
    res.status(500).json({ error: 'Failed to fetch schedules' })
  }
})

// GET single schedule by id
router.get('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id)
    const schedule = await prisma.schedule.findUnique({
      where: { id },
      include: { rooms: { orderBy: { id: 'asc' }, include: { lessons: { include: { student: true, teacher: true }, orderBy: { startTime: 'asc' } } } } }
    })
    if (!schedule) return res.status(404).json({ error: 'Schedule not found' })
    res.json(schedule)
  } catch {
    res.status(500).json({ error: 'Failed to fetch schedule' })
  }
})

// GET schedule by date
router.get('/by-date/:date', async (req, res) => {
  try {
    const date = new Date(req.params.date)
    const schedule = await prisma.schedule.findUnique({
      where: { date },
      include: { rooms: { orderBy: { id: 'asc' }, include: { lessons: { include: { student: true, teacher: true }, orderBy: { startTime: 'asc' } } } } }
    })
    if (!schedule) return res.status(404).json({ error: 'No schedule for this date' })
    res.json(schedule)
  } catch {
    res.status(500).json({ error: 'Failed to fetch schedule' })
  }
})

// POST create schedule for a day (auto-creates 3 rooms)
router.post('/', async (req, res) => {
  try {
    const { dayName, date } = req.body
    const parsedDate = new Date(date)
    const schedule = await prisma.schedule.create({
      data: {
        dayName,
        date: parsedDate,
        rooms: {
          create: [{ name: 'Room 1' }, { name: 'Room 2' }, { name: 'Room 3' }]
        }
      },
      include: { rooms: { include: { lessons: true } } }
    })
    res.json(schedule)
  } catch {
    res.status(500).json({ error: 'Failed to create schedule' })
  }
})

// POST copy previous week's schedule to a new date
router.post('/:id/copy-last-week', async (req, res) => {
  try {
    const sourceId = Number(req.params.id)
    const { targetDate, targetDayName } = req.body

    const source = await prisma.schedule.findUnique({
      where: { id: sourceId },
      include: { rooms: { orderBy: { id: 'asc' }, include: { lessons: true } } }
    })
    if (!source) return res.status(404).json({ error: 'Source schedule not found' })

    const parsedDate = new Date(targetDate)

    // Check if target already exists
    let target = await prisma.schedule.findUnique({ 
      where: { date: parsedDate },
      include: { rooms: true }
    })

    if (!target) {
      target = await prisma.schedule.create({
        data: {
          dayName: targetDayName || source.dayName,
          date: parsedDate
        },
        include: { rooms: true }
      })
    } else {
      // Clean up existing rooms and lessons in target first
      const targetRoomIds = target.rooms.map(r => r.id)
      const existingLessons = await prisma.lesson.findMany({
        where: { roomId: { in: targetRoomIds } }
      })

      await prisma.$transaction(async (tx) => {
        for (const lesson of existingLessons) {
          if (lesson.isProcessed && lesson.made && lesson.studentId) {
            await tx.student.update({
              where: { id: lesson.studentId },
              data: { completedLessons: { decrement: 1.0 } }
            })
          }
        }
        await tx.room.deleteMany({
          where: { id: { in: targetRoomIds } }
        })
      })
    }

    // Fetch all historical student-teacher assignments to determine regular teachers
    const historicalAssignments = await prisma.lesson.findMany({
      where: {
        teacherId: { not: null },
        studentId: { not: null }
      },
      select: {
        studentId: true,
        teacherId: true
      }
    })

    const studentTeacherMap: Record<number, number> = {}
    const studentTeacherCounts: Record<number, Record<number, number>> = {}
    for (const assignment of historicalAssignments) {
      const sid = assignment.studentId!
      const tid = assignment.teacherId!
      if (!studentTeacherCounts[sid]) {
        studentTeacherCounts[sid] = {}
      }
      studentTeacherCounts[sid][tid] = (studentTeacherCounts[sid][tid] || 0) + 1
    }
    for (const [sidStr, counts] of Object.entries(studentTeacherCounts)) {
      const sid = Number(sidStr)
      let bestTid = null
      let maxCount = 0
      for (const [tidStr, count] of Object.entries(counts)) {
        const tid = Number(tidStr)
        if (count > maxCount) {
          maxCount = count
          bestTid = tid
        }
      }
      if (bestTid !== null) {
        studentTeacherMap[sid] = bestTid
      }
    }

    const teachers = await prisma.teacher.findMany()
    const students = await prisma.student.findMany()

    // Copy rooms and lessons from source to target
    for (const srcRoom of source.rooms) {
      const tgtRoom = await prisma.room.create({
        data: {
          name: srcRoom.name,
          teacherId: srcRoom.teacherId,
          scheduleId: target.id
        }
      })

      for (const lesson of srcRoom.lessons) {
        let resolvedTeacherId = lesson.teacherId
        if (resolvedTeacherId === null && lesson.studentId !== null) {
          resolvedTeacherId = studentTeacherMap[lesson.studentId!] || null
          if (resolvedTeacherId === null) {
            const student = students.find(s => s.id === lesson.studentId)
            if (student && student.instrument) {
              const sameInstrumentTeachers = teachers.filter(t => t.instrument === student.instrument)
              if (sameInstrumentTeachers.length === 1) {
                resolvedTeacherId = sameInstrumentTeachers[0].id
              }
            }
          }
        }

        if (resolvedTeacherId === null && srcRoom.name) {
          const roomNameLower = srcRoom.name.toLowerCase()
          const matchedTeacher = teachers.find(t => {
            const nameParts = t.name.toLowerCase().split(/\s+/)
            return roomNameLower.includes(t.name.toLowerCase()) || 
                   nameParts.some(part => part.length > 2 && roomNameLower.includes(part))
          })
          if (matchedTeacher) {
            resolvedTeacherId = matchedTeacher.id
          }
        }

        await prisma.lesson.create({
          data: {
            roomId: tgtRoom.id,
            studentId: lesson.studentId,
            teacherId: resolvedTeacherId,
            startTime: lesson.startTime,
            endTime: lesson.endTime,
            made: true,
            isBreak: lesson.isBreak,
            breakLabel: lesson.breakLabel
          }
        })
      }
    }

    const result = await prisma.schedule.findUnique({
      where: { id: (target as any).id },
      include: { rooms: { orderBy: { id: 'asc' }, include: { lessons: { include: { student: true, teacher: true }, orderBy: { startTime: 'asc' } } } } }
    })
    res.json(result)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Failed to copy schedule' })
  }
})

// DELETE schedule
router.delete('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id)
    await prisma.schedule.delete({ where: { id } })
    res.json({ success: true })
  } catch {
    res.status(500).json({ error: 'Failed to delete schedule' })
  }
})

// UPDATE room (for teacher assignment)
router.put('/rooms/:id', async (req, res) => {
  try {
    const id = Number(req.params.id)
    const { teacherId, name } = req.body
    const room = await prisma.room.update({
      where: { id },
      data: { 
        teacherId: teacherId !== undefined ? (teacherId || null) : undefined,
        name: name !== undefined ? name : undefined
      }
    })
    res.json(room)
  } catch {
    res.status(500).json({ error: 'Failed to update room' })
  }
})

// DELETE all lessons in a room
router.delete('/rooms/:id/lessons', async (req, res) => {
  try {
    const roomId = Number(req.params.id)
    
    // Find all lessons in this room to adjust student counts
    const lessons = await prisma.lesson.findMany({
      where: { roomId }
    })

    await prisma.$transaction(async (tx) => {
      for (const lesson of lessons) {
        if (lesson.isProcessed && lesson.made && lesson.studentId) {
          await tx.student.update({
            where: { id: lesson.studentId },
            data: { completedLessons: { decrement: 1.0 } }
          })
        }
      }
      await tx.lesson.deleteMany({
        where: { roomId }
      })
    })

    res.json({ success: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to delete room lessons' })
  }
})

export default router
