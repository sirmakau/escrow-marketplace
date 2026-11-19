import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { defineConfig } from 'drizzle-kit';

const here = path.dirname(fileURLToPath(import.meta.url));
// Server credentials live in server/.env, independent of client env files.
dotenv.config({ path: path.join(here, '.env') });

export default defineConfig({
  schema: path.join(here, 'src/db/schema/index.ts'),
  out: path.join(here, 'src/db/migrations'),
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
