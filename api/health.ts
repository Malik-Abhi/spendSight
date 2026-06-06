import { applyCors, handleCors } from '../serverless/cors';

export default async function handler(req: any, res: any) {
  if (handleCors(req, res)) return;

  applyCors(req, res);
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify({ ok: true }));
}
