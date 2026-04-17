import { Router } from 'express'
import { PrismaClient } from '@prisma/client'

const router = Router()
const prisma = new PrismaClient()

function timeToMins(t: string) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}
function minsToTime(mins: number) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
function addMins(t: string, mins: number) {
  return minsToTime(timeToMins(t) + mins);
}

// POST create a lesson in a room
router.post('/', async (req, res) => {
  try {
    const { roomId, studentId, startTime, endTime, isBreak, breakLabel } = req.body
    const lesson = await prisma.lesson.create({
      data: { roomId, studentId: studentId || null, startTime, endTime, isBreak: isBreak ?? false, breakLabel },
      include: { student: true }
    })
    res.json(lesson)
  } catch {
    res.status(500).json({ error: 'Failed to create lesson' })
  }
})

// POST insert break and shift subsequent lessons
router.post('/insert-break', async (req, res) => {
  try {
    const { roomId, startTime, durationMins, label } = req.body
    
    // Shift all lessons/breaks that start on or after this startTime
    const lessonsToShift = await prisma.lesson.findMany({ where: { roomId } })
    const shiftMins = Number(durationMins)
    const targetMins = timeToMins(startTime)

    for (const lesson of lessonsToShift) {
      if (timeToMins(lesson.startTime) >= targetMins) {
        await prisma.lesson.update({
          where: { id: lesson.id },
          data: {
            startTime: addMins(lesson.startTime, shiftMins),
            endTime: addMins(lesson.endTime, shiftMins)
          }
        })
      }
    }

    // Now insert the break itself
    const breakLesson = await prisma.lesson.create({
      data: {
        roomId,
        startTime,
        endTime: addMins(startTime, shiftMins),
        isBreak: true,
        breakLabel: label || 'Break'
      }
    })
    res.json(breakLesson)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Failed to insert break' })
  }
})

// PUT update lesson (move room / time)
router.put('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id)
    const { roomId, studentId, startTime, endTime, isBreak, breakLabel } = req.body
    const lesson = await prisma.lesson.update({
      where: { id },
      data: { roomId, studentId: studentId || null, startTime, endTime, isBreak, breakLabel },
      include: { student: true }
    })
    res.json(lesson)
  } catch {
    res.status(500).json({ error: 'Failed to update lesson' })
  }
})

// PATCH toggle attendance
router.patch('/:id/attendance', async (req, res) => {
  try {
    const id = Number(req.params.id)
    const lesson = await prisma.lesson.findUnique({ where: { id } })
    if (!lesson) return res.status(404).json({ error: 'Lesson not found' })
    const updated = await prisma.lesson.update({
      where: { id },
      data: { made: !lesson.made },
      include: { student: true }
    })
    res.json(updated)
  } catch {
    res.status(500).json({ error: 'Failed to toggle attendance' })
  }
})

// DELETE lesson
router.delete('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id)
    await prisma.lesson.delete({ where: { id } })
    res.json({ success: true })
  } catch {
    res.status(500).json({ error: 'Failed to delete lesson' })
  }
})

export default router
