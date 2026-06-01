import { Router } from 'express';
import { requireAuth, AuthedRequest } from '../middleware/auth.js';
import { TransactionModel } from '../models/Transaction.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const transactionRouter = Router();

transactionRouter.use(requireAuth);

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

transactionRouter.get('/', asyncHandler(async (req: AuthedRequest, res) => {
  const transactions = await TransactionModel.find({ userId: req.userId }).sort({ date: -1, createdAt: -1 });
  res.json({ transactions: transactions.map(serializeTransaction) });
}));

transactionRouter.delete('/', asyncHandler(async (req: AuthedRequest, res) => {
  const result = await TransactionModel.deleteMany({ userId: req.userId });
  res.json({ deletedCount: result.deletedCount ?? 0 });
}));

transactionRouter.post('/', asyncHandler(async (req: AuthedRequest, res) => {
  const person = typeof req.body.person === 'string' ? req.body.person.trim() : '';
  const transaction = await TransactionModel.create({
    ...req.body,
    person: person || undefined,
    category: person ? 'Trade' : req.body.category,
    userId: req.userId,
    source: 'manual'
  });
  res.status(201).json({ transaction: serializeTransaction(transaction) });
}));

transactionRouter.post('/import', asyncHandler(async (req: AuthedRequest, res) => {
  const { transactions } = req.body as {
    transactions?: Array<{
      title?: string;
      amount?: number;
      category?: string;
      date?: string;
      note?: string;
      person?: string;
      kind?: 'expense' | 'income';
      source?: 'statement';
    }>;
  };

  if (!Array.isArray(transactions) || !transactions.length) {
    res.status(400).json({ message: 'Transactions are required' });
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
        userId: req.userId
      }))
  );

  res.status(201).json({ transactions: created.map(serializeTransaction) });
}));

transactionRouter.put('/:id', asyncHandler(async (req: AuthedRequest, res) => {
  const { title, amount, category, date, note, person, kind } = req.body as {
    title?: string;
    amount?: number;
    category?: string;
    date?: string;
    note?: string;
    person?: string;
    kind?: 'expense' | 'income';
  };

  if (!title?.trim() || Number(amount) <= 0 || !category?.trim() || !date?.trim()) {
    res.status(400).json({ message: 'Title, amount, category, and date are required' });
    return;
  }

  const transaction = await TransactionModel.findOneAndUpdate(
    { _id: req.params.id, userId: req.userId },
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
    res.status(404).json({ message: 'Transaction not found' });
    return;
  }

  res.json({ transaction: serializeTransaction(transaction) });
}));

transactionRouter.delete('/:id', asyncHandler(async (req: AuthedRequest, res) => {
  const result = await TransactionModel.findOneAndDelete({ _id: req.params.id, userId: req.userId });
  if (!result) {
    res.status(404).json({ message: 'Transaction not found' });
    return;
  }

  res.json({ transaction: serializeTransaction(result) });
}));
