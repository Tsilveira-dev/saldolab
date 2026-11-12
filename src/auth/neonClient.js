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
      !url.pathname.replace(/\\/$/, '').endsWith('/auth') ||
      url.username ||
      url.password
    ) {
      throw new Error('Formato da URL inválido.');
    }
    client = createAuthClient(url.href.replace(/\\/$/, ''), {
      adapter: BetterAuthReactAdapter({ fetchOptions: { credentials: 'include' } }),
    });
  } catch {
    // Never print the configured value: it might contain credentials by mistake.
    configurationError =
      'Não foi possível iniciar o Neon Auth. Confira se VITE_NEON_AUTH_URL é a Base URL HTTPS da branch development e termina em /auth.';
  }
}

export const authClient = client;
export const authClientConfigurationError = configurationError;

export async function getAuthToken() {
  if (!authClient) throw new Error('A conexão com a nuvem não está configurada.');
  const result = await authClient.getSession();
  if (result.error || !result.data?.session?.token)
    throw new Error('Sua sessão expirou. Entre novamente para acessar a nuvem.');
  return result.data.session.token;
}
