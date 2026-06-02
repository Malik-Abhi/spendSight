import { Router } from 'express';
import { requireAuth, AuthedRequest } from '../middleware/auth.js';
import { TransactionModel } from '../models/Transaction.js';
import { UserModel } from '../models/User.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { decryptTransactionFields, encryptTransactionFields } from '../utils/transactionEncryption.js';

export const peopleRouter = Router();

peopleRouter.use(requireAuth);

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

peopleRouter.get('/', asyncHandler(async (req: AuthedRequest, res) => {
  const user = await UserModel.findById(req.userId);
  res.json({ people: cleanPeople(user?.people ?? []) });
}));

peopleRouter.post('/', asyncHandler(async (req: AuthedRequest, res) => {
  const { name } = req.body as { name?: string };
  const normalized = name?.trim();
  if (!normalized) {
    res.status(400).json({ message: 'Person name is required' });
    return;
  }

  const user = await UserModel.findById(req.userId);
  if (!user) {
    res.status(404).json({ message: 'User not found' });
    return;
  }

  user.people = cleanPeople([...(user.people ?? []), normalized]);
  await user.save();
  res.status(201).json({ people: user.people });
}));

peopleRouter.delete('/:name', asyncHandler(async (req: AuthedRequest, res) => {
  const name = decodeURIComponent(req.params.name).trim().toLowerCase();
  const user = await UserModel.findById(req.userId);
  if (!user) {
    res.status(404).json({ message: 'User not found' });
    return;
  }

  user.people = cleanPeople((user.people ?? []).filter((person) => person.trim().toLowerCase() !== name));
  await user.save();

  const rows = await TransactionModel.find({ userId: req.userId });
  await Promise.all(rows.map(async (transaction) => {
    const object = transaction.toObject();
    const decrypted = decryptTransactionFields(object);
    if (String(decrypted.person || '').trim().toLowerCase() !== name) return;

    await TransactionModel.updateOne(
      { _id: object._id, userId: req.userId },
      { $unset: { person: '' }, $set: encryptTransactionFields({ category: 'Other' }) }
    );
  }));

  const transactions = await TransactionModel.find({ userId: req.userId }).sort({ createdAt: -1 });

  res.json({
    people: user.people,
    transactions: transactions.map((transaction) => {
      const object = transaction.toObject();
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
    }).sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id))
  });
}));
