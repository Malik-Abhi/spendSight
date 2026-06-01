import app from '../../server/dist/app.js';

export default async function handler(req: any, res: any) {
  if (req.url && !req.url.startsWith('/api')) {
    req.url = `/api/transactions${req.url.startsWith('/') ? '' : '/'}${req.url}`;
  }

  return app(req, res);
}
