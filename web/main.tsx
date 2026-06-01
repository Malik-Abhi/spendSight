import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  BarChart3,
  Check,
  ChevronRight,
  CircleDollarSign,
  Edit3,
  FileText,
  LogOut,
  Moon,
  Plus,
  ReceiptText,
  Settings,
  Sparkles,
  Trash2,
  UploadCloud,
  Users,
  X
} from 'lucide-react';
import { AuthSession, ParsedStatementTransaction, Transaction, User } from '../src/types/expense';
import { categoryColors } from '../src/theme/palette';
import spendsightLogoUrl from '../assets/spendsight-logo.png';
import spendsightMarkUrl from '../assets/spendsight-mark.png';
import './styles.css';

type TabKey = 'dashboard' | 'transactions' | 'statement' | 'settings';
type SummaryKind = 'expense' | 'income';
type ReviewTransaction = ParsedStatementTransaction & { reviewId: string };

const API_URL = import.meta.env.VITE_API_URL ?? (import.meta.env.PROD ? '/api' : 'http://localhost:4000/api');
const SESSION_KEY = 'spendsight-web-session';
const baseCategories = ['Food', 'Travel', 'Bills', 'Shopping', 'Health', 'Entertainment', 'Education', 'Savings', 'Lending', 'Other'];

function SpendSightMark({ size = 74 }: { size?: number }) {
  return <img src={spendsightMarkUrl} alt="SpendSight logo" className="spendsight-mark" style={{ width: size, height: size }} />;
}

function SpendSightLogo() {
  return <img src={spendsightLogoUrl} alt="SpendSight" className="spendsight-logo" />;
}

async function apiFetch(path: string, init?: RequestInit) {
  const response = await fetch(`${API_URL}${path}`, init);
  if (!response.ok) {
    let message = 'Request failed';
    try {
      message = ((await response.json()) as { message?: string }).message || message;
    } catch {
      // ignore
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

async function login(email: string, password: string) {
  const response = await apiFetch('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  return (await response.json()) as AuthSession;
}

async function signup(name: string, email: string, password: string) {
  const response = await apiFetch('/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password })
  });
  return (await response.json()) as AuthSession;
}

async function fetchTransactions(token: string) {
  const response = await apiFetch('/transactions', { headers: authHeaders(token, false) });
  const payload = (await response.json()) as { transactions: Array<Transaction & { _id?: string }> };
  return payload.transactions.map(normalizeTransaction);
}

async function fetchPeople(token: string) {
  const response = await apiFetch('/people', { headers: authHeaders(token, false) });
  return ((await response.json()) as { people: string[] }).people;
}

async function createTransaction(token: string, transaction: Omit<Transaction, 'id' | 'source'>) {
  const response = await apiFetch('/transactions', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(transaction)
  });
  return normalizeTransaction(((await response.json()) as { transaction: Transaction & { _id?: string } }).transaction);
}

async function updateTransaction(token: string, id: string, transaction: Omit<Transaction, 'id' | 'source'>) {
  const response = await apiFetch(`/transactions/${id}`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify(transaction)
  });
  return normalizeTransaction(((await response.json()) as { transaction: Transaction & { _id?: string } }).transaction);
}

async function importTransactions(token: string, transactions: Omit<Transaction, 'id'>[]) {
  const response = await apiFetch('/transactions/import', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ transactions })
  });
  const payload = (await response.json()) as { transactions: Array<Transaction & { _id?: string }> };
  return payload.transactions.map(normalizeTransaction);
}

async function uploadStatement(token: string, file: File, categories: string[], history: Transaction[]) {
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

async function addPersonApi(token: string, name: string) {
  const response = await apiFetch('/people', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ name })
  });
  return ((await response.json()) as { people: string[] }).people;
}

async function deletePersonApi(token: string, name: string) {
  const response = await apiFetch(`/people/${encodeURIComponent(name)}`, {
    method: 'DELETE',
    headers: authHeaders(token, false)
  });
  const payload = (await response.json()) as { people: string[]; transactions?: Array<Transaction & { _id?: string }> };
  return { people: payload.people, transactions: (payload.transactions ?? []).map(normalizeTransaction) };
}

async function deleteTransactionApi(token: string, id: string) {
  await apiFetch(`/transactions/${id}`, { method: 'DELETE', headers: authHeaders(token, false) });
}

async function deleteAllApi(token: string) {
  await apiFetch('/transactions', { method: 'DELETE', headers: authHeaders(token, false) });
}

function monthKey(date: string) {
  return date.slice(0, 7);
}

function monthLabel(key: string) {
  const [year, month] = key.split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
}

function currency(value: number) {
  return `₹${value.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

function buildCategoryTotals(transactions: Transaction[], categories: string[]) {
  const allCategories = Array.from(new Set([...categories, ...transactions.map((item) => item.category)])).filter(Boolean);
  return allCategories
    .map((category) => ({
      category,
      total: transactions.filter((item) => item.category === category).reduce((sum, item) => sum + item.amount, 0),
      color: categoryColors[category] ?? categoryColors.Other
    }))
    .filter((item) => item.total > 0)
    .sort((a, b) => b.total - a.total);
}

function counterpartyKey(title: string) {
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

function Donut({ data, total, label }: { data: Array<{ category: string; total: number; color: string }>; total: number; label: string }) {
  let offset = 25;
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  return (
    <div className="donut-wrap">
      <svg viewBox="0 0 100 100" className="donut">
        <circle cx="50" cy="50" r={radius} className="donut-track" />
        {data.map((item) => {
          const dash = total > 0 ? (item.total / total) * circumference : 0;
          const segment = (
            <circle
              key={item.category}
              cx="50"
              cy="50"
              r={radius}
              className="donut-segment"
              stroke={item.color}
              strokeDasharray={`${dash} ${circumference - dash}`}
              strokeDashoffset={-offset}
            />
          );
          offset += dash;
          return segment;
        })}
      </svg>
      <div className="donut-center">
        <strong>{currency(total)}</strong>
        <span>{label}</span>
      </div>
    </div>
  );
}

function App() {
  const [token, setToken] = useState('');
  const [user, setUser] = useState<User | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [people, setPeople] = useState<string[]>([]);
  const [categories, setCategories] = useState(baseCategories);
  const [tab, setTab] = useState<TabKey>('dashboard');
  const [booting, setBooting] = useState(true);

  const loadAccount = async (session: AuthSession) => {
    const [loadedTransactions, loadedPeople] = await Promise.all([fetchTransactions(session.token), fetchPeople(session.token)]);
    setToken(session.token);
    setUser(session.user);
    setTransactions(loadedTransactions);
    setPeople(loadedPeople);
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  };

  useEffect(() => {
    const restore = async () => {
      try {
        const stored = localStorage.getItem(SESSION_KEY);
        if (stored) await loadAccount(JSON.parse(stored) as AuthSession);
      } catch {
        localStorage.removeItem(SESSION_KEY);
      } finally {
        setBooting(false);
      }
    };
    restore();
  }, []);

  const knownCategories = useMemo(
    () => Array.from(new Set([...categories, ...transactions.map((item) => item.category)])).filter((category) => category && category !== 'Trade'),
    [categories, transactions]
  );

  const logout = () => {
    localStorage.removeItem(SESSION_KEY);
    setToken('');
    setUser(null);
    setTransactions([]);
    setPeople([]);
  };

  if (booting) {
    return (
      <main className="app-shell boot">
        <div className="loader" />
      </main>
    );
  }

  if (!user || !token) {
    return <AuthScreen onSession={loadAccount} />;
  }

  return (
    <main className="app-shell">
      <div className="ambient one" />
      <div className="ambient two" />
      <section className="phone-frame">
        {tab === 'dashboard' && (
          <Dashboard
            user={user}
            transactions={transactions}
            categories={knownCategories}
            token={token}
            onUpdate={(transaction) => setTransactions((items) => items.map((item) => (item.id === transaction.id ? transaction : item)))}
          />
        )}
        {tab === 'transactions' && (
          <TransactionsScreen
            token={token}
            transactions={transactions}
            categories={knownCategories}
            onCreate={(transaction) => setTransactions((items) => [transaction, ...items])}
          />
        )}
        {tab === 'statement' && (
          <StatementScreen
            token={token}
            transactions={transactions}
            categories={knownCategories}
            people={people}
            onCategories={setCategories}
            onImport={(created) => setTransactions((items) => [...created, ...items])}
          />
        )}
        {tab === 'settings' && (
          <SettingsScreen
            user={user}
            token={token}
            people={people}
            transactions={transactions}
            onPeople={setPeople}
            onTransactions={setTransactions}
            onLogout={logout}
          />
        )}
        <nav className="bottom-nav">
          {[
            ['dashboard', SpendSightMark],
            ['transactions', ReceiptText],
            ['statement', Sparkles],
            ['settings', Settings]
          ].map(([key, Icon]) => (
            <button key={key as string} className={tab === key ? 'active' : ''} onClick={() => setTab(key as TabKey)} aria-label={key as string}>
              {React.createElement(Icon as React.ComponentType<{ size?: number }>, { size: 23 })}
            </button>
          ))}
        </nav>
      </section>
    </main>
  );
}

function AuthScreen({ onSession }: { onSession: (session: AuthSession) => Promise<void> }) {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setLoading(true);
    setError('');
    try {
      const session = mode === 'signup' ? await signup(name, email, password) : await login(email, password);
      await onSession(session);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not continue');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="app-shell auth-layout">
      <section className="auth-hero">
        <SpendSightLogo />
        <p className="kicker">Personal finance clarity</p>
        <p>Track expenses, scan statements, manage trades, and understand your money with a richer desktop experience.</p>
      </section>
      <section className="auth-card glass-card">
        <h2>Welcome</h2>
        <p>Sign in to sync your personal spending data.</p>
        {error ? <div className="error">{error}</div> : null}
        <div className="segmented">
          <button className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')}>Sign in</button>
          <button className={mode === 'signup' ? 'active' : ''} onClick={() => setMode('signup')}>Create</button>
        </div>
        {mode === 'signup' ? <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Name" /> : null}
        <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email" type="email" />
        <input value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Password" type="password" />
        <button className="primary-action" onClick={submit} disabled={loading}>
          {loading ? 'Please wait' : mode === 'login' ? 'Sign in' : 'Create account'} <ChevronRight size={18} />
        </button>
      </section>
    </main>
  );
}

function Dashboard({
  user,
  transactions,
  categories,
  token,
  onUpdate
}: {
  user: User;
  transactions: Transaction[];
  categories: string[];
  token: string;
  onUpdate: (transaction: Transaction) => void;
}) {
  const currentMonth = new Date().toISOString().slice(0, 7);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [kind, setKind] = useState<SummaryKind>('expense');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const monthOptions = Array.from(new Set([currentMonth, ...transactions.map((item) => monthKey(item.date))])).sort((a, b) => b.localeCompare(a));
  const monthTransactions = transactions.filter((item) => monthKey(item.date) === selectedMonth);
  const chartTransactions = monthTransactions.filter((item) => item.kind === kind);
  const totals = buildCategoryTotals(chartTransactions, categories);
  const total = chartTransactions.reduce((sum, item) => sum + item.amount, 0);
  const income = monthTransactions.filter((item) => item.kind === 'income').reduce((sum, item) => sum + item.amount, 0);
  const expense = monthTransactions.filter((item) => item.kind === 'expense').reduce((sum, item) => sum + item.amount, 0);
  const selectedRows = chartTransactions.filter((item) => item.category === selectedCategory);

  return (
    <div className="screen fade-in">
      <header className="page-header">
        <div>
          <p className="kicker">Monthly overview</p>
          <h1>Hi {user.name.split(' ')[0]}</h1>
          <p>Your spending summary updates as you add expenses.</p>
        </div>
        <div className="floating-icon logo-icon"><SpendSightMark size={66} /></div>
      </header>
      <div className="chip-row">{monthOptions.map((month) => <button key={month} className={month === selectedMonth ? 'chip active' : 'chip'} onClick={() => setSelectedMonth(month)}>{monthLabel(month)}</button>)}</div>
      <section className="summary-card glass-card">
        <div className="metric-switch">
          <button className={kind === 'expense' ? 'active' : ''} onClick={() => setKind('expense')}>Expenditure<span>{currency(expense)}</span></button>
          <button className={kind === 'income' ? 'active' : ''} onClick={() => setKind('income')}>Income<span>{currency(income)}</span></button>
        </div>
        <div className="summary-top">
          <div>
            <span>{kind === 'expense' ? 'Total expenditure' : 'Total income'}</span>
            <strong>{currency(total)}</strong>
          </div>
          <div className="live-pill"><BarChart3 size={16} /> Live</div>
        </div>
        <Donut data={totals} total={total} label="This month" />
        <div className="stat-grid">
          <div><span>Transactions</span><strong>{chartTransactions.length}</strong></div>
          <div><span>Top category</span><strong>{totals[0]?.category ?? 'None'}</strong></div>
        </div>
      </section>
      <SectionTitle title={kind === 'expense' ? 'Expenditure breakdown' : 'Income breakdown'} meta={`${totals.length} categories`} />
      <div className="category-list">
        {totals.map((item) => (
          <button key={item.category} className="category-row" onClick={() => setSelectedCategory(item.category)}>
            <i style={{ background: item.color }} />
            <div><strong>{item.category}</strong><span><b style={{ width: `${total ? (item.total / total) * 100 : 0}%`, background: item.color }} /></span></div>
            <em>{currency(item.total)}</em>
            <ChevronRight size={18} />
          </button>
        ))}
      </div>
      {selectedCategory ? (
        <Modal title={selectedCategory} subtitle={`${currency(totals.find((item) => item.category === selectedCategory)?.total ?? 0)} across ${selectedRows.length} records`} onClose={() => setSelectedCategory(null)}>
          {selectedRows.map((item) => (
            <div key={item.id} className="detail-card">
              <div><strong>{item.title}</strong><span>{item.kind} {item.person ? `- ${item.person}` : ''} - {item.date}</span></div>
              <em>{currency(item.amount)}</em>
              <button className="ghost-button" onClick={() => setEditing(item)}><Edit3 size={16} /> Edit</button>
            </div>
          ))}
        </Modal>
      ) : null}
      {editing ? <EditModal token={token} transaction={editing} categories={categories} onClose={() => setEditing(null)} onSave={onUpdate} /> : null}
    </div>
  );
}

function TransactionsScreen({ token, transactions, categories, onCreate }: { token: string; transactions: Transaction[]; categories: string[]; onCreate: (transaction: Transaction) => void }) {
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [person, setPerson] = useState('');
  const [category, setCategory] = useState(categories[0] ?? 'Food');
  const [kind, setKind] = useState<SummaryKind>('expense');

  const submit = async () => {
    const parsed = Number(amount);
    if (!title || !parsed) return;
    const created = await createTransaction(token, {
      title,
      amount: parsed,
      person: person.trim() || undefined,
      category: person.trim() ? 'Trade' : category,
      kind,
      date: new Date().toISOString().slice(0, 10)
    });
    onCreate(created);
    setTitle('');
    setAmount('');
    setPerson('');
  };

  return (
    <div className="screen fade-in">
      <PageIntro kicker="Ledger" title="Transactions" copy="Add records manually or import them from a statement scan." />
      <section className="form-card glass-card">
        <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Transaction title" />
        <input value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="Amount" type="number" />
        <input value={person} onChange={(event) => setPerson(event.target.value)} placeholder="Person optional" />
        <div className="segmented"><button className={kind === 'expense' ? 'active' : ''} onClick={() => setKind('expense')}>Expense</button><button className={kind === 'income' ? 'active' : ''} onClick={() => setKind('income')}>Income</button></div>
        {!person.trim() ? <ChipPicker values={categories} value={category} onChange={setCategory} /> : <div className="info-line"><Users size={16} /> Person selected. Saved in trade book.</div>}
        <button className="primary-action" onClick={submit}><Plus size={18} /> Add record</button>
      </section>
      <SectionTitle title="Recent activity" meta={`${transactions.length} total`} />
      <div className="record-list">{transactions.map((item) => <RecordRow key={item.id} item={item} />)}</div>
    </div>
  );
}

function StatementScreen({
  token,
  transactions,
  categories,
  people,
  onCategories,
  onImport
}: {
  token: string;
  transactions: Transaction[];
  categories: string[];
  people: string[];
  onCategories: (categories: string[]) => void;
  onImport: (transactions: Transaction[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState('Upload a bank statement image or PDF and let Gemini suggest categories.');
  const [loading, setLoading] = useState(false);
  const [review, setReview] = useState<ReviewTransaction[]>([]);
  const [newCategory, setNewCategory] = useState('');

  const analyze = async () => {
    if (!file) return;
    setLoading(true);
    try {
      const parsed = await uploadStatement(token, file, categories, transactions);
      setReview(
        parsed
          .map((item, index) => ({
            ...item,
            reviewId: `${Date.now()}-${index}`,
            category: categories.includes(item.category) ? item.category : 'Other',
            needsCategoryReview: item.needsCategoryReview || !categories.includes(item.category) || item.category === 'Other'
          }))
          .sort((a, b) => Number(b.needsCategoryReview) - Number(a.needsCategoryReview))
      );
      setMessage(`${parsed.length} records found. Review before adding.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Analysis failed');
    } finally {
      setLoading(false);
    }
  };

  const updatePerson = (reviewId: string, person: string) => {
    setReview((items) => {
      const target = items.find((item) => item.reviewId === reviewId);
      if (!target) return items;
      const key = counterpartyKey(target.title);
      return items.map((item) =>
        counterpartyKey(item.title) === key ? { ...item, person, category: person.trim() ? 'Trade' : item.category || 'Other', needsCategoryReview: person.trim() ? false : item.needsCategoryReview } : item
      );
    });
  };

  const updateCategory = (reviewId: string, category: string) => {
    setReview((items) => {
      const target = items.find((item) => item.reviewId === reviewId);
      if (!target) return items;
      const key = counterpartyKey(target.title);
      return items.map((item) => (counterpartyKey(item.title) === key && !item.person ? { ...item, category, needsCategoryReview: false } : item));
    });
  };

  const save = async () => {
    const unresolved = review.some((item) => !item.person && (!item.category || item.needsCategoryReview));
    if (unresolved) {
      setMessage('Choose a category for every non-person record before adding.');
      return;
    }
    const cleaned = review.map(({ reviewId: _reviewId, categoryConfidence: _confidence, needsCategoryReview: _needsReview, ...item }) => ({
      ...item,
      title: item.title.trim(),
      amount: Number(item.amount),
      category: item.person?.trim() ? 'Trade' : item.category,
      person: item.person?.trim() || undefined,
      source: 'statement' as const
    }));
    const created = await importTransactions(token, cleaned);
    onImport(created);
    setReview([]);
    setMessage(`${created.length} records added.`);
  };

  return (
    <div className="screen fade-in">
      <PageIntro kicker="Smart import" title="Statement AI" copy={message} />
      <section className="upload-zone glass-card" onClick={() => inputRef.current?.click()}>
        <input ref={inputRef} type="file" accept="image/*,.pdf,application/pdf" hidden onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
        <FileText size={42} />
        <strong>{file ? file.name : 'Choose statement file'}</strong>
        <span>Images and PDFs are supported</span>
      </section>
      <div className="action-row"><button className="secondary-action" onClick={() => inputRef.current?.click()}><UploadCloud size={18} /> Choose</button><button className="primary-action" onClick={analyze} disabled={!file || loading}><Sparkles size={18} /> {loading ? 'Analyzing' : 'Analyze'}</button></div>
      {review.length ? (
        <Modal title={`${review.length} transactions`} subtitle="Review import" onClose={() => setReview([])}>
          <div className="category-add">
            <input value={newCategory} onChange={(event) => setNewCategory(event.target.value)} placeholder="New category name" />
            <button onClick={() => { if (newCategory.trim()) onCategories(Array.from(new Set([...categories, newCategory.trim()]))); setNewCategory(''); }}><Plus size={16} /> Add</button>
          </div>
          <div className="review-list">
            {review.map((item) => (
              <div key={item.reviewId} className="review-card">
                <input value={item.title} onChange={(event) => setReview((rows) => rows.map((row) => row.reviewId === item.reviewId ? { ...row, title: event.target.value } : row))} />
                {item.needsCategoryReview && !item.person ? <div className="warning">Choose a category, or add a person below</div> : null}
                <div className="two-col"><input value={item.amount} type="number" onChange={(event) => setReview((rows) => rows.map((row) => row.reviewId === item.reviewId ? { ...row, amount: Number(event.target.value) } : row))} /><input value={item.date} onChange={(event) => setReview((rows) => rows.map((row) => row.reviewId === item.reviewId ? { ...row, date: event.target.value } : row))} /></div>
                <input value={item.person ?? ''} onChange={(event) => updatePerson(item.reviewId, event.target.value)} placeholder="Person optional" />
                {people.length ? <ChipPicker values={people} value={item.person ?? ''} onChange={(person) => updatePerson(item.reviewId, person)} /> : null}
                <div className="segmented"><button className={item.kind === 'expense' ? 'active' : ''} onClick={() => setReview((rows) => rows.map((row) => row.reviewId === item.reviewId ? { ...row, kind: 'expense' } : row))}>Expense</button><button className={item.kind === 'income' ? 'active' : ''} onClick={() => setReview((rows) => rows.map((row) => row.reviewId === item.reviewId ? { ...row, kind: 'income' } : row))}>Income</button></div>
                {item.person ? <div className="info-line"><Users size={16} /> This record will go to the trade book.</div> : <ChipPicker values={categories} value={item.category} onChange={(category) => updateCategory(item.reviewId, category)} />}
              </div>
            ))}
          </div>
          <div className="modal-actions"><button className="secondary-action" onClick={() => setReview([])}>Cancel</button><button className="primary-action" onClick={save}>Add reviewed <Check size={18} /></button></div>
        </Modal>
      ) : null}
    </div>
  );
}

function SettingsScreen({
  user,
  token,
  people,
  transactions,
  onPeople,
  onTransactions,
  onLogout
}: {
  user: User;
  token: string;
  people: string[];
  transactions: Transaction[];
  onPeople: (people: string[]) => void;
  onTransactions: (transactions: Transaction[]) => void;
  onLogout: () => void;
}) {
  const [peopleOpen, setPeopleOpen] = useState(false);
  const [recordsOpen, setRecordsOpen] = useState(false);
  const [newPerson, setNewPerson] = useState('');
  const summaries = useMemo(() => {
    const merged = new Map<string, string>();
    [...people, ...transactions.map((item) => item.person).filter(Boolean) as string[]].forEach((name) => {
      const key = name.trim().toLowerCase();
      if (key && !merged.has(key)) merged.set(key, name.trim());
    });
    return Array.from(merged.entries()).map(([key, name]) => {
      const rows = transactions.filter((item) => item.person?.toLowerCase() === key);
      const given = rows.filter((item) => item.kind === 'expense').reduce((sum, item) => sum + item.amount, 0);
      const taken = rows.filter((item) => item.kind === 'income').reduce((sum, item) => sum + item.amount, 0);
      return { name, given, taken, net: taken - given, records: rows.length };
    });
  }, [people, transactions]);

  return (
    <div className="screen fade-in">
      <PageIntro kicker="Account" title="Settings" copy="Manage your profile, records, people, and trade balances." />
      <section className="profile-card glass-card"><div className="floating-icon logo-icon"><SpendSightMark size={60} /></div><div><strong>{user.name}</strong><span>{user.email}</span></div></section>
      <button className="settings-row" onClick={() => setPeopleOpen(true)}><Users /> People & trades <span>{summaries.length} people</span><ChevronRight /></button>
      <button className="settings-row" onClick={() => setRecordsOpen(true)}><Trash2 /> Manage records <span>{transactions.length} saved</span><ChevronRight /></button>
      <button className="settings-row danger" onClick={onLogout}><LogOut /> Logout</button>
      {peopleOpen ? (
        <Modal title="People" subtitle="Trade book" onClose={() => setPeopleOpen(false)}>
          <div className="category-add"><input value={newPerson} onChange={(event) => setNewPerson(event.target.value)} placeholder="Add person name" /><button onClick={async () => { if (!newPerson.trim()) return; onPeople(await addPersonApi(token, newPerson)); setNewPerson(''); }}><Plus size={16} /> Add</button></div>
          {summaries.map((person) => (
            <div key={person.name} className="person-card">
              <div><strong>{person.name}</strong><span>{person.records} records - Net {person.net >= 0 ? 'taken' : 'given'} {currency(Math.abs(person.net))}</span></div>
              <div className="person-totals"><span>Given <b>{currency(person.given)}</b></span><span>Taken <b>{currency(person.taken)}</b></span></div>
              <button className="ghost-danger" onClick={async () => { const result = await deletePersonApi(token, person.name); onPeople(result.people); onTransactions(result.transactions); }}><Trash2 size={16} /> Delete</button>
            </div>
          ))}
        </Modal>
      ) : null}
      {recordsOpen ? (
        <Modal title="Delete records" subtitle="Account data" onClose={() => setRecordsOpen(false)}>
          <button className="danger-action" onClick={async () => { await deleteAllApi(token); onTransactions([]); }}>Delete all records</button>
          {transactions.map((item) => <div key={item.id} className="detail-card"><div><strong>{item.title}</strong><span>{item.category} - {item.date}</span></div><em>{currency(item.amount)}</em><button className="ghost-danger" onClick={async () => { await deleteTransactionApi(token, item.id); onTransactions(transactions.filter((row) => row.id !== item.id)); }}><Trash2 size={16} /></button></div>)}
        </Modal>
      ) : null}
    </div>
  );
}

function EditModal({ token, transaction, categories, onClose, onSave }: { token: string; transaction: Transaction; categories: string[]; onClose: () => void; onSave: (transaction: Transaction) => void }) {
  const [draft, setDraft] = useState({
    title: transaction.title,
    amount: String(transaction.amount),
    date: transaction.date,
    category: transaction.category === 'Trade' ? categories[0] ?? 'Other' : transaction.category,
    person: transaction.person ?? '',
    kind: transaction.kind
  });
  const save = async () => {
    const updated = await updateTransaction(token, transaction.id, {
      title: draft.title,
      amount: Number(draft.amount),
      date: draft.date,
      category: draft.person ? 'Trade' : draft.category,
      person: draft.person || undefined,
      kind: draft.kind
    });
    onSave(updated);
    onClose();
  };
  return (
    <Modal title="Transaction details" subtitle="Edit record" onClose={onClose}>
      <div className="form-card flat">
        <input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} />
        <div className="two-col"><input type="number" value={draft.amount} onChange={(event) => setDraft({ ...draft, amount: event.target.value })} /><input value={draft.date} onChange={(event) => setDraft({ ...draft, date: event.target.value })} /></div>
        <input value={draft.person} placeholder="Person optional" onChange={(event) => setDraft({ ...draft, person: event.target.value })} />
        <div className="segmented"><button className={draft.kind === 'expense' ? 'active' : ''} onClick={() => setDraft({ ...draft, kind: 'expense' })}>Expense</button><button className={draft.kind === 'income' ? 'active' : ''} onClick={() => setDraft({ ...draft, kind: 'income' })}>Income</button></div>
        {!draft.person ? <ChipPicker values={categories} value={draft.category} onChange={(category) => setDraft({ ...draft, category })} /> : <div className="info-line"><Users size={16} /> Person selected. Saved in trade book.</div>}
        <button className="primary-action" onClick={save}>Save changes <Check size={18} /></button>
      </div>
    </Modal>
  );
}

function Modal({ title, subtitle, children, onClose }: { title: string; subtitle?: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="modal-backdrop">
      <section className="modal-panel">
        <header><div><p className="kicker">{subtitle}</p><h2>{title}</h2></div><button onClick={onClose}><X /></button></header>
        {children}
      </section>
    </div>
  );
}

function ChipPicker({ values, value, onChange }: { values: string[]; value: string; onChange: (value: string) => void }) {
  return <div className="chip-picker">{values.map((item) => <button key={item} className={value === item ? 'selected' : ''} onClick={() => onChange(item)}>{item}</button>)}</div>;
}

function PageIntro({ kicker, title, copy }: { kicker: string; title: string; copy: string }) {
  return <header className="page-header compact"><div><p className="kicker">{kicker}</p><h1>{title}</h1><p>{copy}</p></div></header>;
}

function SectionTitle({ title, meta }: { title: string; meta?: string }) {
  return <div className="section-title"><h2>{title}</h2>{meta ? <span>{meta}</span> : null}</div>;
}

function RecordRow({ item }: { item: Transaction }) {
  return (
    <div className="record-row">
      <div className="record-icon"><CircleDollarSign size={19} /></div>
      <div><strong>{item.title}</strong><span>{item.kind} - {item.category}{item.person ? ` - ${item.person}` : ''} - {item.date}</span></div>
      <em>{currency(item.amount)}</em>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
