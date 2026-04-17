import { Router } from 'express'
import { PrismaClient } from '@prisma/client'

const router = Router()
const prisma = new PrismaClient()

router.get('/', async (req, res) => {
  try {
    const month = req.query.month ? Number(req.query.month) : null // 1-12
    const year = req.query.year ? Number(req.query.year) : null

    // 1. Calculate active students (those with lessons remaining)
    const students = await prisma.student.findMany()
    const totalStudents = students.length
    const activeStudents = students.filter(s => s.totalLessons > s.completedLessons).length

    // 2. Calculate salaries for teachers based on their instrument
    const teachers = await prisma.teacher.findMany()
    
    // Fetch all qualified lessons (not strictly isProcessed, but rather time-passed)
    const baseWhere: any = {
      made: true,
      isBreak: false
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

    const processedLessons = lessons.filter(lesson => {
      const scheduleDateIso = new Date(lesson.room.schedule.date).toISOString().split('T')[0]
      const [h, m] = lesson.endTime.split(':').map(Number)
      const lessonEndMins = h * 60 + m

      if (scheduleDateIso < todayIso) return true
      if (scheduleDateIso === todayIso && lessonEndMins <= nowMins) return true
      return false
    })

    // Count lessons by instrument
    const instrumentLessonCounts: Record<string, number> = {}
    for (const lesson of processedLessons) {
      const instr = lesson.student?.instrument
      if (instr) {
        instrumentLessonCounts[instr] = (instrumentLessonCounts[instr] || 0) + 1
      }
    }

    const teacherSalaries = teachers.map(teacher => {
      const lessonsTaught = teacher.instrument ? (instrumentLessonCounts[teacher.instrument] || 0) : 0
      const earnedSalary = lessonsTaught * teacher.costPerLesson
      return {
        id: teacher.id,
        name: teacher.name,
        instrument: teacher.instrument || 'None',
        lessonsTaught,
        costPerLesson: teacher.costPerLesson,
        earnedSalary
      }
    })

    const totalTeacherLiabilities = teacherSalaries.reduce((sum, t) => sum + t.earnedSalary, 0)

    res.json({
      students: {
        totalStudents,
        activeStudents
      },
      teacherSalaries,
      totalTeacherLiabilities
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to fetch summary data' })
  }
})

export default router
