import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import pg from 'pg';
import { financialEntities, readCloudBackup } from '../src/repositories/cloudBackup.js';
import { createRecord } from '../api/_lib/finance.js';

pg.types.setTypeParser(1082, (value) => value);

export function inspectBackup(text) {
  const data = readCloudBackup(text);
  return {
    data,
    sha256: createHash('sha256').update(text).digest('hex'),
    counts: Object.fromEntries(financialEntities.map((entity) => [entity, data[entity].length])),
  };
}

export async function restoreBackup(pool, { text, branchId, userId }) {
  const plan = inspectBackup(text);
  if (['br-patient-forest-bcfzjc39', 'br-wandering-mouse-bc0u10oc'].includes(branchId))
    throw new Error('RESTORE_PROTECTED_BRANCH');
  if (!branchId || !/^[A-Za-z0-9-]{1,120}$/.test(userId ?? ''))
    throw new Error('RESTORE_TARGET_REQUIRED');
  const client = await pool.connect();
  try {
    const marker = await client.query('SELECT branch_id, purpose FROM saldolab_qa.environment');
    if (
      marker.rows.length !== 1 ||
      marker.rows[0].branch_id !== branchId ||
      marker.rows[0].purpose !== 'isolated restore rehearsal'
    )
      throw new Error('RESTORE_QA_MARKER_REQUIRED');
    await client.query('BEGIN');
    await client.query("SET LOCAL lock_timeout='5s'");
    // Freeze writes while checking emptiness and inserting; never overwrite data.
    await client.query(
      'LOCK TABLE public.accounts, public.categories, public.transactions, public.budgets IN SHARE ROW EXCLUSIVE MODE',
    );
    const identity = await client.query('SELECT id FROM neon_auth."user" WHERE id::text=$1', [
      userId,
    ]);
    if (identity.rowCount !== 1) throw new Error('RESTORE_IDENTITY_REQUIRED');
    for (const entity of financialEntities) {
      const existing = await client.query(
        'SELECT 1 FROM public.' + entity + ' WHERE user_id=$1 LIMIT 1',
        [userId],
      );
      if (existing.rows.length) throw new Error('RESTORE_TARGET_NOT_EMPTY');
    }
    const accountIds = new Map(),
      categoryIds = new Map();
    for (const { id, ...row } of plan.data.accounts)
      accountIds.set(id, (await createRecord(client, 'accounts', userId, row)).id);
    for (const { id, ...row } of plan.data.categories)
      categoryIds.set(id, (await createRecord(client, 'categories', userId, row)).id);
    for (const { id: _id, ...row } of plan.data.transactions)
      await createRecord(client, 'transactions', userId, {
        ...row,
        accountId: accountIds.get(row.accountId),
        destinationAccountId: row.destinationAccountId
          ? accountIds.get(row.destinationAccountId)
          : null,
        categoryId: row.categoryId ? categoryIds.get(row.categoryId) : null,
      });
    for (const { id: _id, ...row } of plan.data.budgets)
      await createRecord(client, 'budgets', userId, {
        ...row,
        categoryId: categoryIds.get(row.categoryId),
      });
    await client.query('COMMIT');
    return {
      status: 'restored',
      sha256: plan.sha256,
      counts: plan.counts,
      identitiesCopied: false,
      idsRemapped: true,
    };
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      /* Preserve the cause. */
    }
    throw error;
  } finally {
    client.release();
  }
}

async function main() {
  const args = process.argv.slice(2),
    apply = args.includes('--apply');
  const file = args.find((arg) => !arg.startsWith('--'));
  if (!file) throw new Error('BACKUP_FILE_REQUIRED');
  const text = await readFile(file, 'utf8'),
    plan = inspectBackup(text);
  if (!apply) {
    console.log(JSON.stringify({ status: 'dry-run', sha256: plan.sha256, counts: plan.counts }));
    return;
  }
  if (!process.env.SALDOLAB_RESTORE_DATABASE_URL) throw new Error('RESTORE_DATABASE_REQUIRED');
  const pool = new pg.Pool({ connectionString: process.env.SALDOLAB_RESTORE_DATABASE_URL });
  pool.on('error', () => console.error('RESTORE_CONNECTION_INTERRUPTED'));
  try {
    console.log(
      JSON.stringify(
        await restoreBackup(pool, {
          text,
          branchId: process.env.SALDOLAB_RESTORE_BRANCH_ID,
          userId: process.env.SALDOLAB_RESTORE_USER_ID,
        }),
      ),
    );
  } finally {
    await pool.end();
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  main().catch((error) => {
    const code = /^(BACKUP_|RESTORE_)[A-Z_]+$/.test(error.message)
      ? error.message
      : 'RESTORE_FAILED';
    console.error(code);
    process.exitCode = 1;
  });
