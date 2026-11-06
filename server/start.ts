import dotenv from 'dotenv';
dotenv.config();

import { createServer } from './index';
import { runMigrations } from './schema';
import { getDatabasePool } from './db';

const PORT = process.env.PORT || 3000;
const server = createServer();

server.listen(PORT, async () => {
  console.log(`[LinkFlow Backend] Server listening on port ${PORT}`);
  if (getDatabasePool()) {
    console.log('[LinkFlow Backend] Connected to PostgreSQL DATABASE_URL. Running migrations...');
    await runMigrations();
  } else {
    console.warn('[LinkFlow Backend] WARNING: DATABASE_URL is not set. Running with in-memory persistence. Data will be lost on restart. Configure DATABASE_URL for production use.');
  }
});

