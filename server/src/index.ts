import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import studentsRouter from './routes/students'
import teachersRouter from './routes/teachers'
import schedulesRouter from './routes/schedules'
import lessonsRouter from './routes/lessons'
import summaryRouter from './routes/summary'
import { startCronJobs } from './cron'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors())
app.use(express.json())

app.use('/api/students', studentsRouter)
app.use('/api/teachers', teachersRouter)
app.use('/api/schedules', schedulesRouter)
app.use('/api/lessons', lessonsRouter)
app.use('/api/summary', summaryRouter)

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }))

// Automatically process lessons whose end time has passed
startCronJobs()

app.listen(PORT, () => {
  console.log(`FA Music server running on http://localhost:${PORT}`)
})

export default app
