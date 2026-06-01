import authHandler from '../../serverless/authApi';

export default async function handler(req: any, res: any) {
  return authHandler(req, res);
}
