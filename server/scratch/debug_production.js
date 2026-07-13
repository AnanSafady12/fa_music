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

function getLessonMultiplier(startTime, endTime) {
  const duration = timeToMins(endTime) - timeToMins(startTime);
  return duration === 25 ? 0.5 : 1.0;
}

async function main() {
  console.log('Connecting to PRODUCTION Neon database...\n');

  // 1. List all teachers
  const teachers = await prisma.teacher.findMany();
  console.log(`=== REGISTERED TEACHERS (${teachers.length}) ===`);
  for (const t of teachers) {
    console.log(`  ID: ${t.id} | Name: "${t.name}" | Instrument: ${t.instrument} | Cost/Lesson: ${t.costPerLesson}`);
  }

  // 2. Find July lessons
  const month = 7, year = 2026;
  const startDate = new Date(Date.UTC(year, month - 1, 1));
  startDate.setUTCDate(startDate.getUTCDate() - 2);
  const endDate = new Date(Date.UTC(year, month, 1));
  endDate.setUTCDate(endDate.getUTCDate() + 2);

  const lessons = await prisma.lesson.findMany({
    where: {
      made: true,
      isBreak: false,
      studentId: { not: null },
      room: {
        schedule: {
          date: { gte: startDate, lt: endDate }
        }
      }
    },
    include: {
      student: true,
      teacher: true,
      room: { include: { schedule: true } }
    }
  });

  // Filter to actual July dates in Jerusalem timezone
  const julyLessons = lessons.filter(l => {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Jerusalem',
      year: 'numeric',
      month: '2-digit'
    });
    const parts = formatter.formatToParts(new Date(l.room.schedule.date));
    const partMap = {};
    for (const p of parts) partMap[p.type] = p.value;
    return Number(partMap.month) === month && Number(partMap.year) === year;
  });

  // Also check: how many lessons have passed (endTime < now)
  const now = new Date();
  const nowJerusalem = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Jerusalem' }));
  const todayStr = nowJerusalem.toISOString().split('T')[0];
  const nowMins = nowJerusalem.getHours() * 60 + nowJerusalem.getMinutes();

  const pastLessons = julyLessons.filter(l => {
    const dateStr = new Date(l.room.schedule.date).toISOString().split('T')[0];
    const endMins = timeToMins(l.endTime);
    return dateStr < todayStr || (dateStr === todayStr && endMins <= nowMins);
  });

  console.log(`\n=== JULY LESSONS: ${julyLessons.length} total, ${pastLessons.length} past ===\n`);

  // 3. Build student->teacher history map
  const historicalAssignments = await prisma.lesson.findMany({
    where: { teacherId: { not: null }, studentId: { not: null } },
    select: { studentId: true, teacherId: true }
  });

  const studentTeacherMap = {};
  const studentTeacherCounts = {};
  for (const a of historicalAssignments) {
    if (!studentTeacherCounts[a.studentId]) studentTeacherCounts[a.studentId] = {};
    studentTeacherCounts[a.studentId][a.teacherId] = (studentTeacherCounts[a.studentId][a.teacherId] || 0) + 1;
  }
  for (const [sid, counts] of Object.entries(studentTeacherCounts)) {
    let bestTid = null, maxCount = 0;
    for (const [tid, count] of Object.entries(counts)) {
      if (count > maxCount) { maxCount = count; bestTid = Number(tid); }
    }
    if (bestTid !== null) studentTeacherMap[Number(sid)] = bestTid;
  }

  // 4. Show every past July lesson with full details
  console.log('=== PAST JULY LESSONS (DETAIL) ===');
  
  const teacherTotals = {};
  for (const t of teachers) teacherTotals[t.id] = { name: t.name, instrument: t.instrument, count: 0 };
  let unresolved = 0;

  for (const l of pastLessons) {
    const dateStr = new Date(l.room.schedule.date).toISOString().split('T')[0];
    const mult = getLessonMultiplier(l.startTime, l.endTime);
    const studentName = l.student?.name || 'Unknown';
    const studentInst = l.student?.instrument || 'None';
    const dbTeacher = l.teacher?.name || 'NULL';

    let resolvedId = l.teacherId;
    let method = 'DB Assigned';

    if (resolvedId === null && l.studentId) {
      resolvedId = studentTeacherMap[l.studentId] || null;
      method = resolvedId ? 'History Lookup' : 'No History';

      if (!resolvedId && l.student?.instrument) {
        const sameInst = teachers.filter(t => t.instrument === l.student.instrument);
        if (sameInst.length === 1) {
          resolvedId = sameInst[0].id;
          method = 'Single Teacher Fallback';
        } else {
          method = `UNRESOLVED (${sameInst.length} teachers for ${l.student.instrument})`;
        }
      }
    }

    if (!resolvedId && l.room?.name) {
      const roomLower = l.room.name.toLowerCase();
      const match = teachers.find(t => {
        const parts = t.name.toLowerCase().split(/\s+/);
        return roomLower.includes(t.name.toLowerCase()) || parts.some(p => p.length > 2 && roomLower.includes(p));
      });
      if (match) {
        resolvedId = match.id;
        method = `Room Name ("${l.room.name}" -> "${match.name}")`;
      }
    }

    const resolvedName = resolvedId ? (teachers.find(t => t.id === resolvedId)?.name || '?') : 'NONE';

    console.log(`${dateStr} | ${l.startTime}-${l.endTime} (x${mult}) | Room: "${l.room.name}" | Student: "${studentName}" (${studentInst}) | DB Teacher: "${dbTeacher}" | Resolved: "${resolvedName}" [${method}]`);

    if (resolvedId && teacherTotals[resolvedId]) {
      teacherTotals[resolvedId].count += mult;
    } else {
      unresolved += mult;
    }
  }

  console.log('\n=== CALCULATED TEACHER TOTALS (PAST LESSONS ONLY) ===');
  for (const [id, info] of Object.entries(teacherTotals)) {
    if (info.count > 0) {
      console.log(`  "${info.name}" (${info.instrument}): ${info.count} lessons`);
    }
  }
  if (unresolved > 0) console.log(`  UNRESOLVED: ${unresolved} lessons`);

  // 5. Also check: how many have teacherId = null vs assigned
  const nullTeacherCount = pastLessons.filter(l => l.teacherId === null).length;
  const assignedTeacherCount = pastLessons.filter(l => l.teacherId !== null).length;
  console.log(`\n=== TEACHER ID STATUS ===`);
  console.log(`  Lessons with teacherId assigned: ${assignedTeacherCount}`);
  console.log(`  Lessons with teacherId NULL: ${nullTeacherCount}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
