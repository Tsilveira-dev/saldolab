import { describe, expect, it } from 'vitest';
import financeHandler from '../../api/finance.js';
import healthHandler from '../../api/health.js';

describe('Vercel Functions do SaldoLab', () => {
  it('retorna saúde sem revelar configuração privada', async () => {
    const response = healthHandler.fetch();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ app: 'SaldoLab', status: 'ok' });
    expect(response.headers.get('Cache-Control')).toContain('no-store');
  });

  it('rejeita leitura de dados financeiros sem autenticação', async () => {
    const response = await financeHandler.fetch(
      new Request('https://localhost/api/finance', { method: 'GET' }),
    );
    expect(response.status).toBe(401);
    expect(await response.json()).toHaveProperty('error');
  });

  it('bloqueia escrita não autenticada antes do acesso ao banco', async () => {
    const response = await financeHandler.fetch(
      new Request('https://localhost/api/finance?entity=accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Conta teste' }),
      }),
    );
    expect(response.status).toBe(401);
  });

  it('rejeita métodos não suportados sem alterar registros', async () => {
    const response = await financeHandler.fetch(
      new Request('https://localhost/api/finance', { method: 'PUT' }),
    );
    expect(response.status).toBe(405);
    expect(response.headers.get('Allow')).toContain('PATCH');
  });
});
