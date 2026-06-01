import { transactionsHandler } from '../../serverless/dataApi';

export default async function handler(req: any, res: any) {
  return transactionsHandler(req, res);
}
