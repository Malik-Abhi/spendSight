import app, { connectDatabase } from '../server/src/app';

export default async function handler(req: any, res: any) {
  if (req.url && !req.url.startsWith('/api')) {
    req.url = `/api${req.url.startsWith('/') ? '' : '/'}${req.url}`;
  }

  if (req.url !== '/api/health') {
    await connectDatabase();
  }

  return app(req, res);
}
