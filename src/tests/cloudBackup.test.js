import { describe, expect, it } from 'vitest';
import { exportCloudBackup, readCloudBackup } from '../repositories/cloudBackup';

const dataset = {
  accounts: [
    {
      id: 'a1',
      name: 'Conta principal',
      type: 'digital',
      initialBalanceCents: 25000,
      color: '#123456',
      icon: 'bank',
      createdAt: '2026-11-12',
    },
  ],
  categories: [{ id: 'c1', name: 'Alimentação', type: 'expense', color: '#223344', icon: 'food' }],
  transactions: [
    {
      id: 't1',
      description: 'Mercado',
      type: 'expense',
      amountCents: 1250,
      categoryId: 'c1',
      accountId: 'a1',
      destinationAccountId: null,
      date: '2026-11-12',
      status: 'confirmed',
      notes: '',
    },
  ],
  budgets: [{ id: 'b1', categoryId: 'c1', month: '2026-11', limitCents: 5000 }],
};

describe('backup da nuvem sem credenciais e com integridade financeira', () => {
  it('exporta e importa os valores em centavos, categorias e vínculos sem perdas', () => {
    const exported = exportCloudBackup(dataset);
    const parsed = JSON.parse(exported);
    expect(parsed.app).toBe('SaldoLab');
    expect(parsed.exportedAt).toBeTruthy();
    expect(readCloudBackup(exported)).toEqual({ version: 1, ...dataset });
  });

  it('não inclui revisions, identidades, tokens nem campos inesperados no JSON', () => {
    const withPrivateFields = Object.fromEntries(
      Object.entries(dataset).map(([entity, rows]) => [
        entity,
        rows.map((row) => ({
          ...row,
          revision: 27,
          user_id: 'private-account-id',
          sessionId: 'private-session-id',
          password: 'private-password',
          token: 'private-token',
        })),
      ]),
    );
    const output = exportCloudBackup(withPrivateFields);
    expect(output).not.toMatch(/private-|sessionId|user_id|revision|password|token/);
    expect(readCloudBackup(output)).toEqual({ version: 1, ...dataset });
  });

  it('recusa exportação com referência financeira inválida em vez de gerar backup inconsistente', () => {
    expect(() =>
      exportCloudBackup({
        ...dataset,
        transactions: [{ ...dataset.transactions[0], accountId: 'other-user-account' }],
      }),
    ).toThrow('A conta de origem não existe.');
  });

  it('recusa JSON adulterado, origem desconhecida e arquivo acima do limite', () => {
    expect(() => readCloudBackup('{not valid JSON')).toThrow('BACKUP_JSON_INVALID');
    expect(() =>
      readCloudBackup(JSON.stringify({ app: 'OtherApp', data: { version: 1, ...dataset } })),
    ).toThrow('BACKUP_APP_INVALID');
    expect(() => readCloudBackup('x'.repeat(20_000_001))).toThrow('BACKUP_SIZE_INVALID');
  });

  it('recusa orçamento sem categoria de despesa e IDs duplicados', () => {
    const duplicate = {
      version: 1,
      ...dataset,
      accounts: [...dataset.accounts, ...dataset.accounts],
    };
    expect(() => readCloudBackup(JSON.stringify({ app: 'SaldoLab', data: duplicate }))).toThrow(
      'Há identificadores duplicados em accounts.',
    );
    const missing = {
      version: 1,
      ...dataset,
      budgets: [{ ...dataset.budgets[0], categoryId: 'another-user-category' }],
    };
    expect(() => readCloudBackup(JSON.stringify({ app: 'SaldoLab', data: missing }))).toThrow(
      'O orçamento precisa de uma categoria de despesa.',
    );
  });
});
