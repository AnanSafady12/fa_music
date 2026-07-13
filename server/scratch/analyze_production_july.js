const axios = require('axios');

async function main() {
  const baseURL = 'https://fa-music-server.vercel.app/api';
  const password = 'admin123'; // From server/.env: ADMIN_PASSWORD=admin123
  
  console.log(`Logging in to production server at ${baseURL}...`);
  let token;
  try {
    const loginRes = await axios.post(`${baseURL}/auth/login`, { password });
    token = loginRes.data.token;
    console.log('Login successful.');
  } catch (err) {
    console.error('Login failed:', err.response ? err.response.data : err.message);
    return;
  }

  const authHeaders = { Authorization: `Bearer ${token}` };

  console.log('\nFetching July 2026 Summary...');
  try {
    const summaryRes = await axios.get(`${baseURL}/summary`, {
      params: { month: 7, year: 2026 },
      headers: authHeaders
    });
    
    console.log('\n=== PRODUCTION SUMMARY TEACHER BREAKDOWN ===');
    console.log(JSON.stringify(summaryRes.data.teacherSalaries, null, 2));

    console.log('\n=== OTHER STATS ===');
    console.log(`Active Students: ${summaryRes.data.students.activeStudents} / ${summaryRes.data.students.totalStudents}`);
    console.log(`Total Teacher Liabilities: ₪${summaryRes.data.totalTeacherLiabilities}`);
  } catch (err) {
    console.error('Failed to fetch summary:', err.response ? err.response.data : err.message);
  }

  console.log('\nFetching schedules to analyze individual lessons...');
  try {
    const schedulesRes = await axios.get(`${baseURL}/schedules`, { headers: authHeaders });
    const schedules = schedulesRes.data;

    // Filter schedules for July 2026
    const julySchedules = schedules.filter(s => {
      const dateStr = s.date; // e.g. "2026-07-14T00:00:00.000Z"
      return dateStr.includes('2026-07-');
    });

    console.log(`\nFound ${julySchedules.length} schedules in July 2026.`);

    // Let's build the list of all made lessons in July 2026
    const julyLessons = [];
    for (const s of julySchedules) {
      const dateStr = s.date.split('T')[0];
      for (const r of s.rooms) {
        for (const l of r.lessons) {
          if (l.made && !l.isBreak && l.student) {
            julyLessons.push({
              date: dateStr,
              roomName: r.name,
              startTime: l.startTime,
              endTime: l.endTime,
              student: l.student,
              assignedTeacher: l.teacher
            });
          }
        }
      }
    }

    console.log(`Found ${julyLessons.length} active (made) student lessons in July 2026.`);

    // Group by student instrument to help the user see what is expected
    const instrumentLessons = {};
    for (const l of julyLessons) {
      const inst = l.student.instrument || 'None';
      if (!instrumentLessons[inst]) {
        instrumentLessons[inst] = [];
      }
      instrumentLessons[inst].push(l);
    }

    console.log('\n=== LESSON BREAKDOWN BY INSTRUMENT ===');
    for (const [inst, list] of Object.entries(instrumentLessons)) {
      console.log(`\nInstrument: ${inst} (${list.length} lessons)`);
      for (const l of list) {
        const teacherName = l.assignedTeacher ? l.assignedTeacher.name : 'NULL';
        console.log(`  - Date: ${l.date} | Time: ${l.startTime}-${l.endTime} | Student: ${l.student.name} | Assigned Teacher: ${teacherName}`);
      }
    }
  } catch (err) {
    console.error('Failed to fetch schedules:', err.response ? err.response.data : err.message);
  }
}

main().catch(console.error);
