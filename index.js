import http from 'http';
import { config } from 'dotenv';
import { env } from './config/env.js';
import connectDb from './lib/db.js';
import { buildApp } from './app.js';
import { ensureLocalUploadDir } from './lib/storage.js';
import { seedAdminUser } from './scripts/seedAdmin.js';

config();

const app = buildApp();
const server = http.createServer(app);
/* Chat uses REST + polling (Vercel-safe). Socket.IO is not attached. */

server.listen(env.PORT, async () => {
  console.log(`Server is running on PORT ${env.PORT}`);
  try {
    await ensureLocalUploadDir();
  } catch (error) {
    console.error('[storage] failed to ensure upload dir:', error?.message);
  }
});

connectDb()
  .then(() => seedAdminUser())
  .catch((error) => {
    console.error(`[db] failed to connect at boot: ${error?.message}`);
  });
