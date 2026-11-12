import { describe, expect, it, vi } from 'vitest';
import { createLocalRepository, storageKey } from '../repositories/localRepository';
import { createDemoData } from '../services/demo';

const transaction = {
  description: 'QA gravação confirmada',
  type: 'income',
  amountCents: 250000,
  categoryId: 'salary',
  accountId: 'checking',
  destinationAccountId: null,
  date: '2026-11-11',
  status: 'confirmed',
  notes: '',
};

describe('consulta, edição explícita e ciclo da reserva', () => {
  it('ler, listar, consultar e exportar não reservam edição nem inicializam o storage', async () => {
    const request = vi.spyOn(navigator.locks, 'request');
    const repo = createLocalRepository();
    await repo.snapshot();
    await repo.list('accounts');
    await repo.getById('accounts', 'checking');
    await repo.exportBackup();
    expect(request).not.toHaveBeenCalled();
    expect(repo.getEditingAccess().canWrite).toBe(false);
    expect(localStorage.getItem(storageKey('demo'))).toBeNull();
  });

  it('uma aba de consulta não impede outra de reservar edição', async () => {
    const reader = createLocalRepository();
    await reader.snapshot();
    const writer = createLocalRepository({ lockManager: { request: navigator.locks.request } });
    expect(await writer.startEditing()).toBe(true);
    const created = await writer.create('transactions', transaction);
    expect(created.amountCents).toBe(250000);
    expect(reader.getEditingAccess().canWrite).toBe(false);
    expect((await reader.getById('transactions', created.id)).amountCents).toBe(250000);
  });

  it('uma sessão que já leu não assume escrita a partir de um snapshot potencialmente antigo', async () => {
    const repo = createLocalRepository();
    await repo.snapshot();
    expect(await repo.startEditing()).toBe(false);
    expect(repo.getEditingAccess().reason).toBe('reload');
    await expect(repo.create('transactions', transaction)).rejects.toThrow('somente leitura');
  });

  it('libera a reserva ao encerrar e exige documento novo para voltar a editar', async () => {
    const repo = createLocalRepository();
    await repo.startEditing();
    await repo.stopEditing();
    expect((await navigator.locks.query()).held).toEqual([]);
    expect(await repo.startEditing()).toBe(false);
    await expect(repo.create('transactions', transaction)).rejects.toThrow('somente leitura');
  });

  it('pagehide libera o lock e páginas restauradas não recuperam permissão antiga', async () => {
    const repo = createLocalRepository();
    await repo.startEditing();
    window.dispatchEvent(new Event('pagehide'));
    await repo.stopEditing();
    window.dispatchEvent(new Event('pageshow'));
    expect((await navigator.locks.query()).held).toEqual([]);
    expect(repo.getEditingAccess().canWrite).toBe(false);
    expect(await repo.startEditing()).toBe(false);
  });

  it('uma leitura que ocorre enquanto a reserva aguarda não permite ativação tardia', async () => {
    let grant;
    const repo = createLocalRepository({
      lockManager: {
        request: (_name, _options, callback) =>
          new Promise((resolve) => {
            grant = () => resolve(callback({}));
          }),
      },
    });
    const ready = repo.startEditing();
    await Promise.resolve();
    await repo.snapshot();
    grant();
    expect(await ready).toBe(false);
    expect(repo.getEditingAccess().canWrite).toBe(false);
  });

  it('uma reserva pendente também é recusada se o documento sair antes da concessão', async () => {
    let grant;
    const repo = createLocalRepository({
      lockManager: {
        request: (_name, _options, callback) =>
          new Promise((resolve) => {
            grant = () => resolve(callback({}));
          }),
      },
    });
    const ready = repo.startEditing();
    await Promise.resolve();
    window.dispatchEvent(new Event('pagehide'));
    grant();
    expect(await ready).toBe(false);
    expect(repo.getEditingAccess().canWrite).toBe(false);
  });

  it('permissão de lock negada preserva consulta e backup', async () => {
    const repo = createLocalRepository({
      lockManager: { request: () => Promise.reject(new DOMException('blocked', 'SecurityError')) },
    });
    expect(await repo.startEditing()).toBe(false);
    expect((await repo.snapshot()).accounts.length).toBeGreaterThan(0);
    expect(JSON.parse(await repo.exportBackup()).app).toBe('SaldoLab');
    await expect(repo.create('transactions', transaction)).rejects.toThrow('bloqueou');
  });
});

describe('nenhuma mutação confirma sucesso sem verificar a gravação', () => {
  const entities = [
    ['transactions', transaction, { amountCents: 300000 }],
    [
      'accounts',
      {
        name: 'QA conta',
        type: 'cash',
        initialBalanceCents: 100,
        color: '#123456',
        icon: 'wallet',
        createdAt: '2026-11-11',
      },
      { initialBalanceCents: 200 },
    ],
    [
      'categories',
      { name: 'QA categoria', type: 'expense', color: '#123456', icon: 'tag' },
      { name: 'QA editada' },
    ],
    [
      'budgets',
      { categoryId: 'education', month: '2026-11', limitCents: 10000 },
      { limitCents: 20000 },
    ],
  ];
  it.each(entities)(
    '%s: create/update/delete confirmados correspondem ao conteúdo persistido',
    async (entity, values, changed) => {
      const repo = createLocalRepository();
      await repo.startEditing();
      const row = await repo.create(entity, values);
      const saved = () => JSON.parse(localStorage.getItem(storageKey('demo')))[entity];
      expect(saved()).toContainEqual(row);
      const updated = await repo.update(entity, row.id, changed, { expected: row });
      expect(saved()).toContainEqual(updated);
      await repo.remove(entity, row.id, { expected: updated });
      expect(saved().some((item) => item.id === row.id)).toBe(false);
    },
  );

  it.each(['create', 'update', 'remove', 'import', 'reset'])(
    '%s: setItem sem efeito não retorna sucesso',
    async (operation) => {
      const actual = createLocalRepository();
      await actual.startEditing();
      const row = await actual.create('transactions', transaction);
      const original = localStorage.getItem(storageKey('demo'));
      const repo = createLocalRepository({
        storage: { getItem: (key) => localStorage.getItem(key), setItem() {} },
      });
      const candidate = createDemoData('2026-10');
      const mutations = {
        create: () => repo.create('transactions', transaction),
        update: () => repo.update('transactions', row.id, { amountCents: 300000 }),
        remove: () => repo.remove('transactions', row.id),
        import: () => repo.importBackup(JSON.stringify({ app: 'SaldoLab', data: candidate })),
        reset: () => repo.reset(),
      };
      await expect(mutations[operation]()).rejects.toThrow('confirmar a gravação');
      expect(localStorage.getItem(storageKey('demo'))).toBe(original);
    },
  );
});
