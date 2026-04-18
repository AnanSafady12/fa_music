import { Router } from 'express'
import jwt from 'jsonwebtoken'

const router = Router()

router.post('/login', (req, res) => {
  const { password } = req.body
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123'
  const jwtSecret = process.env.JWT_SECRET || 'fallback-secret'

  if (password === adminPassword) {
    const token = jwt.sign({ role: 'admin' }, jwtSecret, { expiresIn: '24h' })
    return res.json({ token })
  }

  res.status(401).json({ error: 'Incorrect password' })
})

export default router
