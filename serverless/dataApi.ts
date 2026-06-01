import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';

let connectionPromise: Promise<typeof mongoose> | null = null;

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    passwordHash: { type: String },
    authProvider: { type: String, enum: ['password', 'google'], default: 'password' },
    googleId: { type: String },
    people: { type: [String], default: [] }
  },
  { timestamps: true }
);

const transactionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true },
    amount: { type: Number, required: true },
    category: { type: String, required: true },
    date: { type: String, required: true },
    kind: { type: String, enum: ['expense', 'income'], default: 'expense' },
    source: { type: String, enum: ['manual', 'statement'], default: 'manual' },
    person: String,
    note: String
  },
  { timestamps: true }
);

const UserModel: any = mongoose.models.User || mongoose.model('User', userSchema);
const TransactionModel: any = mongoose.models.Transaction || mongoose.model('Transaction', transactionSchema);

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

async function connectDatabase() {
  if (mongoose.connection.readyState === 1) return;
  connectionPromise ??= mongoose.connect(requiredEnv('MONGODB_URI'));
  await connectionPromise;
}

function sendJson(res: any, status: number, payload: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

async function readJsonBody(req: any) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') return JSON.parse(req.body || '{}');

  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const raw = Buffer.concat(chunks).toString('utf8').trim();
  return raw ? JSON.parse(raw) : {};
}

function routeFromRequest(req: any, base: string) {
  const path = Array.isArray(req.query?.path) ? req.query.path.join('/') : String(req.query?.path || '');
  if (path) return path.replace(/^\/+/, '');

  const url = new URL(req.url || '/', 'https://spendsight.local');
  return url.pathname.replace(new RegExp(`^/?api/${base}/?`), '').replace(/^\/+/, '');
}

async function getUserId(req: any) {
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) throw Object.assign(new Error('Missing token'), { statusCode: 401 });
  const payload = jwt.verify(token, requiredEnv('JWT_SECRET')) as { userId: string };
  return payload.userId;
}

function serializeTransaction(transaction: any) {
  const object = transaction.toObject ? transaction.toObject() : transaction;
  return {
    id: String(object._id),
    title: object.title,
    amount: object.amount,
    category: object.category,
    date: object.date,
    note: object.note,
    person: object.person,
    kind: object.kind ?? 'expense',
    source: object.source
  };
}

function cleanPeople(people: unknown[]) {
  const merged = new Map<string, string>();
  people
    .map((person) => String(person).trim())
    .filter(Boolean)
    .forEach((person) => {
      const key = person.toLowerCase();
      if (!merged.has(key)) merged.set(key, person);
    });
  return Array.from(merged.values()).sort((a, b) => a.localeCompare(b));
}

function exactPersonRegex(name: string) {
  return new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
}

async function allUserTransactions(userId: string) {
  const transactions = await TransactionModel.find({ userId }).sort({ date: -1, createdAt: -1 });
  return transactions.map(serializeTransaction);
}

export async function transactionsHandler(req: any, res: any) {
  try {
    await connectDatabase();
    const userId = await getUserId(req);
    const route = routeFromRequest(req, 'transactions');

    if (!route && req.method === 'GET') {
      sendJson(res, 200, { transactions: await allUserTransactions(userId) });
      return;
    }

    if (!route && req.method === 'DELETE') {
      const result = await TransactionModel.deleteMany({ userId });
      sendJson(res, 200, { deletedCount: result.deletedCount ?? 0 });
      return;
    }

    if (!route && req.method === 'POST') {
      const body = await readJsonBody(req);
      const person = typeof body.person === 'string' ? body.person.trim() : '';
      const transaction = await TransactionModel.create({
        ...body,
        person: person || undefined,
        category: person ? 'Trade' : body.category,
        userId,
        source: 'manual'
      });
      sendJson(res, 201, { transaction: serializeTransaction(transaction) });
      return;
    }

    if (route === 'import' && req.method === 'POST') {
      const { transactions } = await readJsonBody(req);
      if (!Array.isArray(transactions) || !transactions.length) {
        sendJson(res, 400, { message: 'Transactions are required' });
        return;
      }

      const created = await TransactionModel.insertMany(
        transactions
          .filter((transaction) => transaction.title && Number(transaction.amount) > 0 && transaction.category && transaction.date)
          .map((transaction) => ({
            title: transaction.title,
            amount: transaction.amount,
            category: transaction.person?.trim() ? 'Trade' : transaction.category,
            date: transaction.date,
            note: transaction.note,
            person: transaction.person?.trim(),
            kind: transaction.kind === 'income' ? 'income' : 'expense',
            source: 'statement',
            userId
          }))
      );
      sendJson(res, 201, { transactions: created.map(serializeTransaction) });
      return;
    }

    if (route && req.method === 'PUT') {
      const body = await readJsonBody(req);
      const { title, amount, category, date, note, person, kind } = body;
      if (!title?.trim() || Number(amount) <= 0 || !category?.trim() || !date?.trim()) {
        sendJson(res, 400, { message: 'Title, amount, category, and date are required' });
        return;
      }

      const transaction = await TransactionModel.findOneAndUpdate(
        { _id: route, userId },
        {
          title: title.trim(),
          amount: Number(amount),
          category: person?.trim() ? 'Trade' : category.trim(),
          date: date.trim(),
          note: note?.trim(),
          person: person?.trim(),
          kind: kind === 'income' ? 'income' : 'expense'
        },
        { new: true }
      );

      if (!transaction) {
        sendJson(res, 404, { message: 'Transaction not found' });
        return;
      }

      sendJson(res, 200, { transaction: serializeTransaction(transaction) });
      return;
    }

    if (route && req.method === 'DELETE') {
      const result = await TransactionModel.findOneAndDelete({ _id: route, userId });
      if (!result) {
        sendJson(res, 404, { message: 'Transaction not found' });
        return;
      }

      sendJson(res, 200, { transaction: serializeTransaction(result) });
      return;
    }

    sendJson(res, 405, { message: 'Method not allowed' });
  } catch (error: any) {
    console.error('Transactions function error:', error);
    sendJson(res, error.statusCode || 500, { message: error instanceof Error ? error.message : 'Server error' });
  }
}

export async function peopleHandler(req: any, res: any) {
  try {
    await connectDatabase();
    const userId = await getUserId(req);
    const route = routeFromRequest(req, 'people');

    if (!route && req.method === 'GET') {
      const user = await UserModel.findById(userId);
      sendJson(res, 200, { people: cleanPeople(user?.people ?? []) });
      return;
    }

    if (!route && req.method === 'POST') {
      const { name } = await readJsonBody(req);
      const normalized = String(name || '').trim();
      if (!normalized) {
        sendJson(res, 400, { message: 'Person name is required' });
        return;
      }

      const user = await UserModel.findById(userId);
      if (!user) {
        sendJson(res, 404, { message: 'User not found' });
        return;
      }

      user.people = cleanPeople([...(user.people ?? []), normalized]);
      await user.save();
      sendJson(res, 201, { people: user.people });
      return;
    }

    if (route && req.method === 'DELETE') {
      const name = decodeURIComponent(route).trim().toLowerCase();
      const user = await UserModel.findById(userId);
      if (!user) {
        sendJson(res, 404, { message: 'User not found' });
        return;
      }

      user.people = cleanPeople((user.people ?? []).filter((person: string) => person.trim().toLowerCase() !== name));
      await user.save();
      await TransactionModel.updateMany(
        { userId, person: exactPersonRegex(name) },
        { $unset: { person: '' }, $set: { category: 'Other' } }
      );

      sendJson(res, 200, {
        people: user.people,
        transactions: await allUserTransactions(userId)
      });
      return;
    }

    sendJson(res, 405, { message: 'Method not allowed' });
  } catch (error: any) {
    console.error('People function error:', error);
    sendJson(res, error.statusCode || 500, { message: error instanceof Error ? error.message : 'Server error' });
  }
}
