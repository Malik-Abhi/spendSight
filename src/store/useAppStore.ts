import { create } from 'zustand';
import { CategoryTotal, ExpenseCategory, ThemeMode, Transaction, User } from '../types/expense';
import { categoryColors } from '../theme/palette';

type AppState = {
  user: User | null;
  token: string | null;
  themeMode: ThemeMode;
  transactions: Transaction[];
  categories: ExpenseCategory[];
  people: string[];
  statementImageUri: string | null;
  setSession: (token: string, user: User) => void;
  logout: () => void;
  toggleTheme: () => void;
  setTransactions: (transactions: Transaction[]) => void;
  setPeople: (people: string[]) => void;
  addPerson: (person: string) => void;
  removePerson: (person: string) => void;
  addTransaction: (transaction: Transaction) => void;
  addTransactions: (transactions: Transaction[]) => void;
  updateTransaction: (transaction: Transaction) => void;
  removeTransaction: (id: string) => void;
  clearTransactions: () => void;
  addCategory: (category: ExpenseCategory) => void;
  setStatementImageUri: (uri: string | null) => void;
  getCategoryTotals: () => CategoryTotal[];
  getMonthlyTotal: () => number;
};

export const categories: ExpenseCategory[] = [
  'Food',
  'Travel',
  'Bills',
  'Shopping',
  'Health',
  'Entertainment',
  'Education',
  'Savings',
  'Lending',
  'Other'
];

export const useAppStore = create<AppState>((set, get) => ({
  user: null,
  token: null,
  themeMode: 'dark',
  transactions: [],
  categories,
  people: [],
  statementImageUri: null,
  setSession: (token, user) => set({ token, user, transactions: [] }),
  logout: () => set({ user: null, token: null, transactions: [], people: [], statementImageUri: null }),
  toggleTheme: () => set((state) => ({ themeMode: state.themeMode === 'dark' ? 'light' : 'dark' })),
  setTransactions: (transactions) => set({ transactions }),
  setPeople: (people) =>
    set({
      people: Array.from(
        people
          .map((person) => person.trim())
          .filter(Boolean)
          .reduce((acc, person) => {
            const key = person.toLowerCase();
            if (!acc.has(key)) acc.set(key, person);
            return acc;
          }, new Map<string, string>())
          .values()
      ).sort((a, b) => a.localeCompare(b))
    }),
  addPerson: (person) =>
    set((state) => {
      const normalized = person.trim();
      if (!normalized || state.people.some((item) => item.toLowerCase() === normalized.toLowerCase())) return state;
      return { people: [...state.people, normalized].sort((a, b) => a.localeCompare(b)) };
    }),
  removePerson: (person) =>
    set((state) => ({
      people: state.people.filter((item) => item.toLowerCase() !== person.trim().toLowerCase())
    })),
  addTransaction: (transaction) =>
    set((state) => ({
      transactions: [transaction, ...state.transactions]
    })),
  addTransactions: (transactions) =>
    set((state) => ({
      transactions: [...transactions, ...state.transactions]
    })),
  updateTransaction: (transaction) =>
    set((state) => ({
      transactions: state.transactions.map((item) => (item.id === transaction.id ? transaction : item))
    })),
  removeTransaction: (id) =>
    set((state) => ({
      transactions: state.transactions.filter((transaction) => transaction.id !== id)
    })),
  clearTransactions: () => set({ transactions: [] }),
  addCategory: (category) =>
    set((state) => {
      const normalized = category.trim();
      if (!normalized || state.categories.some((item) => item.toLowerCase() === normalized.toLowerCase())) {
        return state;
      }

      return { categories: [...state.categories, normalized] };
    }),
  setStatementImageUri: (uri) => set({ statementImageUri: uri }),
  getCategoryTotals: () => {
    const allCategories = Array.from(new Set([...get().categories, ...get().transactions.map((transaction) => transaction.category)]));
    const totals = get().transactions.reduce<Record<string, number>>((acc, transaction) => {
      acc[transaction.category] = acc[transaction.category] ?? 0;
      acc[transaction.category] += transaction.amount;
      return acc;
    }, Object.fromEntries(allCategories.map((category) => [category, 0])) as Record<string, number>);

    return allCategories
      .map((category) => ({
        category,
        total: totals[category],
        color: categoryColors[category] ?? categoryColors.Other
      }))
      .filter((item) => item.total > 0)
      .sort((a, b) => b.total - a.total);
  },
  getMonthlyTotal: () => get().transactions.reduce((sum, transaction) => sum + transaction.amount, 0)
}));
