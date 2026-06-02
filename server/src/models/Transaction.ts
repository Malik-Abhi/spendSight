import mongoose from 'mongoose';
import { decryptTransactionFields, encryptTransactionFields, needsTransactionEncryption } from '../utils/transactionEncryption.js';

const transactionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true },
    amount: { type: mongoose.Schema.Types.Mixed, required: true },
    category: { type: String, required: true },
    date: { type: String, required: true },
    kind: { type: String, default: 'expense' },
    source: { type: String, default: 'manual' },
    person: String,
    note: String
  },
  { timestamps: true }
);

transactionSchema.pre('validate', function encryptBeforeValidate(next) {
  const object = this.toObject();
  if (needsTransactionEncryption(object)) {
    this.set(encryptTransactionFields(object));
  }
  next();
});

transactionSchema.pre(['findOneAndUpdate', 'updateOne', 'updateMany'], function encryptBeforeUpdate(next) {
  const update = this.getUpdate() as Record<string, any> | null;
  if (!update) {
    next();
    return;
  }

  if (update.$set) {
    update.$set = encryptTransactionFields(update.$set);
  } else {
    this.setUpdate(encryptTransactionFields(update));
  }

  next();
});

transactionSchema.methods.toClient = function toClientTransaction() {
  const decrypted = decryptTransactionFields(this.toObject());
  return {
    id: String(decrypted._id),
    title: String(decrypted.title ?? ''),
    amount: Number(decrypted.amount ?? 0),
    category: String(decrypted.category ?? 'Other'),
    date: String(decrypted.date ?? ''),
    note: decrypted.note ? String(decrypted.note) : undefined,
    person: decrypted.person ? String(decrypted.person) : undefined,
    kind: decrypted.kind === 'income' ? 'income' : 'expense',
    source: decrypted.source === 'statement' ? 'statement' : 'manual'
  };
};

export const TransactionModel = mongoose.model('Transaction', transactionSchema);
