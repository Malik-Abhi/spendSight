export type ThemeMode = 'light' | 'dark';

export type ExpenseCategory = string;

export type Transaction = {
  id: string;
  title: string;
  amount: number;
  category: ExpenseCategory;
  date: string;
  note?: string;
  person?: string;
  kind: 'expense' | 'income';
  source: 'manual' | 'statement';
};

export type ParsedStatementTransaction = Omit<Transaction, 'id'> & {
  categoryConfidence?: number;
  needsCategoryReview?: boolean;
};

export type CategoryTotal = {
  category: ExpenseCategory;
  total: number;
  color: string;
};

export type User = {
  id: string;
  name: string;
  email: string;
};

export type AuthSession = {
  token: string;
  user: User;
};
