import { AuthSession, ParsedStatementTransaction, Transaction } from '../types/expense';
import { Platform } from 'react-native';

const LOCAL_API_URL = 'http://localhost:4000/api';
const PRODUCTION_API_URL = 'https://spend-sights.vercel.app/api';

function normalizeApiUrl(url: string) {
  return url.replace(/\/+$/, '');
}

const configuredApiUrl = normalizeApiUrl(process.env.EXPO_PUBLIC_API_URL ?? (__DEV__ ? LOCAL_API_URL : PRODUCTION_API_URL));
const API_URL =
  __DEV__ && Platform.OS === 'android'
    ? configuredApiUrl
        .replace('http://localhost:', 'http://10.0.2.2:')
        .replace('http://127.0.0.1:', 'http://10.0.2.2:')
    : configuredApiUrl;
const DEBUG_API = process.env.EXPO_PUBLIC_DEBUG_API === 'true' || __DEV__;

async function apiFetch(path: string, init?: RequestInit) {
  const url = `${API_URL}${path}`;

  if (DEBUG_API) {
    console.log(`[API] ${init?.method ?? 'GET'} ${url}`);
  }

  try {
    const response = await fetch(url, init);
    if (DEBUG_API) {
      console.log(`[API] ${response.status} ${url}`);
    }
    return response;
  } catch (error) {
    console.log(`[API] Network error ${url}`, error);
    throw new Error(`Network request failed. Check that the API server is running and reachable at ${API_URL}.`);
  }
}

async function parseJsonError(response: Response, fallback: string) {
  try {
    const payload = (await response.json()) as { message?: string };
    return payload.message || fallback;
  } catch {
    return fallback;
  }
}

function normalizeTransaction(transaction: Transaction & { _id?: string }) {
  return {
    ...transaction,
    id: transaction.id || transaction._id || `${Date.now()}-${Math.random().toString(16).slice(2)}`
  };
}

export async function signupWithEmail(name: string, email: string, password: string): Promise<AuthSession> {
  const response = await apiFetch('/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password })
  });

  if (!response.ok) {
    throw new Error(await parseJsonError(response, 'Signup failed'));
  }

  return (await response.json()) as AuthSession;
}

export async function loginWithEmail(email: string, password: string): Promise<AuthSession> {
  const response = await apiFetch('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });

  if (!response.ok) {
    throw new Error(await parseJsonError(response, 'Login failed'));
  }

  return (await response.json()) as AuthSession;
}

export async function fetchTransactions(token: string): Promise<Transaction[]> {
  const response = await apiFetch('/transactions', {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!response.ok) {
    throw new Error(await parseJsonError(response, 'Could not load transactions'));
  }

  const payload = (await response.json()) as { transactions: Array<Transaction & { _id?: string }> };
  return payload.transactions.map(normalizeTransaction);
}

export async function fetchPeople(token: string): Promise<string[]> {
  const response = await apiFetch('/people', {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!response.ok) {
    throw new Error(await parseJsonError(response, 'Could not load people'));
  }

  const payload = (await response.json()) as { people: string[] };
  return payload.people;
}

export async function createPerson(token: string, name: string): Promise<string[]> {
  const response = await apiFetch('/people', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ name })
  });

  if (!response.ok) {
    throw new Error(await parseJsonError(response, 'Could not add person'));
  }

  const payload = (await response.json()) as { people: string[] };
  return payload.people;
}

export async function deletePerson(token: string, name: string): Promise<{ people: string[]; transactions: Transaction[] }> {
  const response = await apiFetch(`/people/${encodeURIComponent(name)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!response.ok) {
    throw new Error(await parseJsonError(response, 'Could not remove person'));
  }

  const payload = (await response.json()) as { people: string[]; transactions?: Array<Transaction & { _id?: string }> };
  return {
    people: payload.people,
    transactions: (payload.transactions ?? []).map(normalizeTransaction)
  };
}

export async function createTransaction(token: string, transaction: Omit<Transaction, 'id' | 'source'>): Promise<Transaction> {
  const response = await apiFetch('/transactions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(transaction)
  });

  if (!response.ok) {
    throw new Error(await parseJsonError(response, 'Could not save transaction'));
  }

  const payload = (await response.json()) as { transaction: Transaction & { _id?: string } };
  return normalizeTransaction(payload.transaction);
}

export async function updateTransaction(token: string, id: string, transaction: Omit<Transaction, 'id' | 'source'>): Promise<Transaction> {
  const response = await apiFetch(`/transactions/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(transaction)
  });

  if (!response.ok) {
    throw new Error(await parseJsonError(response, 'Could not update transaction'));
  }

  const payload = (await response.json()) as { transaction: Transaction & { _id?: string } };
  return normalizeTransaction(payload.transaction);
}

export async function importStatementTransactions(token: string, transactions: Omit<Transaction, 'id'>[]): Promise<Transaction[]> {
  const response = await apiFetch('/transactions/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ transactions })
  });

  if (!response.ok) {
    throw new Error(await parseJsonError(response, 'Could not import transactions'));
  }

  const payload = (await response.json()) as { transactions: Array<Transaction & { _id?: string }> };
  return payload.transactions.map(normalizeTransaction);
}

export async function deleteTransaction(token: string, id: string): Promise<void> {
  const response = await apiFetch(`/transactions/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!response.ok) {
    throw new Error(await parseJsonError(response, 'Could not delete transaction'));
  }
}

export async function deleteAllTransactions(token: string): Promise<void> {
  const response = await apiFetch('/transactions', {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!response.ok) {
    throw new Error(await parseJsonError(response, 'Could not delete transactions'));
  }
}

export async function uploadStatementFile(
  uri: string,
  options?: {
    mimeType?: string;
    name?: string;
    categories?: string[];
    titleCategoryHints?: Array<{ title: string; category: string }>;
  }
): Promise<ParsedStatementTransaction[]> {
  const form = new FormData();
  const mimeType = options?.mimeType || (uri.toLowerCase().includes('.pdf') ? 'application/pdf' : 'image/jpeg');
  const isPdf = mimeType === 'application/pdf';
  form.append('statement', {
    uri,
    name: options?.name || (isPdf ? 'statement.pdf' : 'statement.jpg'),
    type: mimeType
  } as unknown as Blob);
  form.append(
    'context',
    JSON.stringify({
      categories: options?.categories ?? [],
      titleCategoryHints: options?.titleCategoryHints ?? []
    })
  );

  const response = await apiFetch('/statements/analyze', {
    method: 'POST',
    body: form
  });

  if (!response.ok) {
    throw new Error(await parseJsonError(response, 'Statement analysis failed'));
  }

  const payload = (await response.json()) as { transactions: ParsedStatementTransaction[] };
  return payload.transactions;
}

export async function loginWithGoogle(accessToken: string): Promise<AuthSession> {
  const response = await apiFetch('/auth/google', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accessToken })
  });

  if (!response.ok) {
    throw new Error(await parseJsonError(response, 'Google login failed'));
  }

  return (await response.json()) as AuthSession;
}
