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

  console.log(`Analyzing database lessons for ${year}-${String(month).padStart(2, '0')}...`);

  // Fetch all teachers
  const teachers = await prisma.teacher.findMany();
  // Fetch all students
  const students = await prisma.student.findMany();

  // Fetch all lessons in July (using a broad date range to handle UTC conversion buffers)
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

  console.log(`Found ${julyLessons.length} lessons in July 2026.`);

  // Build regular teacher map
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

  // Print resolved lessons info
  console.log('\n--- JULY LESSONS DETAIL ---');
  const teacherCounts = {};
  for (const t of teachers) {
    teacherCounts[t.id] = { name: t.name, instrument: t.instrument, total: 0, details: [] };
  }

  for (const l of julyLessons) {
    let resolvedTeacherId = l.teacherId;
    let resolutionMethod = 'Explicitly Assigned';
    if (resolvedTeacherId === null && l.studentId !== null) {
      resolvedTeacherId = studentTeacherMap[l.studentId] || null;
      resolutionMethod = resolvedTeacherId ? 'Resolved via regular teacher history' : 'Unresolved (Null)';
      
      if (resolvedTeacherId === null && l.student?.instrument) {
        const sameInstrumentTeachers = teachers.filter(t => t.instrument === l.student.instrument);
        if (sameInstrumentTeachers.length === 1) {
          resolvedTeacherId = sameInstrumentTeachers[0].id;
          resolutionMethod = 'Resolved via single instrument teacher fallback';
        }
      }
    }

    const mult = getLessonMultiplier(l.startTime, l.endTime);
    const teacherName = resolvedTeacherId ? (teachers.find(t => t.id === resolvedTeacherId)?.name || 'Unknown') : 'None';
    
    if (resolvedTeacherId) {
      if (!teacherCounts[resolvedTeacherId]) {
        teacherCounts[resolvedTeacherId] = { name: teacherName, instrument: l.student?.instrument, total: 0, details: [] };
      }
      teacherCounts[resolvedTeacherId].total += mult;
      teacherCounts[resolvedTeacherId].details.push({
        date: l.room.schedule.date.toISOString().split('T')[0],
        time: `${l.startTime} - ${l.endTime}`,
        student: l.student?.name || 'Unknown',
        mult,
        method: resolutionMethod
      });
    }

    console.log(`Lesson ID: ${l.id} | Date: ${l.room.schedule.date.toISOString().split('T')[0]} | Student: ${l.student?.name} (${l.student?.instrument}) | Assigned Teacher ID: ${l.teacherId} -> Resolved Teacher: ${teacherName} (${resolutionMethod}) | Weight: ${mult}`);
  }

  console.log('\n--- TEACHER TOTALS ---');
  for (const [tid, info] of Object.entries(teacherCounts)) {
    console.log(`Teacher: ${info.name} (${info.instrument || 'None'}) | Total Lessons: ${info.total}`);
    if (info.details.length > 0) {
      console.log('Details:');
      for (const d of info.details) {
        console.log(`  - ${d.date} at ${d.time} | Student: ${d.student} | Weight: ${d.mult} (${d.method})`);
      }
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
