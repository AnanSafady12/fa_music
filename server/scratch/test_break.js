const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://neondb_owner:npg_OHj1bfKAXsI9@ep-late-block-al1w5re2-pooler.c-3.eu-central-1.aws.neon.tech/neondb?sslmode=require'
    }
  }
});

function timeToMins(t) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function minsToTime(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function addMins(t, mins) {
  return minsToTime(timeToMins(t) + mins);
}

async function testInsertBreak(roomId, startTime, durationMins) {
  console.log(`Inserting break in room ${roomId} at ${startTime} with duration ${durationMins}...`);
  const lessonsToShift = await prisma.lesson.findMany({ where: { roomId } });
  const shiftMins = Number(durationMins);
  const targetMins = timeToMins(startTime);

  for (const lesson of lessonsToShift) {
    if (timeToMins(lesson.startTime) >= targetMins) {
      console.log(`Shifting lesson ${lesson.id} (${lesson.startTime} -> ${addMins(lesson.startTime, shiftMins)})...`);
      await prisma.lesson.update({
        where: { id: lesson.id },
        data: {
          startTime: addMins(lesson.startTime, shiftMins),
          endTime: addMins(lesson.endTime, shiftMins)
        }
      });
    }
  }

  const breakLesson = await prisma.lesson.create({
    data: {
      roomId,
      startTime,
      endTime: addMins(startTime, shiftMins),
      isBreak: true,
      breakLabel: 'Test Break'
    }
  });
  console.log(`Successfully created break: id = ${breakLesson.id}\n`);
  return breakLesson.id;
}

async function testDeleteLesson(id) {
  console.log(`Deleting lesson/break ${id}...`);
  await prisma.lesson.delete({ where: { id } });
  console.log(`Successfully deleted.\n`);
}

async function main() {
  // Let's find a valid room in July 2026 to test on
  const room = await prisma.room.findFirst({
    where: {
      lessons: {
        some: {
          room: {
            schedule: {
              date: {
                gte: new Date('2026-07-01'),
                lt: new Date('2026-08-01')
              }
            }
          }
        }
      }
    }
  });

  if (!room) {
    console.log('No rooms found in July to test.');
    return;
  }

  console.log(`Testing on Room ID: ${room.id} ("${room.name}")`);

  // Insert break 1
  const b1 = await testInsertBreak(room.id, '18:00', 15);
  // Delete break 1
  await testDeleteLesson(b1);
  // Insert break 2
  const b2 = await testInsertBreak(room.id, '18:00', 15);
  // Delete break 2
  await testDeleteLesson(b2);

  console.log('Test completed successfully. No DB errors!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
