import mongoose from 'mongoose';

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

export const TransactionModel = mongoose.model('Transaction', transactionSchema);
