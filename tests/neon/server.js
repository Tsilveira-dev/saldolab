import { createServer } from 'vite';
import { createIntegrationHarness } from '../integration/harness.js';

if (process.env.SALDOLAB_TEST_REAL_AUTH !== '1' || !process.env.VITE_NEON_AUTH_URL)
  throw new Error(
    'Opt in to real Neon tests with an isolated, marked QA database and QA Auth URL.',
  );
const api = await createIntegrationHarness();
const vite = await createServer({
  server: {
    host: '127.0.0.1',
    port: 5175,
    strictPort: true,
    proxy: { '/api': { target: api.origin } },
  },
});
await vite.listen();
const stop = async () => {
  await vite.close();
  await api.close();
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
