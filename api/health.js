import { jsonResponse } from './_lib/errors.js';

// A liveness check only: does not reveal database identifiers or test credentials.
export default {
  fetch() {
    return jsonResponse({ app: 'SaldoLab', status: 'ok' });
  },
};
