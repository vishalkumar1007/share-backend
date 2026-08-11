import connectDb from '../lib/db.js';
import { buildApp } from '../app.js';
import { seedAdminUser } from '../scripts/seedAdmin.js';

// Full Express app for Vercel. Local still uses index.js + server.listen.
const app = buildApp();

let bootPromise;
const ensureBoot = () => {
  if (!bootPromise) {
    bootPromise = connectDb()
      .then(() => seedAdminUser())
      .catch((error) => {
        console.error(`[db] failed to connect: ${error?.message}`);
      });
  }
  return bootPromise;
};

export default async function handler(req, res) {
  await ensureBoot();
  return app(req, res);
}
