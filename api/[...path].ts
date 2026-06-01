import authHandler from '../serverless/authApi';
import { peopleHandler, transactionsHandler } from '../serverless/dataApi';

export default async function handler(req: any, res: any) {
  const path = Array.isArray(req.query?.path) ? req.query.path : String(req.query?.path || '').split('/').filter(Boolean);
  const [resource, ...rest] = path;

  req.query = { ...req.query, path: rest };

  if (resource === 'auth') {
    return authHandler(req, res);
  }

  if (resource === 'transactions') {
    return transactionsHandler(req, res);
  }

  if (resource === 'people') {
    return peopleHandler(req, res);
  }

  res.statusCode = 404;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify({ message: 'API route not found' }));
}
