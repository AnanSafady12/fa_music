import { Router } from 'express'
import { PrismaClient } from '@prisma/client'

const router = Router()
const prisma = new PrismaClient()

// GET all students
router.get('/', async (_req, res) => {
  try {
    const students = await prisma.student.findMany({ orderBy: { name: 'asc' } })
    res.json(students)
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch students' })
  }
})

// POST create student
router.post('/', async (req, res) => {
  try {
    const { name, parentName, phone, phone2, age, instrument, totalLessons, completedLessons, hasPaid, notes } = req.body
    const student = await prisma.student.create({
      data: { 
        name, 
        parentName, 
        phone, 
        phone2, 
        age: age ? Number(age) : null, 
        instrument, 
        totalLessons: totalLessons ?? 0, 
        completedLessons: completedLessons ?? 0, 
        hasPaid: hasPaid ?? false, 
        notes 
      }
    })
    res.json(student)
  } catch (e) {
    res.status(500).json({ error: 'Failed to create student' })
  }
})

// PUT update student
router.put('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id)
    const { name, parentName, phone, phone2, age, instrument, totalLessons, completedLessons, hasPaid, notes } = req.body
    const student = await prisma.student.update({
      where: { id },
      data: { 
        name, 
        parentName, 
        phone, 
        phone2, 
        age: age ? Number(age) : null, 
        instrument, 
        totalLessons, 
        completedLessons, 
        hasPaid, 
        notes 
      }
    })
    res.json(student)
  } catch (e) {
    res.status(500).json({ error: 'Failed to update student' })
  }
})


// DELETE student
router.delete('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id)
    await prisma.student.delete({ where: { id } })
    res.json({ success: true })
  } catch (e) {
    res.status(500).json({ error: 'Failed to delete student' })
  }
})

// GET student history
router.get('/:id/history', async (req, res) => {
  try {
    const id = Number(req.params.id)
    const lessons = await prisma.lesson.findMany({
      where: { studentId: id, made: true },
      include: {
        room: {
          include: { schedule: true }
        }
      },
      orderBy: { room: { schedule: { date: 'desc' } } }
    })
    res.json(lessons)
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch student history' })
  }
})

export default router
