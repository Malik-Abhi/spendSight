import { AuthSession, ParsedStatementTransaction, Transaction } from '../../../models/expense';

const API_URL = (import.meta.env.VITE_API_URL ?? '/api').replace(/\/+$/, '');

async function apiFetch(path: string, init?: RequestInit) {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, init);
  } catch {
    throw new Error('Could not reach the API. Check your dev proxy or Vercel deployment.');
  }

  if (!response.ok) {
    let message = 'Request failed';
    try {
      message = ((await response.json()) as { message?: string }).message || message;
    } catch {
      // keep the fallback message
    }
    throw new Error(message);
  }
  return response;
}

const authHeaders = (token: string, json = true) => ({
  ...(json ? { 'Content-Type': 'application/json' } : {}),
  Authorization: `Bearer ${token}`
});

function normalizeTransaction(transaction: Transaction & { _id?: string }) {
  return { ...transaction, id: transaction.id || transaction._id || crypto.randomUUID() };
}

export async function login(email: string, password: string) {
  const response = await apiFetch('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  return (await response.json()) as AuthSession;
}

export async function signup(name: string, email: string, password: string) {
  const response = await apiFetch('/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password })
  });
  return (await response.json()) as AuthSession;
}

export async function fetchTransactions(token: string) {
  const response = await apiFetch('/transactions', { headers: authHeaders(token, false) });
  const payload = (await response.json()) as { transactions: Array<Transaction & { _id?: string }> };
  return payload.transactions.map(normalizeTransaction);
}

export async function fetchPeople(token: string) {
  const response = await apiFetch('/people', { headers: authHeaders(token, false) });
  return ((await response.json()) as { people: string[] }).people;
}

export async function createTransaction(token: string, transaction: Omit<Transaction, 'id' | 'source'>) {
  const response = await apiFetch('/transactions', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(transaction)
  });
  return normalizeTransaction(((await response.json()) as { transaction: Transaction & { _id?: string } }).transaction);
}

export async function updateTransaction(token: string, id: string, transaction: Omit<Transaction, 'id' | 'source'>) {
  const response = await apiFetch(`/transactions/${id}`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify(transaction)
  });
  return normalizeTransaction(((await response.json()) as { transaction: Transaction & { _id?: string } }).transaction);
}

export async function importTransactions(token: string, transactions: Omit<Transaction, 'id'>[]) {
  const response = await apiFetch('/transactions/import', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ transactions })
  });
  const payload = (await response.json()) as { transactions: Array<Transaction & { _id?: string }> };
  return payload.transactions.map(normalizeTransaction);
}

export async function uploadStatement(token: string, file: File, categories: string[], history: Transaction[]) {
  const form = new FormData();
  form.append('statement', file);
  form.append(
    'context',
    JSON.stringify({
      categories,
      titleCategoryHints: history.slice(0, 80).map((transaction) => ({
        title: transaction.title,
        category: transaction.person ? 'Other' : transaction.category
      }))
    })
  );
  const response = await apiFetch('/statements/analyze', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form
  });
  return ((await response.json()) as { transactions: ParsedStatementTransaction[] }).transactions;
}

export async function addPersonApi(token: string, name: string) {
  const response = await apiFetch('/people', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ name })
  });
  return ((await response.json()) as { people: string[] }).people;
}

export async function deletePersonApi(token: string, name: string) {
  const response = await apiFetch(`/people/${encodeURIComponent(name)}`, {
    method: 'DELETE',
    headers: authHeaders(token, false)
  });
  const payload = (await response.json()) as { people: string[]; transactions?: Array<Transaction & { _id?: string }> };
  return { people: payload.people, transactions: (payload.transactions ?? []).map(normalizeTransaction) };
}

export async function deleteTransactionApi(token: string, id: string) {
  await apiFetch(`/transactions/${id}`, { method: 'DELETE', headers: authHeaders(token, false) });
}

export async function deleteAllApi(token: string) {
  await apiFetch('/transactions', { method: 'DELETE', headers: authHeaders(token, false) });
}
