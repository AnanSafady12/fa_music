import { Router } from 'express'
import { PrismaClient } from '@prisma/client'

const router = Router()
const prisma = new PrismaClient()

router.get('/', async (req, res) => {
  try {
    const todos = await prisma.todo.findMany({
      include: { student: true },
      orderBy: { createdAt: 'desc' }
    })
    res.json(todos)
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch todos' })
  }
})

router.post('/', async (req, res) => {
  try {
    const { text, studentId } = req.body
    const todo = await prisma.todo.create({
      data: { text, studentId: studentId || null }
    })
    // Fetch with student included for immediate display
    const createdTodo = await prisma.todo.findUnique({
      where: { id: todo.id },
      include: { student: true }
    })
    res.json(createdTodo)
  } catch (err) {
    res.status(500).json({ error: 'Failed to create todo' })
  }
})

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params
    const { text, isCompleted } = req.body
    const todo = await prisma.todo.update({
      where: { id: Number(id) },
      data: { text, isCompleted },
      include: { student: true }
    })
    res.json(todo)
  } catch (err) {
    res.status(500).json({ error: 'Failed to update todo' })
  }
})

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params
    await prisma.todo.delete({
      where: { id: Number(id) }
    })
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete todo' })
  }
})

export default router
