import { peopleHandler } from '../../serverless/dataApi';

export default async function handler(req: any, res: any) {
  return peopleHandler(req, res);
}
