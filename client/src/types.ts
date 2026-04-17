export type Instrument = 'Piano' | 'Oud' | 'Guitar' | 'Aorg' | 'Drums' | 'Darbuka' | 'Singing' | 'Qanon'

export const INSTRUMENTS: Instrument[] = ['Piano', 'Oud', 'Guitar', 'Aorg', 'Drums', 'Darbuka', 'Singing', 'Qanon']

export interface Student {
  id: number
  name: string
  parentName?: string
  phone?: string
  instrument?: Instrument
  totalLessons: number
  completedLessons: number
  hasPaid: boolean
  amountPaid: number
  notes?: string
  createdAt: string
  updatedAt: string
}

export interface Teacher {
  id: number
  name: string
  instrument?: Instrument
  phone?: string
  costPerLesson: number
  createdAt: string
  updatedAt: string
}

export interface Lesson {
  id: number
  roomId: number
  studentId?: number
  student?: Student
  startTime: string
  endTime: string
  made: boolean
  isProcessed: boolean
  isBreak: boolean
  breakLabel?: string
}

export interface Room {
  id: number
  name: string
  scheduleId: number
  teacherId?: number
  lessons: Lesson[]
}

export interface Schedule {
  id: number
  dayName: string
  date: string
  rooms: Room[]
}

export const TIME_SLOTS = (() => {
  const slots: string[] = []
  for (let h = 14; h < 22; h++) {
    slots.push(`${String(h).padStart(2,'0')}:00`)
    slots.push(`${String(h).padStart(2,'0')}:30`)
  }
  return slots
})()

export function timeToMins(t: string) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

export function minsToTime(mins: number) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function addMins(t: string, mins: number) {
  return minsToTime(timeToMins(t) + mins);
}

export const DAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']

export const PACKAGES = {
  STANDARD: {
    name: 'Standard Pack',
    lessons: 4,
    price: 600,
    currency: 'ILS'
  }
}

