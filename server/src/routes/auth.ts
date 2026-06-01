import bcrypt from 'bcryptjs';
import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { getJwtSecret } from '../config/env.js';
import { UserModel } from '../models/User.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const authRouter = Router();

authRouter.post('/signup', asyncHandler(async (req, res) => {
  const { name, email, password } = req.body as { name?: string; email?: string; password?: string };
  if (!name || !email || !password) {
    res.status(400).json({ message: 'Name, email, and password are required' });
    return;
  }

  const normalizedEmail = email.toLowerCase().trim();
  const existing = await UserModel.findOne({ email: normalizedEmail });
  if (existing) {
    res.status(409).json({ message: 'An account already exists for this email' });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await UserModel.create({ name: name.trim(), email: normalizedEmail, passwordHash, authProvider: 'password' });
  const token = jwt.sign({ userId: user._id }, getJwtSecret(), { expiresIn: '30d' });

  res.status(201).json({
    token,
    user: { id: user._id, name: user.name, email: user.email }
  });
}));

authRouter.post('/login', asyncHandler(async (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };
  if (!email || !password) {
    res.status(400).json({ message: 'Email and password are required' });
    return;
  }

  const user = await UserModel.findOne({ email: email.toLowerCase() });
  if (!user) {
    res.status(401).json({ message: 'Invalid credentials' });
    return;
  }

  if (!user.passwordHash) {
    res.status(401).json({ message: 'Use Google login for this account' });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ message: 'Invalid credentials' });
    return;
  }

  const token = jwt.sign({ userId: user._id }, getJwtSecret(), { expiresIn: '30d' });
  res.json({
    token,
    user: { id: user._id, name: user.name, email: user.email }
  });
}));

type GoogleTokenInfo = {
  aud?: string;
  sub?: string;
  email?: string;
  email_verified?: string | boolean;
  name?: string;
  error?: string;
};

type GoogleUserInfo = {
  sub?: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
};

const isVerifiedEmail = (value: string | boolean | undefined) => value === true || value === 'true';

authRouter.post('/google', asyncHandler(async (req, res) => {
  const googleClientId = process.env.GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  if (!googleClientId) {
    res.status(500).json({ message: 'Google login is not configured' });
    return;
  }

  const { credential, accessToken } = req.body as { credential?: string; accessToken?: string };
  if (!credential && !accessToken) {
    res.status(400).json({ message: 'Google credential is required' });
    return;
  }

  let tokenInfo: GoogleTokenInfo;

  if (accessToken) {
    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (!userInfoResponse.ok) {
      res.status(401).json({ message: 'Invalid Google credential' });
      return;
    }

    const userInfo = (await userInfoResponse.json()) as GoogleUserInfo;
    tokenInfo = {
      sub: userInfo.sub,
      email: userInfo.email,
      email_verified: userInfo.email_verified,
      name: userInfo.name,
      aud: googleClientId
    };
  } else {
    const tokenResponse = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(String(credential))}`);

    if (!tokenResponse.ok) {
      res.status(401).json({ message: 'Invalid Google credential' });
      return;
    }

    tokenInfo = (await tokenResponse.json()) as GoogleTokenInfo;
  }

  if (tokenInfo.error || !tokenInfo.sub || !tokenInfo.email || !isVerifiedEmail(tokenInfo.email_verified)) {
    res.status(401).json({ message: 'Google account could not be verified' });
    return;
  }

  const email = tokenInfo.email.toLowerCase().trim();
  let user = await UserModel.findOne({ email });

  if (!user) {
    user = await UserModel.create({
      email,
      name: tokenInfo.name || email.split('@')[0],
      authProvider: 'google',
      googleId: tokenInfo.sub
    });
  } else {
    user.name = user.name || tokenInfo.name || email.split('@')[0];
    user.authProvider = user.authProvider || 'google';
    user.googleId = user.googleId || tokenInfo.sub;
    await user.save();
  }

  const token = jwt.sign({ userId: user._id }, getJwtSecret(), { expiresIn: '30d' });
  res.json({
    token,
    user: { id: user._id, name: user.name, email: user.email }
  });
}));
