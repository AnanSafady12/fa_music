import { Router } from 'express'
import { PrismaClient } from '@prisma/client'

const router = Router()
const prisma = new PrismaClient()

// GET all schedules
router.get('/', async (_req, res) => {
  try {
    const schedules = await prisma.schedule.findMany({
      orderBy: { date: 'asc' },
      include: { rooms: { include: { lessons: { include: { student: true } } } } }
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
      include: { rooms: { include: { lessons: { include: { student: true }, orderBy: { startTime: 'asc' } } } } }
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
      include: { rooms: { include: { lessons: { include: { student: true }, orderBy: { startTime: 'asc' } } } } }
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
      include: { rooms: { include: { lessons: true } } }
    })
    if (!source) return res.status(404).json({ error: 'Source schedule not found' })

    const parsedDate = new Date(targetDate)

    // Check if target already exists
    let target = await prisma.schedule.findUnique({ where: { date: parsedDate } })
    if (!target) {
      target = await prisma.schedule.create({
        data: {
          dayName: targetDayName || source.dayName,
          date: parsedDate,
          rooms: { create: [{ name: 'Room 1' }, { name: 'Room 2' }, { name: 'Room 3' }] }
        },
        include: { rooms: true }
      }) as any
    }

    const targetFull = await prisma.schedule.findUnique({
      where: { id: (target as any).id },
      include: { rooms: true }
    })

    // Copy lessons from each room to corresponding target room
    for (let i = 0; i < source.rooms.length && i < (targetFull!.rooms.length); i++) {
      const srcRoom = source.rooms[i]
      const tgtRoom = targetFull!.rooms[i]
      for (const lesson of srcRoom.lessons) {
        await prisma.lesson.create({
          data: {
            roomId: tgtRoom.id,
            studentId: lesson.studentId,
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
      include: { rooms: { include: { lessons: { include: { student: true }, orderBy: { startTime: 'asc' } } } } }
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
    const { teacherId } = req.body
    const room = await prisma.room.update({
      where: { id },
      data: { teacherId: teacherId || null }
    })
    res.json(room)
  } catch {
    res.status(500).json({ error: 'Failed to update room' })
  }
})

export default router
