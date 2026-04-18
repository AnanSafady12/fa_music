import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'

export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.split(' ')[1]
  
  if (!token) {
    return res.status(401).json({ error: 'Access denied. No token provided.' })
  }

  try {
    const secret = process.env.JWT_SECRET || 'fallback-secret'
    jwt.verify(token, secret)
    next()
  } catch (error) {
    res.status(401).json({ error: 'Invalid or expired token.' })
  }
}
