import pg from 'pg';
import { attachDatabasePool } from '@vercel/functions';
import { ApiError } from './errors.js';

let pool;

function connectionPool() {
  if (!process.env.DATABASE_URL) throw new ApiError(503, 'Banco de dados não configurado.');
  if (!pool) {
    pg.types.setTypeParser(1082, (value) => value); // DATE stays as YYYY-MM-DD.
    pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      max: 4,
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 10000,
      application_name: 'saldolab-api',
    });
    attachDatabasePool(pool);
  }
  return pool;
}

export async function withDatabase(work, { readOnly = false } = {}) {
  const client = await connectionPool().connect();
  try {
    await client.query(readOnly ? 'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY' : 'BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // Preserve the original error while rolling back.
    }
    throw error;
  } finally {
    client.release();
  }
}
