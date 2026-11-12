import { describe, expect, it } from 'vitest';
import {
  assertEntity,
  validateWrite,
  validateWholeRecord,
  serializeRow,
  validateRevision,
} from '../../api/_lib/validation.js';
import { authenticatedUser } from '../../api/_lib/auth.js';

const account = {
  name: 'Conta digital',
  type: 'digital',
  initialBalanceCents: 9000,
  color: '#223344',
  icon: 'bank',
  createdAt: '2026-11-12',
};
const transaction = {
  description: 'Pagamento',
  type: 'expense',
  amountCents: 1500,
  categoryId: 'food',
  accountId: 'checking',
  destinationAccountId: null,
  date: '2026-11-12',
  status: 'confirmed',
  notes: '',
};
describe('Contrato seguro do backend Neon', () => {
  it('recusa entidades não previstas e nomes SQL maliciosos', () => {
    expect(() => assertEntity('users')).toThrow();
    expect(() => assertEntity('transactions;DROP TABLE accounts')).toThrow();
  });
  it('valida valor financeiro e campos de conta', () => {
    expect(validateWholeRecord('accounts', account)).toEqual(account);
    expect(() =>
      validateWrite('accounts', { ...account, initialBalanceCents: 1.25 }, { create: true }),
    ).toThrow();
    expect(() =>
      validateWrite('accounts', { ...account, createdAt: '2026-02-30' }, { create: true }),
    ).toThrow();
    expect(() =>
      validateWrite(
        'accounts',
        { ...account, initialBalanceCents: 100000000001 },
        { create: true },
      ),
    ).toThrow();
  });
  it('não aceita user_id ou revision manipulados por clientes', () => {
    expect(() =>
      validateWrite('accounts', { ...account, user_id: 'outro' }, { create: true }),
    ).toThrow();
    expect(() => validateWrite('accounts', { revision: 500 })).toThrow();
    expect(() => validateRevision(undefined)).toThrow();
    expect(() => validateRevision(0)).toThrow();
  });
  it('recusa transferências inválidas, categorias ausentes e datas inválidas', () => {
    expect(() =>
      validateWholeRecord('transactions', { ...transaction, type: 'transfer' }),
    ).toThrow();
    expect(() =>
      validateWholeRecord('transactions', { ...transaction, categoryId: null }),
    ).toThrow();
    expect(() =>
      validateWholeRecord('transactions', { ...transaction, date: '2026-02-30' }),
    ).toThrow();
    expect(
      validateWholeRecord('transactions', {
        ...transaction,
        type: 'transfer',
        categoryId: null,
        destinationAccountId: 'savings',
      }).type,
    ).toBe('transfer');
  });
  it('serializa dinheiro em centavos sem arredondamento', () => {
    const row = {
      id: 'a',
      name: 'Conta digital',
      type: 'digital',
      initial_balance_cents: '123456',
      color: '#223344',
      icon: 'bank',
      created_at: '2026-11-12',
      revision: 4,
    };
    expect(serializeRow('accounts', row)).toMatchObject({
      id: 'a',
      name: 'Conta digital',
      initialBalanceCents: 123456,
      createdAt: '2026-11-12',
      revision: 4,
    });
  });
  it('exige token mesmo para ler dados', async () => {
    await expect(
      authenticatedUser(new Request('https://example.test/api/finance')),
    ).rejects.toMatchObject({
      status: 401,
    });
  });
});
