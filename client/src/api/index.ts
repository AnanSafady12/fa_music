import api from './client'

export const getStudents = () => api.get('/students').then(r => r.data)
export const createStudent = (data: any) => api.post('/students', data).then(r => r.data)
export const updateStudent = (id: number, data: any) => api.put(`/students/${id}`, data).then(r => r.data)
export const deleteStudent = (id: number) => api.delete(`/students/${id}`).then(r => r.data)

export const getTeachers = () => api.get('/teachers').then(r => r.data)
export const createTeacher = (data: any) => api.post('/teachers', data).then(r => r.data)
export const updateTeacher = (id: number, data: any) => api.put(`/teachers/${id}`, data).then(r => r.data)
export const deleteTeacher = (id: number) => api.delete(`/teachers/${id}`).then(r => r.data)

export const getSchedules = () => api.get('/schedules').then(r => r.data)
export const getScheduleByDate = (date: string) => api.get(`/schedules/by-date/${date}`).then(r => r.data)
export const createSchedule = (data: any) => api.post('/schedules', data).then(r => r.data)
export const deleteSchedule = (id: number) => api.delete(`/schedules/${id}`).then(r => r.data)
export const copyLastWeek = (id: number, data: any) => api.post(`/schedules/${id}/copy-last-week`, data).then(r => r.data)

export const createLesson = (data: any) => api.post('/lessons', data).then(r => r.data)
export const updateLesson = (id: number, data: any) => api.put(`/lessons/${id}`, data).then(r => r.data)
export const insertBreak = (data: any) => api.post('/lessons/insert-break', data).then(r => r.data)
export const toggleAttendance = (id: number) => api.patch(`/lessons/${id}/attendance`, {}).then(r => r.data)
export const deleteLesson = (id: number) => api.delete(`/lessons/${id}`).then(r => r.data)

export const updateRoom = (id: number, data: any) => api.put(`/schedules/rooms/${id}`, data).then(r => r.data)
export const getSummary = (month?: number, year?: number) => api.get('/summary', { params: { month, year } }).then(r => r.data)
