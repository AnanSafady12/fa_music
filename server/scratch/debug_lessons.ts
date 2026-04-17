import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const students = await prisma.student.findMany({
    where: { name: { contains: 'test' } },
    include: {
      lessons: {
        include: {
          room: { include: { schedule: true } }
        }
      }
    }
  })

  for (const s of students) {
    console.log(`Student: ${s.name} (id: ${s.id})`)
    console.log(`- totalLessons: ${s.totalLessons}`)
    console.log(`- completedLessons: ${s.completedLessons}`)
    console.log(`- Lessons found: ${s.lessons.length}`)
    for (const l of s.lessons) {
       console.log(`  - Lesson ${l.id}: ${l.startTime}-${l.endTime} on ${l.room.schedule.date.toISOString()} | made: ${l.made} | processed: ${l.isProcessed} | isBreak: ${l.isBreak}`)
    }
  }
}

main()
