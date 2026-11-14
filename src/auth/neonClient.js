import { createAuthClient } from '@neon/auth';
import { BetterAuthReactAdapter } from '@neon/auth/react/adapters';

const baseURL = import.meta.env.VITE_NEON_AUTH_URL;
let client = null;
let configurationError = null;

if (baseURL) {
  try {
    const url = new URL(baseURL.trim());
    if (
      url.protocol !== 'https:' ||
      !url.pathname.replace(/\/$/, '').endsWith('/auth') ||
      url.username ||
      url.password
    ) {
      throw new Error('Formato da URL inválido.');
    }
    client = createAuthClient(url.href.replace(/\/$/, ''), {
      adapter: BetterAuthReactAdapter({ fetchOptions: { credentials: 'include' } }),
    });
  } catch {
    // Never print the configured value: it might contain credentials by mistake.
    configurationError =
      'Não foi possível conectar sua conta agora. Tente novamente mais tarde ou continue usando os dados deste aparelho.';
  }
}

export const authClient = client;
export const authClientConfigurationError = configurationError;

export class CloudSessionError extends Error {
  constructor(message, status = 401) {
    super(message);
    this.name = 'CloudSessionError';
    this.status = status;
  }
}

export async function getAuthSession({ expectedUserId } = {}) {
  if (!authClient) throw new CloudSessionError('A conexão com a nuvem não está configurada.', 503);
  return getAuthSessionFromClient(authClient, { expectedUserId });
}

// The Better Auth session token is NOT the signed JWT expected by /api/finance.
// Get a short-lived JWT from the managed Auth SDK and keep the separate opaque
// session ID for server-side revocation checks.
export async function getAuthSessionFromClient(client, { expectedUserId } = {}) {
  const result = await client.getSession();
  if (result.error || !result.data?.session?.id || !result.data?.user?.id)
    throw new CloudSessionError(
      'Sua sessão expirou. Entre novamente para acessar a nuvem.',
      result.error?.status >= 500 ? 503 : 401,
    );
  if (expectedUserId !== undefined && result.data.user.id !== expectedUserId)
    throw new CloudSessionError('A conta conectada mudou. Reabra seus dados na nuvem.');

  let jwt;
  try {
    jwt = await client.token();
  } catch {
    throw new CloudSessionError('Não foi possível verificar sua sessão. Tente novamente.', 503);
  }
  if (jwt?.error || typeof jwt?.data?.token !== 'string' || !jwt.data.token)
    throw new CloudSessionError(
      'Não foi possível validar sua sessão. Entre novamente.',
      jwt?.error?.status >= 500 ? 503 : 401,
    );
  return { token: jwt.data.token, sessionId: result.data.session.id };
}

export async function getAuthToken(options) {
  return (await getAuthSession(options)).token;
}
