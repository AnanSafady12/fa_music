import cron from 'node-cron'
import { PrismaClient } from '@prisma/client'
import { getJerusalemTime } from '../utils/date'
import { sendLessonReminder } from '../services/whatsapp'

const prisma = new PrismaClient()

function getDaysDiff(dateStr1: string, dateStr2: string): number {
  const d1 = new Date(dateStr1)
  const d2 = new Date(dateStr2)
  const diffTime = d1.getTime() - d2.getTime()
  return Math.round(diffTime / (1000 * 60 * 60 * 24))
}

export function startWhatsAppCronJob() {
  console.log('[WhatsApp Cron] Initialized WhatsApp reminder cron job (runs every minute).')
  
  // Run every minute
  cron.schedule('* * * * *', async () => {
    try {
      // Find lessons that need reminders (not break, made, student assigned, reminder not sent yet)
      const pendingLessons = await prisma.lesson.findMany({
        where: {
          made: true,
          isBreak: false,
          studentId: { not: null },
          reminderSent: false
        },
        include: {
          student: true,
          room: {
            include: { schedule: true }
          }
        }
      })

      if (pendingLessons.length === 0) return

      const { todayIso, nowMins } = getJerusalemTime()

      for (const lesson of pendingLessons) {
        if (!lesson.student) continue

        const scheduleDateIso = new Date(lesson.room.schedule.date).toISOString().split('T')[0]
        const [h, m] = lesson.startTime.split(':').map(Number)
        const lessonStartMins = h * 60 + m

        const daysDiff = getDaysDiff(scheduleDateIso, todayIso)
        const diffMins = (daysDiff * 1440) + lessonStartMins - nowMins

        // Target: lesson starts in approximately 3 hours (180 minutes)
        // We look for a window between 170 and 180 minutes (2h 50m to 3h) to prevent missing
        if (diffMins >= 170 && diffMins <= 180) {
          const student = lesson.student
          const phone = student.phone || student.phone2

          console.log(`[WhatsApp Cron] Lesson ${lesson.id} for student ${student.name} starts in ${diffMins} minutes. Sending reminder...`)

          // Mark as sent immediately to prevent any concurrent cron execution from sending duplicates
          await prisma.lesson.update({
            where: { id: lesson.id },
            data: { reminderSent: true }
          })

          if (phone) {
            try {
              const instrumentName = student.instrument || 'music'
              await sendLessonReminder(student.name, instrumentName, lesson.startTime, phone)
            } catch (err) {
              console.error(`[WhatsApp Cron] Failed sending WhatsApp message for lesson ${lesson.id}:`, err)
            }
          } else {
            console.log(`[WhatsApp Cron] Student ${student.name} has no phone numbers listed. Skipping message.`)
          }
        } else if (diffMins < 170) {
          // If the lesson is already less than 170 minutes away (or in the past) and a reminder was never sent
          // (e.g. scheduled late, or server was down), we mark it as sent = true so it is ignored by subsequent checks.
          await prisma.lesson.update({
            where: { id: lesson.id },
            data: { reminderSent: true }
          })
          console.log(`[WhatsApp Cron] Lesson ${lesson.id} is starting too soon or is past (${diffMins} mins diff). Marking reminder as skipped/sent.`)
        }
      }
    } catch (err) {
      console.error('[WhatsApp Cron] Error in WhatsApp reminder job:', err)
    }
  })
}
