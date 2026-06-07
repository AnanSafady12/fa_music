import cron from 'node-cron'
import { PrismaClient } from '@prisma/client'
import { getJerusalemTime } from '../utils/date'

const prisma = new PrismaClient()

function timeToMins(t: string) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function getLessonMultiplier(startTime: string, endTime: string) {
  const duration = timeToMins(endTime) - timeToMins(startTime);
  return duration === 25 ? 0.5 : 1.0;
}

// Run every minute
export function startCronJobs() {
  cron.schedule('* * * * *', async () => {
    try {
      // Find lessons that are not processed, are made, and are not breaks.
      const unprocessedLessons = await prisma.lesson.findMany({
        where: {
          isProcessed: false,
          made: true,
          isBreak: false,
          studentId: { not: null }
        },
        include: {
          room: {
            include: { schedule: true }
          }
        }
      })

      const { todayIso, nowMins } = getJerusalemTime()

      console.log(`[Cron] Checking ${unprocessedLessons.length} unprocessed lessons. Local Today: ${todayIso}, mins: ${nowMins}`)

      for (const lesson of unprocessedLessons) {
        const scheduleDateIso = new Date(lesson.room.schedule.date).toISOString().split('T')[0]
        const [h, m] = lesson.endTime.split(':').map(Number)
        const lessonEndMins = h * 60 + m

        let isPast = false
        if (scheduleDateIso < todayIso) {
          isPast = true
        } else if (scheduleDateIso === todayIso) {
          // If it's today, check if the end time has passed (using local hours)
          if (lessonEndMins <= nowMins) {
            isPast = true
          }
        }

        if (isPast) {
          console.log(`[Cron] Processing lesson ${lesson.id} for student ${lesson.studentId} (${lesson.room.schedule.date})`)
          // Process the lesson: increment completedLessons and mark as processed
          await prisma.$transaction(async (tx) => {
            await tx.lesson.update({
              where: { id: lesson.id },
              data: { isProcessed: true }
            })

            if (lesson.studentId) {
              const multiplier = getLessonMultiplier(lesson.startTime, lesson.endTime)
              await tx.student.update({
                where: { id: lesson.studentId },
                data: {
                  completedLessons: { increment: multiplier }
                }
              })
            }
          })
        }
      }
    } catch (err) {
      console.error('Error in lesson completion cron job:', err)
    }
  })
}
