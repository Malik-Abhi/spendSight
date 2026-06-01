import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import mongoose from 'mongoose';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { authRouter } from './routes/auth.js';
import { statementRouter } from './routes/statements.js';
import { peopleRouter } from './routes/people.js';
import { transactionRouter } from './routes/transactions.js';

const dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(dirname, '../../.env') });

const app = express();
const port = Number(process.env.PORT ?? 4000);
const host = process.env.HOST ?? '0.0.0.0';

app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use('/api/auth', authRouter);
app.use('/api/transactions', transactionRouter);
app.use('/api/statements', statementRouter);
app.use('/api/people', peopleRouter);

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

async function start() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is required');

  await mongoose.connect(uri);
  app.listen(port, host, () => {
    console.log(`SpendSight API listening on http://${host}:${port}`);
  });
}

start().catch((error) => {
  console.error(error);
  process.exit(1);
});
