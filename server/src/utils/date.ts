export function getJerusalemTime() {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Jerusalem',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  });
  const parts = formatter.formatToParts(new Date());
  const partMap: Record<string, string> = {};
  for (const part of parts) {
    partMap[part.type] = part.value;
  }
  const y = partMap.year;
  const m = partMap.month;
  const d = partMap.day;
  const hour = parseInt(partMap.hour || '0', 10);
  const minute = parseInt(partMap.minute || '0', 10);
  
  const todayIso = `${y}-${m}-${d}`;
  const nowMins = hour * 60 + minute;
  return { todayIso, nowMins };
}
