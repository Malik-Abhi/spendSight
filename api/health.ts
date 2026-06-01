import app from '../server/src/app';

export default function handler(req: any, res: any) {
  req.url = '/api/health';
  return app(req, res);
}
