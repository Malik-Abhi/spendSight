import { Router } from 'express';
import { requireAuth, AuthedRequest } from '../middleware/auth.js';
import { TransactionModel } from '../models/Transaction.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { decryptTransactionFields, encryptTransactionFields, needsTransactionEncryption } from '../utils/transactionEncryption.js';

export const transactionRouter = Router();

transactionRouter.use(requireAuth);

function serializeTransaction(transaction: any) {
  const object = transaction.toObject ? transaction.toObject() : transaction;
  const decrypted = decryptTransactionFields(object);
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
}

function sortTransactions(transactions: ReturnType<typeof serializeTransaction>[]) {
  return transactions.sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
}

async function upgradeStoredEncryption(transactions: any[], userId: string) {
  await Promise.all(transactions.map(async (transaction) => {
    const object = transaction.toObject ? transaction.toObject() : transaction;
    if (!needsTransactionEncryption(object)) return;

    const decrypted = decryptTransactionFields(object);
    await TransactionModel.updateOne(
      { _id: object._id, userId },
      { $set: encryptTransactionFields({
        title: decrypted.title,
        amount: decrypted.amount,
        category: decrypted.category,
        date: decrypted.date,
        kind: decrypted.kind,
        source: decrypted.source,
        person: decrypted.person,
        note: decrypted.note
      }) }
    );
  }));
}

transactionRouter.get('/', asyncHandler(async (req: AuthedRequest, res) => {
  const userId = String(req.userId);
  const transactions = await TransactionModel.find({ userId }).sort({ createdAt: -1 });
  await upgradeStoredEncryption(transactions, userId);
  res.json({ transactions: sortTransactions(transactions.map(serializeTransaction)) });
}));

transactionRouter.delete('/', asyncHandler(async (req: AuthedRequest, res) => {
  const result = await TransactionModel.deleteMany({ userId: req.userId });
  res.json({ deletedCount: result.deletedCount ?? 0 });
}));

transactionRouter.post('/', asyncHandler(async (req: AuthedRequest, res) => {
  const person = typeof req.body.person === 'string' ? req.body.person.trim() : '';
  const transaction = await TransactionModel.create(encryptTransactionFields({
    ...req.body,
    person: person || undefined,
    category: person ? 'Trade' : req.body.category,
    userId: req.userId,
    source: 'manual'
  }));
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
      .map((transaction) => encryptTransactionFields({
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

  const encryptedUpdate = encryptTransactionFields({
    title: title.trim(),
    amount: Number(amount),
    category: person?.trim() ? 'Trade' : category.trim(),
    date: date.trim(),
    kind: kind === 'income' ? 'income' : 'expense',
    ...(note?.trim() ? { note: note.trim() } : {}),
    ...(person?.trim() ? { person: person.trim() } : {})
  });
  const unsetUpdate = {
    ...(note?.trim() ? {} : { note: '' }),
    ...(person?.trim() ? {} : { person: '' })
  };

  const transaction = await TransactionModel.findOneAndUpdate(
    { _id: req.params.id, userId: req.userId },
    {
      $set: encryptedUpdate,
      ...(Object.keys(unsetUpdate).length ? { $unset: unsetUpdate } : {})
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
