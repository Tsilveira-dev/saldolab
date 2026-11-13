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
      'Não foi possível iniciar o Neon Auth. Confira se VITE_NEON_AUTH_URL é a Base URL HTTPS do ambiente correto e termina em /auth.';
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
  const result = await authClient.getSession();
  if (result.error || !result.data?.session?.token || !result.data.session.id)
    throw new CloudSessionError(
      'Sua sessão expirou. Entre novamente para acessar a nuvem.',
      result.error?.status >= 500 ? 503 : 401,
    );
  if (expectedUserId !== undefined && result.data.user?.id !== expectedUserId)
    throw new CloudSessionError('A conta conectada mudou. Reabra seus dados na nuvem.');
  return { token: result.data.session.token, sessionId: result.data.session.id };
}

export async function getAuthToken(options) {
  return (await getAuthSession(options)).token;
}
