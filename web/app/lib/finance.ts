import { Transaction } from '../../../models/expense';
import { assignCategoryColors } from '../../../models/palette';

export const baseCategories = ['Food', 'Travel', 'Bills', 'Shopping', 'Health', 'Entertainment', 'Education', 'Savings', 'Lending', 'Other'];

export function monthKey(date: string) {
  return date.slice(0, 7);
}

export function monthLabel(key: string) {
  const [year, month] = key.split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
}

export function currency(value: number) {
  return `₹${value.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

export function transactionFingerprint(transaction: Pick<Transaction, 'title' | 'amount' | 'date' | 'kind'> & { person?: string; category?: string }) {
  return [
    transaction.title.trim().toLowerCase().replace(/\s+/g, ' '),
    Number(transaction.amount).toFixed(2),
    transaction.date.trim(),
    transaction.kind ?? 'expense',
    (transaction.person || '').trim().toLowerCase(),
    (transaction.category || '').trim().toLowerCase()
  ].join('|');
}

export function buildCategoryTotals(transactions: Transaction[], categories: string[]) {
  const allCategories = Array.from(new Set([...categories, ...transactions.map((item) => item.category)])).filter(Boolean);
  const colors = new Map(assignCategoryColors(allCategories).map((item) => [item.category, item.color]));
  return allCategories
    .map((category) => ({
      category,
      total: transactions.filter((item) => item.category === category).reduce((sum, item) => sum + item.amount, 0),
      color: colors.get(category) ?? '#64748B'
    }))
    .filter((item) => item.total > 0)
    .sort((a, b) => b.total - a.total);
}

export function counterpartyKey(title: string) {
  const cleaned = title
    .toLowerCase()
    .replace(/\b(upi|imps|neft|rtgs|paytm|gpay|phonepe|sent|using|to|from)\b/g, ' ')
    .replace(/[^a-z/ ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned
    .split('/')
    .map((part) => part.trim())
    .find((part) => part.split(/\s+/).filter(Boolean).length >= 2) || cleaned;
}
