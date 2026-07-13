import { Router } from 'express'
import { PrismaClient } from '@prisma/client'
import { getJerusalemTime } from '../utils/date'

const router = Router()
const prisma = new PrismaClient()

function timeToMins(t: string) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function getLessonMultiplier(startTime: string, endTime: string) {
  const duration = timeToMins(endTime) - timeToMins(startTime);
  return duration === 25 ? 0.5 : 1.0;
}

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
      startDate.setUTCDate(startDate.getUTCDate() - 2) // safety buffer
      const endDate = new Date(Date.UTC(year, month, 1))
      endDate.setUTCDate(endDate.getUTCDate() + 2) // safety buffer
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
        teacher: true,
        room: { include: { schedule: true } }
      }
    })

    const { todayIso, nowMins } = getJerusalemTime()

    // Filter for lessons that belong to the correct month/year in Jerusalem local time and have actually finished
    const processedLessons = lessons.filter(lesson => {
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Jerusalem',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
      const parts = formatter.formatToParts(new Date(lesson.room.schedule.date));
      const partMap: Record<string, string> = {};
      for (const part of parts) {
        partMap[part.type] = part.value;
      }
      
      const lessonYear = Number(partMap.year);
      const lessonMonth = Number(partMap.month);
      
      // Strict calendar month/year filter
      if (month !== null && lessonMonth !== month) return false;
      if (year !== null && lessonYear !== year) return false;

      const scheduleDateIso = `${partMap.year}-${partMap.month}-${partMap.day}`;
      const [h, m] = lesson.endTime.split(':').map(Number)
      const lessonEndMins = h * 60 + m

      if (scheduleDateIso < todayIso) return true
      if (scheduleDateIso === todayIso && lessonEndMins <= nowMins) return true
      return false
    })

    // 4b. Fetch all historical student-teacher assignments to determine regular teachers
    const historicalAssignments = await prisma.lesson.findMany({
      where: {
        teacherId: { not: null },
        studentId: { not: null }
      },
      select: {
        studentId: true,
        teacherId: true
      }
    })

    const studentTeacherMap: Record<number, number> = {}
    const studentTeacherCounts: Record<number, Record<number, number>> = {}
    for (const assignment of historicalAssignments) {
      const sid = assignment.studentId!
      const tid = assignment.teacherId!
      if (!studentTeacherCounts[sid]) {
        studentTeacherCounts[sid] = {}
      }
      studentTeacherCounts[sid][tid] = (studentTeacherCounts[sid][tid] || 0) + 1
    }
    for (const [sidStr, counts] of Object.entries(studentTeacherCounts)) {
      const sid = Number(sidStr)
      let bestTid = null
      let maxCount = 0
      for (const [tidStr, count] of Object.entries(counts)) {
        const tid = Number(tidStr)
        if (count > maxCount) {
          maxCount = count
          bestTid = tid
        }
      }
      if (bestTid !== null) {
        studentTeacherMap[sid] = bestTid
      }
    }

    // 5. Calculate teacher salaries
    const teacherSalaries = teachers.map(teacher => {
      const stats = teacher.monthlyStats[0] || null
      
      let lessonsTaught = 0
      for (const lesson of processedLessons) {
        const multiplier = getLessonMultiplier(lesson.startTime, lesson.endTime)
        
        let resolvedTeacherId = lesson.teacherId
        if (resolvedTeacherId === null && lesson.studentId !== null) {
          resolvedTeacherId = studentTeacherMap[lesson.studentId!] || null
        }

        if (resolvedTeacherId === null && lesson.room?.name) {
          const roomNameLower = lesson.room.name.toLowerCase()
          const matchedTeacher = teachers.find(t => roomNameLower.includes(t.name.toLowerCase()))
          if (matchedTeacher) {
            resolvedTeacherId = matchedTeacher.id
          }
        }

        if (resolvedTeacherId === teacher.id) {
          lessonsTaught += multiplier
        } else if (resolvedTeacherId === null && lesson.student?.instrument === teacher.instrument) {
          // Legacy fallback: attribute lesson if this is the ONLY teacher for that instrument
          const sameInstrumentTeachers = teachers.filter(t => t.instrument === teacher.instrument)
          if (sameInstrumentTeachers.length === 1) {
            lessonsTaught += multiplier
          }
        }
      }

      const calculatedSalary = lessonsTaught * teacher.costPerLesson
      const earnedSalary = stats?.manualSalary !== null && stats?.manualSalary !== undefined ? stats.manualSalary : calculatedSalary
      const displayLessonsTaught = stats?.manualSalary !== null && stats?.manualSalary !== undefined 
        ? (teacher.costPerLesson > 0 ? stats.manualSalary / teacher.costPerLesson : 0)
        : lessonsTaught

      return {
        id: teacher.id,
        name: teacher.name,
        instrument: teacher.instrument || 'None',
        lessonsTaught: displayLessonsTaught,
        costPerLesson: teacher.costPerLesson,
        calculatedSalary,
        earnedSalary,
        notes: stats?.notes || ''
      }
    })

    // 7. Calculate worker hours and liability dynamically from logs for this month/year
    let workerHours = 0
    let workerLiability = 0
    if (month !== null && year !== null) {
      const startDate = new Date(Date.UTC(year, month - 1, 1))
      startDate.setUTCDate(startDate.getUTCDate() - 2) // safety buffer
      const endDate = new Date(Date.UTC(year, month, 1))
      endDate.setUTCDate(endDate.getUTCDate() + 2) // safety buffer
      
      const logs = await prisma.workerLog.findMany({
        where: {
          workerId: worker.id,
          date: {
            gte: startDate,
            lt: endDate
          }
        }
      })

      // Filter in memory by local Jerusalem timezone
      const filteredLogs = logs.filter(log => {
        const formatter = new Intl.DateTimeFormat('en-US', {
          timeZone: 'Asia/Jerusalem',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit'
        });
        const parts = formatter.formatToParts(new Date(log.date));
        const partMap: Record<string, string> = {};
        for (const part of parts) {
          partMap[part.type] = part.value;
        }
        
        const logYear = Number(partMap.year);
        const logMonth = Number(partMap.month);
        
        return logMonth === month && logYear === year;
      })

      workerHours = filteredLogs.reduce((sum, log) => sum + log.hours, 0)
      workerLiability = filteredLogs.reduce((sum, log) => sum + (log.hours * log.costPerHour), 0)
    }


    const totalTeacherLiabilities = teacherSalaries.reduce((sum, t) => sum + t.earnedSalary, 0)
    const grandTotalLiabilities = totalTeacherLiabilities + workerLiability

    res.json({
      students: {
        totalStudents,
        activeStudents
      },
      teacherSalaries,
      totalTeacherLiabilities,
      worker: {
        ...worker,
        totalHours: workerHours
      },
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
