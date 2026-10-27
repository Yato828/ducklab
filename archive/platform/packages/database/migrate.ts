import 'dotenv/config';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required; no temporary database will be substituted.');
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();
try {
  await client.query('SELECT pg_advisory_lock(8274519)');
  await client.query('CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
  const directory = fileURLToPath(new URL('./migrations', import.meta.url));
  for (const name of (await readdir(directory)).filter(x => x.endsWith('.sql')).sort()) {
    const exists = await client.query('SELECT name FROM schema_migrations WHERE name=$1', [name]);
    if (exists.rowCount) continue;
    await client.query('BEGIN');
    try {
      const sql=(await readFile(`${directory}/${name}`, 'utf8')).replace(/^BEGIN;\s*/,'').replace(/COMMIT;\s*$/,'');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations(name) VALUES($1)', [name]);
      await client.query('COMMIT');
    } catch(error) { await client.query('ROLLBACK'); throw error; }
    console.log(`Applied ${name}`);
  }
} finally { await client.query('SELECT pg_advisory_unlock(8274519)'); client.release(); await pool.end(); }
