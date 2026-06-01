import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { getJwtSecret } from '../config/env.js';

export type AuthedRequest = Request & {
  userId?: string;
};

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    res.status(401).json({ message: 'Missing token' });
    return;
  }

  try {
    const payload = jwt.verify(token, getJwtSecret()) as { userId: string };
    req.userId = payload.userId;
    next();
  } catch (error) {
    if (error instanceof Error && error.message === 'JWT_SECRET is required') {
      next(error);
      return;
    }
    res.status(401).json({ message: 'Invalid token' });
  }
}
