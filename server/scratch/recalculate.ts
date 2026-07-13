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

    const actualCompleted = student.lessons.filter(l => {
      if (!l.made || l.isBreak) return false
      const scheduleDateIso = new Date(l.room.schedule.date).toISOString().split('T')[0]
      const [h, m] = l.endTime.split(':').map(Number)
      const lessonEndMins = h * 60 + m
      let isPast = false
      if (scheduleDateIso < todayIso) isPast = true
      else if (scheduleDateIso === todayIso) { if (lessonEndMins <= nowMins) isPast = true }
      return isPast
    }).length

    console.log(`Student ${student.name}: Updating count from ${student.completedLessons} to ${actualCompleted}`)
    await prisma.student.update({ where: { id: student.id }, data: { completedLessons: actualCompleted } })
  }
}

recalculate().catch(console.error)
