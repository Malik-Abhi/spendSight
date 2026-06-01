import cors from 'cors';
import dotenv from 'dotenv';
import express, { NextFunction, Request, Response } from 'express';
import mongoose from 'mongoose';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { authRouter } from './routes/auth.js';
import { statementRouter } from './routes/statements.js';
import { peopleRouter } from './routes/people.js';
import { transactionRouter } from './routes/transactions.js';

const dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(dirname, '../../.env') });

let connectionPromise: Promise<typeof mongoose> | null = null;

export async function connectDatabase() {
  if (mongoose.connection.readyState === 1) return;

  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is required');

  connectionPromise ??= mongoose.connect(uri);
  await connectionPromise;
}

export const app = express();

app.use(cors());
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.use(async (req, _res, next) => {
  if (req.path === '/api/health') {
    next();
    return;
  }

  try {
    await connectDatabase();
    next();
  } catch (error) {
    next(error);
  }
});

app.use('/api/auth', authRouter);
app.use('/api/transactions', transactionRouter);
app.use('/api/statements', statementRouter);
app.use('/api/people', peopleRouter);

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(error);
  res.status(500).json({ message: error instanceof Error ? error.message : 'Server error' });
});

export default app;
