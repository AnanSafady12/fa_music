import { PrismaClient } from '@prisma/client'
import dotenv from 'dotenv'
dotenv.config()

const prisma = new PrismaClient()

async function recalculate() {
  const students = await prisma.student.findMany({ include: { lessons: { include: { room: { include: { schedule: true } } } } } })
  console.log(`Recalculating for ${students.length} students...`)
  
  for (const student of students) {
    const now = new Date()
    const todayIso = now.toISOString().split('T')[0]
    const nowMins = now.getHours() * 60 + now.getMinutes()

    const timeToMins = (t) => {
      const [h, m] = t.split(':').map(Number);
      return h * 60 + m;
    };
    const getLessonMultiplier = (startTime, endTime) => {
      const duration = timeToMins(endTime) - timeToMins(startTime);
      return duration === 25 ? 0.5 : 1.0;
    };

    const actualCompleted = student.lessons.reduce((sum, l) => {
      if (!l.made || l.isBreak) return sum
      const scheduleDateIso = new Date(l.room.schedule.date).toISOString().split('T')[0]
      const [h, m] = l.endTime.split(':').map(Number)
      const lessonEndMins = h * 60 + m
      let isPast = false
      if (scheduleDateIso < todayIso) isPast = true
      else if (scheduleDateIso === todayIso) { if (lessonEndMins <= nowMins) isPast = true }
      
      if (isPast) {
        return sum + getLessonMultiplier(l.startTime, l.endTime)
      }
      return sum
    }, 0)

    console.log(`Student ${student.name}: Updating count from ${student.completedLessons} to ${actualCompleted}`)
    await prisma.student.update({ where: { id: student.id }, data: { completedLessons: actualCompleted } })
  }
}

recalculate().catch(console.error)
