import { createCipheriv, createHash, randomBytes } from 'node:crypto';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

dotenv.config();

const PREFIX = 'enc:v1:';
const ENCRYPTED_FIELDS = ['title', 'amount', 'category', 'date', 'kind', 'source', 'person', 'note'];

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function encryptionKey() {
  const secret = process.env.TRANSACTION_ENCRYPTION_KEY?.trim();
  if (!secret) throw new Error('TRANSACTION_ENCRYPTION_KEY is required');
  return createHash('sha256').update(secret).digest();
}

function isEncrypted(value) {
  return typeof value === 'string' && value.startsWith(PREFIX);
}

function encryptValue(value, key) {
  if (value === undefined || value === null || value === '') return undefined;
  if (isEncrypted(value)) return value;

  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${Buffer.concat([iv, tag, ciphertext]).toString('base64')}`;
}

function encryptedPatch(document, key) {
  return ENCRYPTED_FIELDS.reduce((patch, field) => {
    if (!(field in document)) return patch;
    const value = document[field];
    if (value === undefined || value === null || value === '' || isEncrypted(value)) return patch;
    patch[field] = encryptValue(value, key);
    return patch;
  }, {});
}

function plaintextFields(document) {
  return ENCRYPTED_FIELDS.filter((field) => {
    if (!(field in document)) return false;
    const value = document[field];
    return value !== undefined && value !== null && value !== '' && !isEncrypted(value);
  });
}

async function main() {
  const key = encryptionKey();
  const checkOnly = process.argv.includes('--check');
  const allDatabases = process.argv.includes('--all-dbs');
  const verbose = process.argv.includes('--verbose');
  await mongoose.connect(requiredEnv('MONGODB_URI'));

  const defaultDbName = mongoose.connection.db.databaseName;
  const databaseNames = allDatabases
    ? (await mongoose.connection.db.admin().listDatabases()).databases.map((database) => database.name)
    : [defaultDbName];
  let checked = 0;
  let encrypted = 0;
  let plaintext = 0;

  for (const dbName of databaseNames) {
    const db = mongoose.connection.useDb(dbName, { useCache: true });
    const collections = await db.db.listCollections().toArray();
    const hasTransactions = collections.some((collection) => collection.name === 'transactions');
    if (!hasTransactions) {
      if (allDatabases) console.log(`${dbName}: no transactions collection`);
      continue;
    }

    const collection = db.collection('transactions');
    const count = await collection.estimatedDocumentCount();
    console.log(`${dbName}.transactions: ${count} documents`);

    for await (const document of collection.find({})) {
      checked += 1;
      const fields = plaintextFields(document);
      if (verbose) {
        const encryptedFields = ENCRYPTED_FIELDS.filter((field) => isEncrypted(document[field]));
        console.log(
          `${dbName}.${document._id}: encrypted=[${encryptedFields.join(', ') || 'none'}] plaintext=[${fields.join(', ') || 'none'}]`
        );
      }
      if (fields.length) {
        plaintext += 1;
        console.log(`Plaintext transaction ${dbName}.${document._id}: ${fields.join(', ')}`);
      }
      if (checkOnly) continue;

      const patch = encryptedPatch(document, key);
      if (!Object.keys(patch).length) continue;

      await collection.updateOne({ _id: document._id }, { $set: patch });
      encrypted += 1;
    }
  }

  if (checked === 0) {
    const collections = await mongoose.connection.db.listCollections().toArray();
    const collectionCounts = await Promise.all(collections.map(async (item) => {
      const count = await mongoose.connection.collection(item.name).estimatedDocumentCount();
      return `${item.name}: ${count}`;
    }));
    console.log(`Connected database: ${defaultDbName}`);
    console.log(`Collections: ${collectionCounts.join(', ') || 'none'}`);
  }

  await mongoose.disconnect();
  console.log(`Connected database: ${defaultDbName}`);
  console.log(`Scanned databases: ${databaseNames.join(', ')}`);
  console.log(`Checked ${checked} transaction documents.`);
  console.log(`Plaintext ${plaintext} transaction documents.`);
  console.log(`Encrypted ${encrypted} transaction documents.`);
}

main().catch(async (error) => {
  await mongoose.disconnect().catch(() => {});
  console.error(error);
  process.exit(1);
});
