import { peopleHandler } from '../../serverless/dataApi';

export default async function handler(req: any, res: any) {
  req.query = { ...req.query, path: [] };
  return peopleHandler(req, res);
}
