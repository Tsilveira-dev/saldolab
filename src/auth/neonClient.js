import { createAuthClient } from '@neon/auth';
import { BetterAuthReactAdapter } from '@neon/auth/react/adapters';

export const authClient = import.meta.env.VITE_NEON_AUTH_URL
  ? createAuthClient(import.meta.env.VITE_NEON_AUTH_URL, {
      adapter: BetterAuthReactAdapter({ fetchOptions: { credentials: 'include' } }),
    })
  : null;

export async function getAuthToken() {
  if (!authClient) throw new Error('A conexão com a nuvem não está configurada.');
  const result = await authClient.getSession();
  if (result.error || !result.data?.session?.token)
    throw new Error('Sua sessão expirou. Entre novamente para acessar a nuvem.');
  return result.data.session.token;
}
