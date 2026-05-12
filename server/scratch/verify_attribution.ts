import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function test() {
  console.log('--- Setting up test data ---')
  
  // 1. Create a teacher
  const teacher = await prisma.teacher.upsert({
    where: { id: 999 },
    update: {},
    create: {
      id: 999,
      name: 'Test Teacher',
      instrument: 'Piano',
      costPerLesson: 50
    }
  })
  console.log(`Teacher created: ${teacher.name}`)

  // 2. Ensure a schedule for 2026-04-17 exists
  const dateStr = '2026-04-17'
  const date = new Date(dateStr)
  let schedule = await prisma.schedule.findUnique({ where: { date } })
  if (!schedule) {
    schedule = await prisma.schedule.create({
      data: { dayName: 'Friday', date }
    })
  }

  // 3. Ensure a room with this teacher exists in that schedule
  let room = await prisma.room.findFirst({
    where: { scheduleId: schedule.id, name: 'Room 1' }
  })
  if (room) {
    room = await prisma.room.update({
      where: { id: room.id },
      data: { teacherId: teacher.id }
    })
  } else {
    room = await prisma.room.create({
      data: { name: 'Room 1', scheduleId: schedule.id, teacherId: teacher.id }
    })
  }
  console.log(`Room assigned to teacher: ${room.name}`)

  // 4. Create a student with a DIFFERENT instrument (to prove instrument matching is gone)
  const student = await prisma.student.upsert({
    where: { id: 888 },
    update: {},
    create: {
      id: 888,
      name: 'Test Student',
      instrument: 'Drums', // Teacher is Piano
      totalLessons: 10,
      completedLessons: 0
    }
  })

  // 5. Create a "Made" lesson in that room for the 17th
  const lesson = await prisma.lesson.create({
    data: {
      roomId: room.id,
      studentId: student.id,
      startTime: '16:00',
      endTime: '16:45',
      made: true,
      isProcessed: false
    }
  })
  console.log(`Lesson created: ID ${lesson.id}`)

  console.log('--- Setup Complete ---')
}

test().catch(console.error)
