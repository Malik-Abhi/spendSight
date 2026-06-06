import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import multer from 'multer';
import { applyCors, handleCors } from './cors';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });
const allowedMediaTypes = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf']);

const transactionSchema = {
  type: SchemaType.OBJECT,
  properties: {
    transactions: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          title: { type: SchemaType.STRING },
          amount: { type: SchemaType.NUMBER },
          category: { type: SchemaType.STRING },
          date: { type: SchemaType.STRING },
          kind: { type: SchemaType.STRING, enum: ['expense', 'income'] },
          categoryConfidence: { type: SchemaType.NUMBER },
          needsCategoryReview: { type: SchemaType.BOOLEAN }
        },
        required: ['title', 'amount', 'category', 'date', 'kind', 'categoryConfidence', 'needsCategoryReview']
      }
    }
  },
  required: ['transactions']
};

type StatementContext = {
  categories: string[];
  titleCategoryHints: Array<{ title: string; category: string }>;
};

function sendJson(res: any, status: number, payload: unknown) {
  res.statusCode = status;
  applyCors({}, res);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

function parseStatementContext(value: unknown): StatementContext {
  if (typeof value !== 'string') {
    return { categories: [], titleCategoryHints: [] };
  }

  try {
    const parsed = JSON.parse(value) as Partial<StatementContext>;
    return {
      categories: Array.isArray(parsed.categories) ? parsed.categories.map(String).filter(Boolean).slice(0, 40) : [],
      titleCategoryHints: Array.isArray(parsed.titleCategoryHints)
        ? parsed.titleCategoryHints
            .map((hint) => ({
              title: String(hint.title || '').trim(),
              category: String(hint.category || '').trim()
            }))
            .filter((hint) => hint.title && hint.category)
            .slice(0, 60)
        : []
    };
  } catch {
    return { categories: [], titleCategoryHints: [] };
  }
}

function normalizeTransactions(value: unknown) {
  const parsed = value as {
    transactions?: Array<{
      title?: unknown;
      amount?: unknown;
      category?: unknown;
      kind?: unknown;
      categoryConfidence?: unknown;
      needsCategoryReview?: unknown;
      date?: unknown;
    }>;
  };

  const inferKind = (transaction: { title?: unknown; kind?: unknown }) => {
    const rawKind = String(transaction.kind || '').trim().toLowerCase();
    if (rawKind === 'income' || rawKind === 'credit' || rawKind === 'cr') return 'income' as const;
    if (rawKind === 'expense' || rawKind === 'debit' || rawKind === 'dr') return 'expense' as const;

    const title = String(transaction.title || '').toLowerCase();
    if (/\b(deposit|credited|credit|cr|received|receipt|refund|salary|interest|dividend|reversal|cashback|inward)\b/.test(title)) {
      return 'income' as const;
    }

    return 'expense' as const;
  };

  return {
    transactions: Array.isArray(parsed.transactions)
      ? parsed.transactions
          .map((transaction) => ({
            title: String(transaction.title || '').trim(),
            amount: Number(transaction.amount) || 0,
            category: String(transaction.category || 'Other'),
            kind: inferKind(transaction),
            categoryConfidence:
              typeof transaction.categoryConfidence === 'number'
                ? Math.max(0, Math.min(1, transaction.categoryConfidence))
                : 0,
            needsCategoryReview:
              Boolean(transaction.needsCategoryReview) ||
              String(transaction.category || 'Other') === 'Other' ||
              (typeof transaction.categoryConfidence === 'number' ? transaction.categoryConfidence < 0.7 : true),
            date: String(transaction.date || new Date().toISOString().slice(0, 10)),
            source: 'statement' as const
          }))
          .filter((transaction) => transaction.title && transaction.amount > 0)
      : []
  };
}

function parseGeminiJson(text: string) {
  const cleaned = text.replace(/```json|```/g, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');

  if (start === -1 || end === -1 || end <= start) {
    throw new Error('Gemini did not return a complete JSON object.');
  }

  return JSON.parse(cleaned.slice(start, end + 1));
}

function runUpload(req: any, res: any) {
  return new Promise<void>((resolve, reject) => {
    upload.single('statement')(req, res, (error: unknown) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

function routeFromRequest(req: any) {
  const path = Array.isArray(req.query?.path) ? req.query.path.join('/') : String(req.query?.path || '');
  if (path) return path.replace(/^\/+/, '');

  const url = new URL(req.url || '/', 'https://spendsight.local');
  return url.pathname.replace(/^\/?api\/statements\/?/, '').replace(/^\/+/, '');
}

export async function statementsHandler(req: any, res: any) {
  try {
    if (handleCors(req, res)) return;

    const route = routeFromRequest(req);
    if (req.method !== 'POST' || route !== 'analyze') {
      sendJson(res, req.method === 'POST' ? 404 : 405, { message: req.method === 'POST' ? 'Statement route not found' : 'Method not allowed' });
      return;
    }

    await runUpload(req, res);

    if (!req.file) {
      sendJson(res, 400, { message: 'Statement image is required' });
      return;
    }

    const mimeType = allowedMediaTypes.has(req.file.mimetype) ? req.file.mimetype : 'image/jpeg';
    if (!allowedMediaTypes.has(mimeType)) {
      sendJson(res, 415, { message: `Unsupported statement image type: ${req.file.mimetype}` });
      return;
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      sendJson(res, 501, { message: 'GEMINI_API_KEY is not configured' });
      return;
    }

    const context = parseStatementContext(req.body.context);
    const categoryList = Array.from(
      new Set(['Food', 'Travel', 'Bills', 'Shopping', 'Health', 'Entertainment', 'Education', 'Savings', 'Lending', 'Trade', 'Other', ...context.categories])
    );

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: process.env.GEMINI_RECEIPT_MODEL || 'gemini-2.5-flash-lite',
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 8192,
        responseMimeType: 'application/json',
        responseSchema: transactionSchema
      }
    });

    const prompt = [
      'Extract bank statement or receipt transactions from this statement file for a personal expense tracker.',
      'Return visible transactions only. Do not invent unreadable rows.',
      'Use numbers only for amounts.',
      'Read the transaction table columns carefully before deciding kind.',
      'Classify kind as "income" when the amount is in a Deposit, Credit, Cr, Receipt, Received, Inward, Paid In, Salary, Interest, Dividend, Refund, Reversal, or Transfer In column.',
      'Classify kind as "expense" when the amount is in a Withdrawal, Debit, Dr, Payment, Paid Out, Spent, Purchase, Fee, Charge, ATM, UPI debit, or Transfer Out column.',
      'If a row has both debit and credit columns, use the non-empty amount column to decide kind.',
      'Do not classify every row as expense. Deposits and credits must be income even if the description contains UPI or transfer.',
      'Use YYYY-MM-DD dates. If a year is missing, infer the most likely current year from the statement context.',
      'Smartly recognize the best category from merchant names, transaction descriptions, and context.',
      `Use the best category from this category list when possible: ${categoryList.join(', ')}.`,
      'Use Lending for loans, money lent to someone, money borrowed from someone, repayments, or friend/family balances.',
      context.titleCategoryHints.length
        ? `Prefer these previous user patterns when the new row looks similar: ${JSON.stringify(context.titleCategoryHints)}.`
        : '',
      'Do not set a person or counterparty field. Person assignment is handled manually by the user in the app.',
      'If the category is unclear, use Other, set categoryConfidence below 0.7, and set needsCategoryReview true.',
      'If the category is clear, set categoryConfidence between 0.7 and 1 and needsCategoryReview false.'
    ].join(' ');

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: req.file.buffer.toString('base64'),
          mimeType
        }
      }
    ]);

    const parsed = normalizeTransactions(parseGeminiJson(result.response.text()));
    if (!parsed.transactions.length) {
      sendJson(res, 422, {
        message:
          mimeType === 'application/pdf'
            ? 'Gemini could not find transactions in this PDF. Try a statement PDF with selectable text, or upload a clear screenshot/image of the transaction table.'
            : 'Gemini could not find transactions in this image. Try a clearer crop of the transaction table.'
      });
      return;
    }

    sendJson(res, 200, parsed);
  } catch (error) {
    console.error('Statement function error:', error);
    sendJson(res, 502, { message: 'Gemini could not parse this statement file.' });
  }
}
