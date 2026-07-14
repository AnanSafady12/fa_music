const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://neondb_owner:npg_OHj1bfKAXsI9@ep-late-block-al1w5re2-pooler.c-3.eu-central-1.aws.neon.tech/neondb?sslmode=require'
    }
  }
});

async function main() {
  const now = new Date();
  console.log(`Current server time: ${now.toISOString()}`);

  const schedules = await prisma.schedule.findMany({
    orderBy: { date: 'desc' },
    take: 5,
    include: {
      rooms: {
        include: {
          lessons: {
            include: { student: true, teacher: true }
          }
        }
      }
    }
  });

  console.log('\n=== RECENT SCHEDULES ===');
  for (const s of schedules) {
    const dateStr = s.date.toISOString().split('T')[0];
    console.log(`Schedule: ${dateStr} (${s.dayName}) | ID: ${s.id}`);
    for (const r of s.rooms) {
      const lessonsStr = r.lessons.map(l => {
        const type = l.isBreak ? 'BREAK' : 'LESSON';
        const name = l.isBreak ? `"${l.breakLabel}"` : `"${l.student?.name}"`;
        return `${l.startTime}-${l.endTime} (${type} ${name})`;
      }).join(', ');
      console.log(`  Room "${r.name}" (ID: ${r.id}): [${lessonsStr}]`);
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
