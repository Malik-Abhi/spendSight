import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

const PREFIX = 'enc:v1:';
const ENCRYPTED_FIELDS = ['title', 'amount', 'category', 'date', 'kind', 'source', 'person', 'note'] as const;

type TransactionField = (typeof ENCRYPTED_FIELDS)[number];
type TransactionPayload = Partial<Record<TransactionField, unknown>>;

function getEncryptionKey() {
  const secret = process.env.TRANSACTION_ENCRYPTION_KEY?.trim();
  if (!secret) {
    throw new Error('TRANSACTION_ENCRYPTION_KEY is required');
  }

  return createHash('sha256').update(secret).digest();
}

function isEncrypted(value: unknown) {
  return typeof value === 'string' && value.startsWith(PREFIX);
}

export function encryptValue(value: unknown) {
  if (value === undefined || value === null || value === '') return undefined;
  if (isEncrypted(value)) return value;

  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', getEncryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${PREFIX}${Buffer.concat([iv, tag, ciphertext]).toString('base64')}`;
}

export function decryptValue(value: unknown) {
  if (!isEncrypted(value)) return value;

  const payload = Buffer.from(String(value).slice(PREFIX.length), 'base64');
  const iv = payload.subarray(0, 12);
  const tag = payload.subarray(12, 28);
  const ciphertext = payload.subarray(28);
  const decipher = createDecipheriv('aes-256-gcm', getEncryptionKey(), iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');

  return JSON.parse(plaintext);
}

export function encryptTransactionFields<T extends TransactionPayload>(transaction: T) {
  const encrypted = { ...transaction };
  ENCRYPTED_FIELDS.forEach((field) => {
    if (field in encrypted) {
      encrypted[field] = encryptValue(encrypted[field]);
    }
  });
  return encrypted;
}

export function decryptTransactionFields<T extends TransactionPayload>(transaction: T) {
  const decrypted = { ...transaction };
  ENCRYPTED_FIELDS.forEach((field) => {
    if (field in decrypted) {
      decrypted[field] = decryptValue(decrypted[field]);
    }
  });
  return decrypted;
}

export function needsTransactionEncryption(transaction: TransactionPayload) {
  return ENCRYPTED_FIELDS.some((field) => {
    const value = transaction[field];
    return value !== undefined && value !== null && value !== '' && !isEncrypted(value);
  });
}
