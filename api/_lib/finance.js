import { ApiError } from './errors.js';
import {
  assertEntity, validateWrite, validateWholeRecord,
  validateId, validateRevision, serializeRow, newRecordId,
} from './validation.js';

// SQL table/column identifiers are selected exclusively from the server-side allowlist.
export async function listRecords(client, entity, userId) {
  assertEntity(entity);
  const { rows } = await client.query(
    'SELECT * FROM public.' + entity + ' WHERE user_id = $1 ORDER BY id',
    [userId],
  );
  return rows.map((row) => serializeRow(entity, row));
}

export async function snapshot(client, userId) {
  const [accounts, categories, transactions, budgets] = await Promise.all([
    listRecords(client, 'accounts', userId), listRecords(client, 'categories', userId),
    listRecords(client, 'transactions', userId), listRecords(client, 'budgets', userId),
  ]);
  return { version: 1, accounts, categories, transactions, budgets };
}

async function ensureReferenced(client, userId, entity, record) {
  if (entity === 'transactions') {
    const accounts = [record.accountId, record.destinationAccountId].filter(Boolean);
    const { rows } = await client.query(
      'SELECT id FROM public.accounts WHERE user_id = $1 AND id = ANY($2::varchar[])',
      [userId, accounts],
    );
    if (rows.length !== accounts.length)
      throw new ApiError(422, 'Selecione contas existentes do seu espaço.');
    if (record.type !== 'transfer') {
      const category = await client.query(
        'SELECT type FROM public.categories WHERE user_id = $1 AND id = $2',
        [userId, record.categoryId],
      );
      if (category.rows[0]?.type !== record.type)
        throw new ApiError(422, 'A categoria não corresponde ao tipo da transação.');
    }
  }
  if (entity === 'budgets') {
    const category = await client.query(
      'SELECT type FROM public.categories WHERE user_id = $1 AND id = $2',
      [userId, record.categoryId],
    );
    if (category.rows[0]?.type !== 'expense')
      throw new ApiError(422, 'Orçamentos exigem uma categoria de despesa.');
  }
  if (entity === 'categories') {
    // Changing the category type would break financial semantics of existing rows.
    const prior = await client.query(
      'SELECT type FROM public.categories WHERE id = $1 AND user_id = $2',
      [record.id, userId],
    );
    if (prior.rows.length && prior.rows[0].type !== record.type) {
      const used = await client.query(
        'SELECT EXISTS (SELECT 1 FROM public.transactions WHERE user_id=$1 AND category_id=$2) OR EXISTS (SELECT 1 FROM public.budgets WHERE user_id=$1 AND category_id=$2) AS used',
        [userId, record.id],
      );
      if (used.rows[0].used) throw new ApiError(409, 'Não é possível mudar o tipo de uma categoria em uso.');
    }
  }
}

export async function createRecord(client, entity, userId, body) {
  const spec = assertEntity(entity);
  validateWrite(entity, body, { create: true });
  const row = { id: newRecordId(), ...body };
  validateWholeRecord(entity, row);
  await ensureReferenced(client, userId, entity, row);
  const columns = ['id', 'user_id', ...Object.values(spec.fields)];
  const values = [row.id, userId, ...Object.keys(spec.fields).map((key) => row[key])];
  const placeholders = columns.map((_, index) => '$' + (index + 1)).join(', ');
  const { rows } = await client.query(
    'INSERT INTO public.' + entity + ' (' + columns.join(', ') + ') VALUES (' +
      placeholders + ') RETURNING *',
    values,
  );
  return serializeRow(entity, rows[0]);
}

export async function updateRecord(client, entity, userId, id, body) {
  const spec = assertEntity(entity);
  validateId(id);
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new ApiError(422, 'Dados inválidos.');
  const { expectedRevision, ...changes } = body;
  validateRevision(expectedRevision);
  validateWrite(entity, changes);
  const current = await client.query(
    'SELECT * FROM public.' + entity + ' WHERE user_id = $1 AND id = $2 FOR UPDATE',
    [userId, id],
  );
  if (!current.rows.length) throw new ApiError(404, 'Registro não encontrado.');
  if (Number(current.rows[0].revision) !== expectedRevision)
    throw new ApiError(409, 'Registro alterado em outra sessão. Recarregue os dados.');
  const merged = { ...serializeRow(entity, current.rows[0]), ...changes, id };
  validateWholeRecord(entity, merged);
  await ensureReferenced(client, userId, entity, merged);
  const fields = Object.keys(changes);
  const setSql = fields.map((key, index) => spec.fields[key] + ' = $' + (index + 3)).join(', ');
  const { rows } = await client.query(
    'UPDATE public.' + entity + ' SET ' + setSql + ', revision = revision + 1' +
    (entity === 'transactions' ? ', updated_at = now()' : '') +
    ' WHERE user_id = $1 AND id = $2 AND revision = $' + (fields.length + 3) +
    ' RETURNING *',
    [userId, id, ...fields.map((key) => changes[key]), expectedRevision],
  );
  if (!rows.length) throw new ApiError(409, 'Registro alterado em outra sessão.');
  return serializeRow(entity, rows[0]);
}

export async function removeRecord(client, entity, userId, id, expectedRevision) {
  assertEntity(entity);
  validateId(id);
  validateRevision(expectedRevision);
  const { rows } = await client.query(
    'DELETE FROM public.' + entity +
      ' WHERE user_id = $1 AND id = $2 AND revision = $3 RETURNING id',
    [userId, id, expectedRevision],
  );
  if (rows.length) return { deleted: true };
  const existing = await client.query(
    'SELECT 1 FROM public.' + entity + ' WHERE user_id = $1 AND id = $2',
    [userId, id],
  );
  throw existing.rows.length
    ? new ApiError(409, 'Registro alterado em outra sessão.')
    : new ApiError(404, 'Registro não encontrado.');
}
