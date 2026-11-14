import { describe, expect, it, vi } from 'vitest';
import { CloudSessionError, getAuthSessionFromClient } from '../auth/neonClient';

const userId = 'user-a';
const sessionId = '00000000-0000-4000-8000-000000000001';
const makeClient = () => ({
  getSession: vi.fn().mockResolvedValue({
    data: {
      user: { id: userId },
      session: { id: sessionId, token: 'opaque-session-token-not-a-jwt' },
    },
    error: null,
  }),
  token: vi.fn().mockResolvedValue({ data: { token: 'signed.jwt.value' }, error: null }),
});

describe('Contrato JWT e sessão do Neon Auth', () => {
  it('usa JWT assinado no bearer e ID opaco na verificação da sessão', async () => {
    const client = makeClient();
    expect(await getAuthSessionFromClient(client, { expectedUserId: userId })).toEqual({
      token: 'signed.jwt.value',
      sessionId,
    });
    expect(client.token).toHaveBeenCalledOnce();
  });

  it('impede token JWT de uma identidade diferente da conta esperada', async () => {
    const client = makeClient();
    await expect(
      getAuthSessionFromClient(client, { expectedUserId: 'user-b' }),
    ).rejects.toBeInstanceOf(CloudSessionError);
    expect(client.token).not.toHaveBeenCalled();
  });

  it('rejeita sessão expirada sem solicitar JWT', async () => {
    const client = makeClient();
    client.getSession.mockResolvedValue({ data: null, error: null });
    await expect(getAuthSessionFromClient(client)).rejects.toMatchObject({ status: 401 });
    expect(client.token).not.toHaveBeenCalled();
  });

  it('não usa token de sessão como substituto quando o JWT está ausente', async () => {
    const client = makeClient();
    client.token.mockResolvedValue({ data: null, error: { status: 401 } });
    await expect(getAuthSessionFromClient(client)).rejects.toMatchObject({ status: 401 });
  });

  it('trata indisponibilidade do emissor de JWT como falha temporária', async () => {
    const client = makeClient();
    client.token.mockResolvedValue({ data: null, error: { status: 503 } });
    await expect(getAuthSessionFromClient(client)).rejects.toMatchObject({ status: 503 });
  });
});
