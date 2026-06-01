import { statementsHandler } from '../../serverless/statementApi';

export const config = {
  api: {
    bodyParser: false
  }
};

export default async function handler(req: any, res: any) {
  return statementsHandler(req, res);
}
