import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function debug() {
  const students = await prisma.student.findMany()
  console.log('--- ALL STUDENTS ---')
  for (const s of students) {
    console.log(`ID: ${s.id}, Name: ${s.name}, Completed: ${s.completedLessons}, Total: ${s.totalLessons}`)
  }

  const lessons = await prisma.lesson.findMany({
    include: { student: true, room: { include: { schedule: true } } }
  })
  console.log('--- ALL LESSONS ---')
  for (const l of lessons) {
     console.log(`ID: ${l.id}, Date: ${l.room.schedule.date.toISOString()}, Student: ${l.student?.name || 'NULL'}, StudentID: ${l.studentId}, Made: ${l.made}, Processed: ${l.isProcessed}`)
  }
}

debug().catch(console.error)
