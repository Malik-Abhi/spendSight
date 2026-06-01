import mongoose from 'mongoose';

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

export const UserModel = mongoose.model('User', userSchema);
