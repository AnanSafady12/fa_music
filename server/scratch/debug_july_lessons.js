const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function getLessonMultiplier(startTime, endTime) {
  const timeToMins = (t) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };
  const duration = timeToMins(endTime) - timeToMins(startTime);
  return duration === 25 ? 0.5 : 1.0;
}

async function main() {
  const month = 7; // July
  const year = 2026;

  console.log(`--- DEBUGGING JULY ${year} LESSONS IN DATABASE ---`);

  // Fetch all teachers
  const teachers = await prisma.teacher.findMany();
  console.log(`\nRegistered Teachers in DB (${teachers.length}):`);
  for (const t of teachers) {
    console.log(`  - ID: ${t.id} | Name: "${t.name}" | Instrument: "${t.instrument}"`);
  }

  // Fetch all lessons in July
  const baseWhere = {
    made: true,
    isBreak: false,
    studentId: { not: null }
  };

  const startDate = new Date(Date.UTC(year, month - 1, 1));
  startDate.setUTCDate(startDate.getUTCDate() - 2);
  const endDate = new Date(Date.UTC(year, month, 1));
  endDate.setUTCDate(endDate.getUTCDate() + 2);
  baseWhere.room = {
    schedule: {
      date: {
        gte: startDate,
        lt: endDate
      }
    }
  };

  const lessons = await prisma.lesson.findMany({
    where: baseWhere,
    include: {
      student: true,
      teacher: true,
      room: {
        include: {
          schedule: true
        }
      }
    }
  });

  // Filter lessons belonging to July in Jerusalem local time
  const julyLessons = lessons.filter(lesson => {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Jerusalem',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    const parts = formatter.formatToParts(new Date(lesson.room.schedule.date));
    const partMap = {};
    for (const part of parts) {
      partMap[part.type] = part.value;
    }
    
    const lessonYear = Number(partMap.year);
    const lessonMonth = Number(partMap.month);
    
    return lessonMonth === month && lessonYear === year;
  });

  console.log(`\nFound ${julyLessons.length} completed/past lessons in July 2026.`);

  // Build the regular teacher map
  const historicalAssignments = await prisma.lesson.findMany({
    where: {
      teacherId: { not: null },
      studentId: { not: null }
    },
    select: {
      studentId: true,
      teacherId: true
    }
  });

  const studentTeacherMap = {};
  const studentTeacherCounts = {};
  for (const assignment of historicalAssignments) {
    const sid = assignment.studentId;
    const tid = assignment.teacherId;
    if (!studentTeacherCounts[sid]) {
      studentTeacherCounts[sid] = {};
    }
    studentTeacherCounts[sid][tid] = (studentTeacherCounts[sid][tid] || 0) + 1;
  }
  for (const [sidStr, counts] of Object.entries(studentTeacherCounts)) {
    const sid = Number(sidStr);
    let bestTid = null;
    let maxCount = 0;
    for (const [tidStr, count] of Object.entries(counts)) {
      const tid = Number(tidStr);
      if (count > maxCount) {
        maxCount = count;
        bestTid = tid;
      }
    }
    if (bestTid !== null) {
      studentTeacherMap[sid] = bestTid;
    }
  }

  const teacherTotals = {};
  for (const t of teachers) {
    teacherTotals[t.id] = { name: t.name, instrument: t.instrument, total: 0 };
  }
  let unresolvedCount = 0;

  console.log('\n--- JULY LESSONS ANALYSIS ---');
  for (const l of julyLessons) {
    const mult = getLessonMultiplier(l.startTime, l.endTime);
    
    let resolvedTeacherId = l.teacherId;
    let method = 'Explicitly Assigned in DB';

    if (resolvedTeacherId === null && l.studentId !== null) {
      resolvedTeacherId = studentTeacherMap[l.studentId] || null;
      method = resolvedTeacherId ? 'Resolved via student history' : 'No history';

      if (resolvedTeacherId === null && l.student?.instrument) {
        const sameInstrumentTeachers = teachers.filter(t => t.instrument === l.student.instrument);
        if (sameInstrumentTeachers.length === 1) {
          resolvedTeacherId = sameInstrumentTeachers[0].id;
          method = 'Resolved via single teacher fallback';
        } else {
          method = `Failed: Multiple teachers (${sameInstrumentTeachers.length}) exist for ${l.student.instrument}`;
        }
      }
    }

    if (resolvedTeacherId === null && l.room?.name) {
      const roomNameLower = l.room.name.toLowerCase();
      const matchedTeacher = teachers.find(t => {
        const nameParts = t.name.toLowerCase().split(/\s+/);
        return roomNameLower.includes(t.name.toLowerCase()) || 
               nameParts.some(part => part.length > 2 && roomNameLower.includes(part));
      });
      if (matchedTeacher) {
        resolvedTeacherId = matchedTeacher.id;
        method = `Resolved via Room Name match: "${l.room.name}" -> "${matchedTeacher.name}"`;
      }
    }

    const dateStr = l.room.schedule.date.toISOString().split('T')[0];
    const studentName = l.student ? l.student.name : 'No Student';
    const studentInstrument = l.student ? l.student.instrument : 'None';
    const assignedTeacherName = l.teacher ? l.teacher.name : 'NULL';
    const resolvedTeacherName = resolvedTeacherId ? (teachers.find(t => t.id === resolvedTeacherId)?.name || 'Unknown') : 'NULL';

    console.log(`Date: ${dateStr} | Student: "${studentName}" (${studentInstrument}) | Assigned: "${assignedTeacherName}" | Resolved: "${resolvedTeacherName}" (${method}) | Multiplier: ${mult}`);

    if (resolvedTeacherId) {
      if (!teacherTotals[resolvedTeacherId]) {
        teacherTotals[resolvedTeacherId] = { name: resolvedTeacherName, instrument: studentInstrument, total: 0 };
      }
      teacherTotals[resolvedTeacherId].total += mult;
    } else {
      unresolvedCount += mult;
    }
  }

  console.log('\n--- CALCULATED MONTHLY STATS SUMMARY ---');
  for (const [id, stats] of Object.entries(teacherTotals)) {
    console.log(`Teacher: "${stats.name}" (${stats.instrument}) -> Calculated Lessons: ${stats.total}`);
  }
  console.log(`Unassigned/Unresolved Lessons: ${unresolvedCount}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
