import { Router } from 'express';
import { requireAuth, AuthedRequest } from '../middleware/auth.js';
import { TransactionModel } from '../models/Transaction.js';
import { UserModel } from '../models/User.js';

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

function exactPersonRegex(name: string) {
  return new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
}

peopleRouter.get('/', async (req: AuthedRequest, res) => {
  const user = await UserModel.findById(req.userId);
  res.json({ people: cleanPeople(user?.people ?? []) });
});

peopleRouter.post('/', async (req: AuthedRequest, res) => {
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
});

peopleRouter.delete('/:name', async (req: AuthedRequest, res) => {
  const name = decodeURIComponent(req.params.name).trim().toLowerCase();
  const user = await UserModel.findById(req.userId);
  if (!user) {
    res.status(404).json({ message: 'User not found' });
    return;
  }

  user.people = cleanPeople((user.people ?? []).filter((person) => person.trim().toLowerCase() !== name));
  await user.save();

  await TransactionModel.updateMany(
    { userId: req.userId, person: exactPersonRegex(name) },
    { $unset: { person: '' }, $set: { category: 'Other' } }
  );
  const transactions = await TransactionModel.find({ userId: req.userId }).sort({ date: -1, createdAt: -1 });

  res.json({
    people: user.people,
    transactions: transactions.map((transaction) => {
      const object = transaction.toObject();
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
    })
  });
});
