import app, { connectDatabase } from './app.js';

const port = Number(process.env.PORT ?? 4000);
const host = process.env.HOST ?? '0.0.0.0';

async function start() {
  await connectDatabase();
  app.listen(port, host, () => {
    console.log(`SpendSight API listening on http://${host}:${port}`);
  });
}

start().catch((error) => {
  console.error(error);
  process.exit(1);
});
