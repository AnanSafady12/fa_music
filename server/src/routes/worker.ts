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

// GET worker logs for a specific month and year
router.get('/logs', async (req, res) => {
  try {
    const month = req.query.month ? Number(req.query.month) : null
    const year = req.query.year ? Number(req.query.year) : null

    let worker = await prisma.worker.findFirst()
    if (!worker) {
      worker = await prisma.worker.create({ data: { name: 'Worker' } })
    }

    let whereClause: any = { workerId: worker.id }
    if (month !== null && year !== null) {
      const startDate = new Date(Date.UTC(year, month - 1, 1))
      const endDate = new Date(Date.UTC(year, month, 1))
      whereClause.date = {
        gte: startDate,
        lt: endDate
      }
    }

    const logs = await prisma.workerLog.findMany({
      where: whereClause,
      orderBy: { date: 'asc' }
    })
    res.json(logs)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to fetch worker logs' })
  }
})

// POST create worker log
router.post('/logs', async (req, res) => {
  try {
    const { date, hours, costPerHour, notes } = req.body

    let worker = await prisma.worker.findFirst()
    if (!worker) {
      worker = await prisma.worker.create({ data: { name: 'Worker' } })
    }

    const log = await prisma.workerLog.create({
      data: {
        workerId: worker.id,
        date: new Date(date),
        hours: Number(hours),
        costPerHour: costPerHour !== undefined ? Number(costPerHour) : worker.costPerHour,
        notes
      }
    })
    res.json(log)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to create worker log' })
  }
})

// DELETE worker log
router.delete('/logs/:id', async (req, res) => {
  try {
    const id = Number(req.params.id)
    await prisma.workerLog.delete({
      where: { id }
    })
    res.json({ success: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to delete worker log' })
  }
})

export default router
