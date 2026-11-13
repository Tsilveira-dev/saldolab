import http from 'node:http';
import https from 'node:https';
import tls from 'node:tls';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import pg from 'pg';
import { generateKeyPair, exportJWK, SignJWT } from 'jose';

export async function assertIsolatedDatabase(pool, url) {
  const parsed = new URL(url);
  if (
    ['127.0.0.1', 'localhost', '[::1]'].includes(parsed.hostname) &&
    parsed.pathname === '/saldolab_integration' &&
    process.env.SALDOLAB_TEST_REAL_AUTH !== '1'
  )
    return;
  const marker = await pool.query('SELECT branch_id, auth_base_url FROM saldolab_qa.environment');
  if (
    !process.env.SALDOLAB_TEST_BRANCH_ID ||
    marker.rows.length !== 1 ||
    marker.rows[0].branch_id !== process.env.SALDOLAB_TEST_BRANCH_ID
  )
    throw new Error(
      'Integration tests require an explicitly marked isolated database. No data was changed.',
    );
  if (process.env.SALDOLAB_TEST_REAL_AUTH === '1') {
    const expected = marker.rows[0].auth_base_url;
    if (
      !expected ||
      process.env.NEON_AUTH_BASE_URL !== expected ||
      process.env.VITE_NEON_AUTH_URL !== expected ||
      process.env.NEON_AUTH_JWKS_URL !== expected + '/.well-known/jwks.json'
    )
      throw new Error(
        'QA database and all Auth URLs must match the isolated environment marker. No data was changed.',
      );
  }
}

export async function createIntegrationHarness() {
  const connection = process.env.SALDOLAB_TEST_DATABASE_URL;
  if (!connection)
    throw new Error(
      'Set SALDOLAB_TEST_DATABASE_URL to an isolated test database; DATABASE_URL is never used as a fallback.',
    );
  const target = new URL(connection);
  if (
    process.env.SALDOLAB_TEST_REAL_AUTH !== '1' &&
    (!['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname) ||
      target.pathname !== '/saldolab_integration')
  )
    throw new Error(
      'The synthetic issuer and Auth schema fixtures require the disposable local database.',
    );
  const pool = new pg.Pool({ connectionString: connection, connectionTimeoutMillis: 8000 });
  await assertIsolatedDatabase(pool, connection);
  await pool.query(
    await readFile(
      new URL('../../db/migrations/0001_initial_finance_schema.sql', import.meta.url),
      'utf8',
    ),
  );
  // Only the disposable local database gets a minimal Auth fixture schema.
  // Real Neon tests use the provider's existing session table, never replace it.
  if (process.env.SALDOLAB_TEST_REAL_AUTH !== '1')
    await pool.query(`
      CREATE SCHEMA IF NOT EXISTS neon_auth;
      CREATE TABLE IF NOT EXISTS neon_auth.session (
        id uuid PRIMARY KEY,
        "userId" text NOT NULL,
        "expiresAt" timestamptz NOT NULL
      )`);
  await pool.query(
    await readFile(
      new URL('../../db/migrations/0002_active_session_authorization.sql', import.meta.url),
      'utf8',
    ),
  );
  const resources = [];
  let signToken;
  let issuerAvailable = true;
  if (process.env.SALDOLAB_TEST_REAL_AUTH !== '1') {
    const directory = await mkdtemp(join(tmpdir(), 'saldolab-test-issuer-'));
    const keyFile = join(directory, 'tls.key');
    const certFile = join(directory, 'tls.crt');
    execFileSync(
      'openssl',
      [
        'req',
        '-x509',
        '-newkey',
        'rsa:2048',
        '-nodes',
        '-keyout',
        keyFile,
        '-out',
        certFile,
        '-subj',
        '/CN=localhost',
        '-addext',
        'subjectAltName=DNS:localhost,IP:127.0.0.1',
        '-days',
        '1',
      ],
      { stdio: 'ignore' },
    );
    const certificate = await readFile(certFile, 'utf8');
    const originalCAs = tls.getCACertificates('default');
    tls.setDefaultCACertificates([...originalCAs, certificate]);
    const { privateKey, publicKey } = await generateKeyPair('EdDSA');
    const jwk = { ...(await exportJWK(publicKey)), kid: randomUUID(), alg: 'EdDSA', use: 'sig' };
    const issuerServer = https.createServer(
      { key: await readFile(keyFile), cert: certificate },
      (_req, res) => {
        if (!issuerAvailable) {
          res.writeHead(503);
          res.end('{}');
          return;
        }
        res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
        res.end(JSON.stringify({ keys: [jwk] }));
      },
    );
    await new Promise((resolve) => issuerServer.listen(0, '127.0.0.1', resolve));
    const origin = `https://127.0.0.1:${issuerServer.address().port}`;
    process.env.NEON_AUTH_BASE_URL = origin + '/auth';
    process.env.NEON_AUTH_JWKS_URL = origin + '/auth/.well-known/jwks.json';
    signToken = async (sub, options = {}) => {
      const jwt = new SignJWT({ sub, ...options.claims })
        .setProtectedHeader({ alg: 'EdDSA', kid: jwk.kid })
        .setIssuer(options.issuer ?? origin)
        .setAudience(options.audience ?? origin)
        .setIssuedAt();
      if (!options.withoutExpiry) jwt.setExpirationTime(options.expiry ?? '15m');
      const token = await jwt.sign(privateKey);
      const sessionId = randomUUID();
      await pool.query(
        'INSERT INTO neon_auth.session(id, "userId", "expiresAt") VALUES($1,$2,now()+interval \'1 hour\')',
        [sessionId, sub],
      );
      // Managed JWTs can be identical across sessions issued in the same second.
      // Keep the independent opaque session credential with the JWT; no token map.
      return { token, sessionId };
    };
    resources.push(async () => {
      issuerServer.closeAllConnections();
      await new Promise((resolve) => issuerServer.close(resolve));
      tls.setDefaultCACertificates(originalCAs);
      await rm(directory, { recursive: true, force: true });
    });
  }
  process.env.DATABASE_URL = connection;
  const { default: finance } = await import('../../api/finance.js');
  const { default: health } = await import('../../api/health.js');
  const server = http.createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = Buffer.concat(chunks);
    const request = new Request(`http://127.0.0.1${req.url}`, {
      method: req.method,
      headers: req.headers,
      ...(body.length ? { body } : {}),
    });
    const response = await (req.url.startsWith('/api/health')
      ? health.fetch(request)
      : finance.fetch(request));
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  return {
    pool,
    origin,
    signToken,
    sessionIdFor: (credentials) => credentials?.sessionId,
    setIssuerAvailable: (value) => {
      issuerAvailable = value;
    },
    async request(
      credentials,
      method = 'GET',
      entity,
      id,
      body,
      { sessionId = credentials?.sessionId } = {},
    ) {
      const token = credentials?.token ?? credentials;
      const params = new URLSearchParams();
      if (entity) params.set('entity', entity);
      if (id) params.set('id', id);
      const response = await fetch(origin + '/api/finance?' + params, {
        method,
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(sessionId ? { 'X-SaldoLab-Session-Id': sessionId } : {}),
          ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      return { status: response.status, headers: response.headers, body: await response.json() };
    },
    async close() {
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
      const { closeDatabasePool } = await import('../../api/_lib/db.js');
      if (closeDatabasePool) await closeDatabasePool();
      await pool.end();
      for (const close of resources.reverse()) await close();
    },
  };
}
