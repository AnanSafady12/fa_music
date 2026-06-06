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
    const { name, parentName, phone, phone2, age, instrument, totalLessons, completedLessons, hasPaid, amountPaid, paidPacks, notes } = req.body
    
    const numPacks = Math.ceil((totalLessons ?? 0) / 4)
    let calculatedPaidPacks = paidPacks
    if (calculatedPaidPacks === undefined || calculatedPaidPacks === null) {
      calculatedPaidPacks = Array(numPacks).fill(hasPaid ? '1' : '0').join(',')
    } else {
      const parts = calculatedPaidPacks ? String(calculatedPaidPacks).split(',') : []
      while (parts.length < numPacks) {
        parts.push('0')
      }
      calculatedPaidPacks = parts.slice(0, numPacks).join(',')
    }
    const finalHasPaid = numPacks > 0 ? !calculatedPaidPacks.includes('0') : true

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
        hasPaid: finalHasPaid, 
        amountPaid: amountPaid ?? 0,
        paidPacks: calculatedPaidPacks,
        notes 
      }
    })
    res.json(student)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Failed to create student' })
  }
})

// PUT update student
router.put('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id)
    const { name, parentName, phone, phone2, age, instrument, totalLessons, completedLessons, hasPaid, amountPaid, paidPacks, notes } = req.body

    const numPacks = Math.ceil((totalLessons ?? 0) / 4)
    let calculatedPaidPacks = paidPacks
    if (calculatedPaidPacks === undefined || calculatedPaidPacks === null) {
      calculatedPaidPacks = Array(numPacks).fill(hasPaid ? '1' : '0').join(',')
    } else {
      const parts = calculatedPaidPacks ? String(calculatedPaidPacks).split(',') : []
      while (parts.length < numPacks) {
        parts.push('0')
      }
      calculatedPaidPacks = parts.slice(0, numPacks).join(',')
    }
    const finalHasPaid = numPacks > 0 ? !calculatedPaidPacks.includes('0') : true

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
        hasPaid: finalHasPaid, 
        amountPaid: amountPaid ?? 0,
        paidPacks: calculatedPaidPacks,
        notes 
      }
    })
    res.json(student)
  } catch (e) {
    console.error(e)
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
