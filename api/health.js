import { jsonResponse } from './_lib/errors.js';

// A liveness check only: does not reveal database identifiers or test credentials.
export function GET() {
  return jsonResponse({ app: 'SaldoLab', status: 'ok' });
}
