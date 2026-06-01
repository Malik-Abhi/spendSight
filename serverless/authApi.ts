import bcrypt from 'bcryptjs';
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

const UserModel: any = mongoose.models.User || mongoose.model('User', userSchema);

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

function authPayload(user: any) {
  const token = jwt.sign({ userId: user._id }, requiredEnv('JWT_SECRET'), { expiresIn: '30d' });
  return {
    token,
    user: { id: user._id, name: user.name, email: user.email }
  };
}

function routeFromRequest(req: any) {
  const path = Array.isArray(req.query?.path) ? req.query.path.join('/') : String(req.query?.path || '');
  if (path) return path.replace(/^\/+/, '');

  const url = new URL(req.url || '/', 'https://spendsight.local');
  return url.pathname.replace(/^\/?api\/auth\/?/, '').replace(/^\/+/, '');
}

async function handleSignup(req: any, res: any) {
  const { name, email, password } = await readJsonBody(req);
  if (!name || !email || !password) {
    sendJson(res, 400, { message: 'Name, email, and password are required' });
    return;
  }

  await connectDatabase();
  const normalizedEmail = String(email).toLowerCase().trim();
  const existing = await UserModel.findOne({ email: normalizedEmail });
  if (existing) {
    sendJson(res, 409, { message: 'An account already exists for this email' });
    return;
  }

  const passwordHash = await bcrypt.hash(String(password), 12);
  const user = await UserModel.create({
    name: String(name).trim(),
    email: normalizedEmail,
    passwordHash,
    authProvider: 'password'
  });

  sendJson(res, 201, authPayload(user));
}

async function handleLogin(req: any, res: any) {
  const { email, password } = await readJsonBody(req);
  if (!email || !password) {
    sendJson(res, 400, { message: 'Email and password are required' });
    return;
  }

  await connectDatabase();
  const user = await UserModel.findOne({ email: String(email).toLowerCase().trim() });
  if (!user) {
    sendJson(res, 401, { message: 'Invalid credentials' });
    return;
  }

  if (!user.passwordHash) {
    sendJson(res, 401, { message: 'Use Google login for this account' });
    return;
  }

  const valid = await bcrypt.compare(String(password), user.passwordHash);
  if (!valid) {
    sendJson(res, 401, { message: 'Invalid credentials' });
    return;
  }

  sendJson(res, 200, authPayload(user));
}

export default async function authHandler(req: any, res: any) {
  try {
    if (req.method !== 'POST') {
      sendJson(res, 405, { message: 'Method not allowed' });
      return;
    }

    const route = routeFromRequest(req);
    if (route === 'signup') {
      await handleSignup(req, res);
      return;
    }

    if (route === 'login') {
      await handleLogin(req, res);
      return;
    }

    sendJson(res, 404, { message: 'Auth route not found' });
  } catch (error) {
    console.error('Auth function error:', error);
    sendJson(res, 500, { message: error instanceof Error ? error.message : 'Server error' });
  }
}
