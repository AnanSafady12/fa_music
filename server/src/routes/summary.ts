import { Router } from 'express'
import { PrismaClient } from '@prisma/client'

const router = Router()
const prisma = new PrismaClient()

// GET summary
router.get('/', async (req, res) => {
  try {
    const month = req.query.month ? Number(req.query.month) : null // 1-12
    const year = req.query.year ? Number(req.query.year) : null

    // 1. Calculate active students (those with lessons remaining)
    const students = await prisma.student.findMany()
    const totalStudents = students.length
    const activeStudents = students.filter(s => s.totalLessons > s.completedLessons).length

    // 2. Fetch Teachers and their Monthly Stats
    const teachers = await prisma.teacher.findMany({
      include: {
        monthlyStats: {
          where: { month: month || -1, year: year || -1 }
        }
      }
    })
    
    // 2b. Fetch Worker
    let worker = await prisma.worker.findFirst()
    if (!worker) {
      worker = await prisma.worker.create({ data: { name: 'Worker' } })
    }

    // 3. Define the time range for lessons
    const baseWhere: any = {
      made: true,
      isBreak: false,
      studentId: { not: null }
    }

    if (month !== null && year !== null) {
      const startDate = new Date(Date.UTC(year, month - 1, 1))
      const endDate = new Date(Date.UTC(year, month, 1))
      baseWhere.room = {
        schedule: {
          date: {
            gte: startDate,
            lt: endDate
          }
        }
      }
    }

    // 4. Fetch all "Made" lessons within the range
    const lessons = await prisma.lesson.findMany({
      where: baseWhere,
      include: {
        student: true,
        room: { include: { schedule: true } }
      }
    })

    const now = new Date()
    const todayIso = now.toISOString().split('T')[0]
    const nowMins = now.getHours() * 60 + now.getMinutes()

    // Filter for lessons that have actually finished
    const processedLessons = lessons.filter(lesson => {
      const scheduleDateIso = new Date(lesson.room.schedule.date).toISOString().split('T')[0]
      const [h, m] = lesson.endTime.split(':').map(Number)
      const lessonEndMins = h * 60 + m

      if (scheduleDateIso < todayIso) return true
      if (scheduleDateIso === todayIso && lessonEndMins <= nowMins) return true
      return false
    })

    // 5. Count lessons by instrument
    const instrumentLessonCounts: Record<string, number> = {}
    for (const lesson of processedLessons) {
      const instr = lesson.student?.instrument
      if (instr) {
        instrumentLessonCounts[instr] = (instrumentLessonCounts[instr] || 0) + 1
      }
    }

    // 6. Calculate teacher salaries
    const teacherSalaries = teachers.map(teacher => {
      const stats = teacher.monthlyStats[0] || null
      const lessonsTaught = teacher.instrument ? (instrumentLessonCounts[teacher.instrument] || 0) : 0
      const calculatedSalary = lessonsTaught * teacher.costPerLesson
      const earnedSalary = stats?.manualSalary !== null && stats?.manualSalary !== undefined ? stats.manualSalary : calculatedSalary

      return {
        id: teacher.id,
        name: teacher.name,
        instrument: teacher.instrument || 'None',
        lessonsTaught,
        costPerLesson: teacher.costPerLesson,
        calculatedSalary,
        earnedSalary,
        notes: stats?.notes || ''
      }
    })

    const totalTeacherLiabilities = teacherSalaries.reduce((sum, t) => sum + t.earnedSalary, 0)
    const workerLiability = worker.costPerHour * worker.totalHours
    const grandTotalLiabilities = totalTeacherLiabilities + workerLiability

    res.json({
      students: {
        totalStudents,
        activeStudents
      },
      teacherSalaries,
      totalTeacherLiabilities,
      worker,
      workerLiability,
      grandTotalLiabilities
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to fetch summary data' })
  }
})

// PUT update teacher stats for a specific month
router.put('/teacher-stats', async (req, res) => {
  try {
    const { teacherId, month, year, notes, manualSalary } = req.body
    const stats = await prisma.monthlyTeacherStats.upsert({
      where: {
        teacherId_month_year: {
          teacherId: Number(teacherId),
          month: Number(month),
          year: Number(year)
        }
      },
      update: {
        notes,
        manualSalary: manualSalary !== undefined ? (manualSalary === null ? null : Number(manualSalary)) : undefined
      },
      create: {
        teacherId: Number(teacherId),
        month: Number(month),
        year: Number(year),
        notes,
        manualSalary: manualSalary !== undefined ? (manualSalary === null ? null : Number(manualSalary)) : undefined
      }
    })
    res.json(stats)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to update teacher stats' })
  }
})

export default router
