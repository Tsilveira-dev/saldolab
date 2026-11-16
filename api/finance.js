import { authenticatedUser, requireActiveSession } from './_lib/auth.js';
import { withDatabase } from './_lib/db.js';
import { ApiError, mapDatabaseError, jsonResponse } from './_lib/errors.js';
import { assertEntity, validateId } from './_lib/validation.js';
import { snapshot, listRecords, createRecord, updateRecord, removeRecord, importBackupRecords } from './_lib/finance.js';
import { readCloudBackup } from '../src/repositories/cloudBackup.js';

const allowed = ['GET', 'POST', 'PATCH', 'DELETE'];
const getParams = (request) => new URL(request.url).searchParams;

async function parseBody(request) {
  if (Number(request.headers.get('content-length')) > 65536)
    throw new ApiError(413, 'O registro ultrapassa o limite permitido.');
  if (!(request.headers.get('content-type') ?? '').toLowerCase().startsWith('application/json'))
    throw new ApiError(415, 'Envie os dados em JSON.');
  let body;
  try {
    const text = await request.text();
    if (text.length > 65536) throw new ApiError(413, 'O registro ultrapassa o limite permitido.');
    body = JSON.parse(text);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(400, 'JSON inválido.');
  }
  if (!body || typeof body !== 'object' || Array.isArray(body))
    throw new ApiError(422, 'Informe um objeto JSON.');
  return body;
}


async function parseImportBody(request) {
  const maxBytes = 2_000_000;
  const length = Number(request.headers.get('content-length'));
  if (Number.isFinite(length) && length > maxBytes)
    throw new ApiError(413, 'O backup ultrapassa o limite de 2 MB.');
  if (!(request.headers.get('content-type') ?? '').toLowerCase().startsWith('application/json'))
    throw new ApiError(415, 'Envie o backup em JSON.');
  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > maxBytes)
    throw new ApiError(413, 'O backup ultrapassa o limite de 20 MB.');
  let body;
  try { body = JSON.parse(raw); }
  catch { throw new ApiError(400, 'JSON inválido.'); }
  if (!body || typeof body.backup !== 'string')
    throw new ApiError(422, 'Arquivo de backup inválido.');
  try { return readCloudBackup(body.backup); }
  catch { throw new ApiError(422, 'Backup inválido ou incompatível. Confira o arquivo JSON do SaldoLab.'); }
}

async function handle(request) {
  if (!allowed.includes(request.method))
    return new Response(null, { status: 405, headers: { Allow: allowed.join(', ') } });

  try {
    const identity = await authenticatedUser(request);
    const { userId } = identity;
    const withUserDatabase = (work, options) =>
      withDatabase(async (client) => {
        await requireActiveSession(client, identity);
        return work(client);
      }, options);
    const params = getParams(request);
    const operation = params.get('operation');
    if (operation === 'import') {
      if (request.method !== 'POST') throw new ApiError(405, 'Método não permitido para importação.');
      const data = await parseImportBody(request);
      return jsonResponse(
        await withUserDatabase((client) => importBackupRecords(client, userId, data)),
        201,
      );
    }
    if (operation !== null) throw new ApiError(404, 'Operação não encontrada.');
    const entity = params.get('entity');
    if (!entity) {
      if (request.method !== 'GET') throw new ApiError(405, 'Operação não permitida.');
      return jsonResponse(
        await withUserDatabase((client) => snapshot(client, userId), { readOnly: true }),
      );
    }
    assertEntity(entity);
    const recordId = params.get('id');
    if (recordId !== null) validateId(recordId);

    if (request.method === 'GET') {
      return jsonResponse(
        await withUserDatabase(
          async (client) => {
            const all = await listRecords(client, entity, userId);
            if (!recordId) return all;
            const row = all.find((item) => item.id === recordId);
            if (!row) throw new ApiError(404, 'Registro não encontrado.');
            return row;
          },
          { readOnly: true },
        ),
      );
    }
    if (request.method === 'POST') {
      if (recordId !== null) throw new ApiError(422, 'Não especifique ID no cadastro.');
      const body = await parseBody(request);
      return jsonResponse(
        await withUserDatabase((client) => createRecord(client, entity, userId, body)),
        201,
      );
    }
    if (!recordId) throw new ApiError(422, 'Informe o ID do registro.');
    if (request.method === 'PATCH') {
      const body = await parseBody(request);
      return jsonResponse(
        await withUserDatabase((client) => updateRecord(client, entity, userId, recordId, body)),
      );
    }
    // The delete body carries a required revision: callers cannot delete a stale row.
    const body = await parseBody(request);
    return jsonResponse(
      await withUserDatabase((client) =>
        removeRecord(client, entity, userId, recordId, body.expectedRevision),
      ),
    );
  } catch (error) {
    const mapped = mapDatabaseError(error);
    if (mapped.status === 500)
      console.error('SaldoLab API operation failed:', error?.code ?? error?.name);
    return jsonResponse({ error: mapped.message }, mapped.status);
  }
}

export default { fetch: handle };
