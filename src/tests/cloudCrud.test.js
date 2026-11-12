import { describe, expect, it } from 'vitest';
import { createRecord, updateRecord, removeRecord, listRecords } from '../../api/_lib/finance.js';

const owner = 'test-user-A';
const categories = [{ id: 'food', user_id: owner, type: 'expense', name: 'Alimentação',
  color: '#123456', icon: 'food', revision: 1 }];
const transaction = {
  id: 'tx-1', user_id: owner, description: 'Compras', type: 'expense',
  amount_cents: '1500', category_id: 'food', account_id: 'acc-1',
  destination_account_id: null, date: '2026-11-12', status: 'confirmed',
  notes: '', revision: 1,
};

describe('Contrato SQL do CRUD remoto', () => {
  it('inclui user_id e parâmetros em todas as listagens', async () => {
    const statements = [];
    const client = { query: async (sql, args) => {
      statements.push({ sql, args });
      return { rows: [] };
    } };
    await listRecords(client, 'transactions', owner);
    expect(statements[0].sql).toContain('WHERE user_id = $1');
    expect(statements[0].args).toEqual([owner]);
  });

  it('recusa atualização de transação com revisão obsoleta', async () => {
    const client = { query: async (sql, args) => {
      if (sql.includes('FOR UPDATE')) {
        expect(args).toEqual([owner, 'tx-1']);
        return { rows: [transaction] };
      }
      throw new Error('Unexpected SQL');
    } };
    await expect(updateRecord(client, 'transactions', owner, 'tx-1',
      { expectedRevision: 2, description: 'Compra revisada' }))
      .rejects.toMatchObject({ status: 409 });
  });

  it('recusa associação a conta de outro usuário antes do INSERT', async () => {
    let inserted = false;
    const client = { query: async (sql, args) => {
      if (sql.includes('SELECT id FROM public.accounts')) {
        expect(args[0]).toBe(owner);
        return { rows: [{ id: 'acc-1' }] };
      }
      if (sql.startsWith('INSERT')) inserted = true;
      return { rows: categories };
    } };
    await expect(createRecord(client, 'transactions', owner, {
      description: 'Pagamento', type: 'expense', amountCents: 100,
      categoryId: 'food', accountId: 'acc-1',
      destinationAccountId: 'acc-other-user', date: '2026-11-12',
      status: 'confirmed', notes: '',
    })).rejects.toMatchObject({ status: 422 });
    expect(inserted).toBe(false);
  });

  it('nunca exclui linha de outro usuário com ID fornecido pelo cliente', async () => {
    const statements = [];
    const client = { query: async (sql, args) => {
      statements.push({ sql, args });
      return { rows: [] };
    } };
    await expect(removeRecord(client, 'accounts', owner, 'acc-1', 1))
      .rejects.toMatchObject({ status: 404 });
    expect(statements[0].sql).toContain('WHERE user_id = $1 AND id = $2 AND revision = $3');
    expect(statements[0].args).toEqual([owner, 'acc-1', 1]);
  });
});
