import { Router } from 'express'
import { PrismaClient } from '@prisma/client'

const router = Router()
const prisma = new PrismaClient()

// GET worker (singular)
router.get('/', async (_req, res) => {
  try {
    let worker = await prisma.worker.findFirst()
    if (!worker) {
      worker = await prisma.worker.create({ data: { name: 'Worker' } })
    }
    res.json(worker)
  } catch {
    res.status(500).json({ error: 'Failed to fetch worker' })
  }
})

// PUT update worker
router.put('/', async (req, res) => {
  try {
    const { name, costPerHour, totalHours } = req.body
    let worker = await prisma.worker.findFirst()
    
    if (worker) {
      worker = await prisma.worker.update({
        where: { id: worker.id },
        data: {
          name: name !== undefined ? name : undefined,
          costPerHour: costPerHour !== undefined ? Number(costPerHour) : undefined,
          totalHours: totalHours !== undefined ? Number(totalHours) : undefined
        }
      })
    } else {
      worker = await prisma.worker.create({
        data: {
          name: name || 'Worker',
          costPerHour: costPerHour !== undefined ? Number(costPerHour) : 0,
          totalHours: totalHours !== undefined ? Number(totalHours) : 0
        }
      })
    }
    res.json(worker)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to update worker' })
  }
})

export default router
