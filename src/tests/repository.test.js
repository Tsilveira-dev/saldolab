import { beforeEach, describe, expect, it } from 'vitest';
import { createLocalRepository, storageKey } from '../repositories/localRepository';
import { createDemoData } from '../services/demo';
import { totals } from '../domain/finance';

let repo;
beforeEach(async () => {
  repo = createLocalRepository({
    storage: window.localStorage,
    seed: () => createDemoData('2026-11'),
  });
  await repo.startEditing();
});
const transaction = {
  description: 'Novo lançamento',
  type: 'income',
  amountCents: 10001,
  categoryId: 'salary',
  accountId: 'checking',
  destinationAccountId: null,
  date: '2026-11-11',
  status: 'confirmed',
  notes: '',
};
describe('repositório assíncrono e integridade', () => {
  it('recusa IDs duplicados sem modificar o agregado', async () => {
    await repo.create('transactions', { ...transaction, id: 'qa-unique' });
    const before = await repo.snapshot();
    await expect(repo.create('transactions', { ...transaction, id: 'qa-unique' })).rejects.toThrow(
      'duplicados',
    );
    expect(await repo.snapshot()).toEqual(before);
  });
  it('trata consultas e alterações de registros inexistentes sem efeitos colaterais', async () => {
    const before = await repo.snapshot();
    expect(await repo.getById('transactions', 'missing')).toBeNull();
    await expect(repo.update('transactions', 'missing', { amountCents: 100 })).rejects.toThrow(
      'não encontrado',
    );
    await expect(repo.remove('transactions', 'missing')).rejects.toThrow('não encontrado');
    expect(await repo.snapshot()).toEqual(before);
  });
  it('cria receita, consulta por id e persiste após recriar o repositório', async () => {
    const created = await repo.create('transactions', transaction);
    const reopened = createLocalRepository();
    expect(await reopened.getById('transactions', created.id)).toEqual(created);
    expect((await repo.list('transactions')).length).toBe(91);
  });
  it('cria despesa e atualiza os indicadores calculados', async () => {
    const before = totals(await repo.list('transactions'));
    await repo.create('transactions', { ...transaction, type: 'expense', categoryId: 'food' });
    expect(totals(await repo.list('transactions')).expense).toBe(before.expense + 10001);
  });
  it('edita e exclui transação recalculando totais', async () => {
    const created = await repo.create('transactions', transaction);
    const before = totals(await repo.list('transactions'));
    await repo.update('transactions', created.id, { amountCents: 20001 });
    expect(totals(await repo.list('transactions')).income).toBe(before.income + 10000);
    await repo.remove('transactions', created.id);
    expect(await repo.getById('transactions', created.id)).toBeNull();
    expect(totals(await repo.list('transactions')).income).toBe(before.income - 10001);
  });
  it.each([
    ['accounts', 'checking'],
    ['accounts', 'savings'],
    ['categories', 'salary'],
    ['categories', 'food'],
  ])('protege exclusão de %s %s em uso', async (entity, id) => {
    const before = await repo.snapshot();
    await expect(repo.remove(entity, id)).rejects.toThrow();
    expect(await repo.snapshot()).toEqual(before);
  });
  it('permite CRUD de conta sem vínculos', async () => {
    const row = await repo.create('accounts', {
      name: 'Carteira nova',
      type: 'cash',
      initialBalanceCents: -2500,
      color: '#123456',
      icon: 'wallet',
      createdAt: '2026-11-11',
    });
    await repo.update('accounts', row.id, { name: 'Carteira pessoal' });
    expect((await repo.getById('accounts', row.id)).name).toBe('Carteira pessoal');
    await repo.remove('accounts', row.id);
    expect(await repo.getById('accounts', row.id)).toBeNull();
  });
  it('permite CRUD de categoria sem vínculos', async () => {
    const row = await repo.create('categories', {
      name: 'Nova categoria',
      type: 'expense',
      color: '#123456',
      icon: 'tag',
    });
    await repo.update('categories', row.id, { name: 'Categoria editada' });
    expect((await repo.getById('categories', row.id)).name).toBe('Categoria editada');
    await repo.remove('categories', row.id);
    expect(await repo.getById('categories', row.id)).toBeNull();
  });
  it('permite CRUD de orçamento e bloqueia duplicatas', async () => {
    const values = { categoryId: 'education', month: '2026-11', limitCents: 50000 };
    const row = await repo.create('budgets', values);
    await expect(repo.create('budgets', values)).rejects.toThrow('Já existe');
    await repo.update('budgets', row.id, { limitCents: 60000 });
    expect((await repo.getById('budgets', row.id)).limitCents).toBe(60000);
    await repo.remove('budgets', row.id);
  });
  it('rejeita transferências inválidas sem modificar os dados', async () => {
    const before = await repo.snapshot();
    await expect(
      repo.create('transactions', {
        ...transaction,
        type: 'transfer',
        categoryId: null,
        destinationAccountId: 'checking',
      }),
    ).rejects.toThrow('diferentes');
    expect(await repo.snapshot()).toEqual(before);
  });
  it('rejeita categoria incompatível e valor fracionário em centavos', async () => {
    await expect(
      repo.create('transactions', { ...transaction, categoryId: 'food' }),
    ).rejects.toThrow('compatível');
    await expect(
      repo.create('transactions', { ...transaction, amountCents: 1.5 }),
    ).rejects.toThrow();
  });
  it('impede mudar o tipo de uma categoria com transações dependentes', async () => {
    const before = await repo.snapshot();
    await expect(repo.update('categories', 'salary', { type: 'expense' })).rejects.toThrow(
      'compatível',
    );
    expect(await repo.snapshot()).toEqual(before);
  });
  it('mantém modos separados e restaura apenas a demonstração', async () => {
    const personal = createLocalRepository({ mode: 'personal' });
    await personal.startEditing();
    expect((await personal.snapshot()).accounts).toEqual([]);
    await personal.create('accounts', {
      name: 'Pessoal',
      type: 'cash',
      initialBalanceCents: 0,
      color: '#123456',
      icon: 'wallet',
      createdAt: '2026-11-11',
    });
    await repo.reset();
    expect((await personal.list('accounts'))[0].name).toBe('Pessoal');
  });
  it('exporta e importa backup com todos os dados', async () => {
    const backup = await repo.exportBackup();
    const personal = createLocalRepository({ mode: 'personal' });
    await personal.startEditing();
    await personal.importBackup(backup);
    expect(await personal.snapshot()).toEqual(await repo.snapshot());
  });
  it.each(['invalido', '{"app":"Outro"}', '{"app":"SaldoLab","data":{"version":99}}'])(
    'rejeita backup inválido e mantém o original: %s',
    async (text) => {
      const before = await repo.snapshot();
      await expect(repo.importBackup(text)).rejects.toThrow();
      expect(await repo.snapshot()).toEqual(before);
    },
  );
  it('rejeita backup com vínculo inexistente sem alterar o original', async () => {
    const before = await repo.snapshot();
    const bad = structuredClone(before);
    bad.transactions[0].accountId = 'missing';
    await expect(repo.importBackup(JSON.stringify({ app: 'SaldoLab', data: bad }))).rejects.toThrow(
      'origem',
    );
    expect(await repo.snapshot()).toEqual(before);
  });
  it('preserva dados corrompidos e fornece o conteúdo para recuperação', async () => {
    window.localStorage.setItem(storageKey('demo'), '{corrompido');
    await expect(repo.snapshot()).rejects.toMatchObject({ raw: '{corrompido' });
    expect(window.localStorage.getItem(storageKey('demo'))).toBe('{corrompido');
  });
  it('reporta armazenamento indisponível', async () => {
    const blocked = createLocalRepository({
      storage: {
        getItem() {
          throw new Error('blocked');
        },
      },
    });
    await expect(blocked.snapshot()).rejects.toThrow('bloqueou');
  });
  it('preserva o estado anterior se a gravação exceder a cota', async () => {
    await repo.snapshot();
    const raw = window.localStorage.getItem(storageKey('demo'));
    const full = createLocalRepository({
      storage: {
        getItem: (key) => window.localStorage.getItem(key),
        setItem() {
          throw new Error('quota');
        },
      },
    });
    await expect(full.create('transactions', transaction)).rejects.toThrow('preservados');
    expect(window.localStorage.getItem(storageKey('demo'))).toBe(raw);
  });
});
