import { statementsHandler } from '../../serverless/statementApi';

export const config = {
  api: {
    bodyParser: false
  }
};

export default statementsHandler;
