import app, { connectDatabase } from '../../server/src/app';

export default async function handler(req: any, res: any) {
  if (req.url && !req.url.startsWith('/api')) {
    req.url = `/api/people${req.url.startsWith('/') ? '' : '/'}${req.url}`;
  }

  await connectDatabase();
  return app(req, res);
}
