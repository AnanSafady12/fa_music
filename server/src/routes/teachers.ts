import { Router } from 'express'
import { PrismaClient } from '@prisma/client'

const router = Router()
const prisma = new PrismaClient()

router.get('/', async (_req, res) => {
  try {
    const teachers = await prisma.teacher.findMany({ orderBy: { name: 'asc' } })
    res.json(teachers)
  } catch {
    res.status(500).json({ error: 'Failed to fetch teachers' })
  }
})

router.post('/', async (req, res) => {
  try {
    const { name, phone, costPerLesson, instrument } = req.body
    const teacher = await prisma.teacher.create({ data: { name, phone, costPerLesson: costPerLesson ?? 0, instrument } })
    res.json(teacher)
  } catch {
    res.status(500).json({ error: 'Failed to create teacher' })
  }
})

router.put('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id)
    const { name, phone, costPerLesson, instrument } = req.body
    const teacher = await prisma.teacher.update({ where: { id }, data: { name, phone, costPerLesson, instrument } })
    res.json(teacher)
  } catch {
    res.status(500).json({ error: 'Failed to update teacher' })
  }
})

router.delete('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id)
    await prisma.teacher.delete({ where: { id } })
    res.json({ success: true })
  } catch {
    res.status(500).json({ error: 'Failed to delete teacher' })
  }
})

export default router
