import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import studentsRouter from './routes/students'
import teachersRouter from './routes/teachers'
import schedulesRouter from './routes/schedules'
import lessonsRouter from './routes/lessons'
import summaryRouter from './routes/summary'
import workerRouter from './routes/worker'
import authRouter from './routes/auth'
import { authMiddleware } from './middleware/authMiddleware'
import { startCronJobs } from './cron'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors())
app.use(express.json())

// Public routes
app.use('/api/auth', authRouter)
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }))

// Protected routes
app.use('/api/students', authMiddleware, studentsRouter)
app.use('/api/teachers', authMiddleware, teachersRouter)
app.use('/api/schedules', authMiddleware, schedulesRouter)
app.use('/api/lessons', authMiddleware, lessonsRouter)
app.use('/api/summary', authMiddleware, summaryRouter)
app.use('/api/worker', authMiddleware, workerRouter)

// Automatically process lessons whose end time has passed
startCronJobs()

app.listen(PORT, () => {
  console.log(`FA Music server running on http://localhost:${PORT}`)
})

export default app
