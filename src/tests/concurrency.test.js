import { beforeEach, describe, expect, it } from 'vitest';
import { createLocalRepository, storageKey } from '../repositories/localRepository';
import { createDemoData } from '../services/demo';

const values = {
  description: 'Receita para concorrência',
  type: 'income',
  amountCents: 100000,
  categoryId: 'salary',
  accountId: 'checking',
  destinationAccountId: null,
  date: '2026-11-11',
  status: 'confirmed',
  notes: '',
};
let repository;
beforeEach(() => {
  repository = createLocalRepository({ seed: () => createDemoData('2026-11') });
});

describe('integridade entre operações concorrentes', () => {
  it('rejeita edição antiga e preserva o valor já atualizado', async () => {
    const original = await repository.create('transactions', values);
    await repository.update(
      'transactions',
      original.id,
      { amountCents: 250000 },
      { expected: original },
    );
    await expect(
      repository.update(
        'transactions',
        original.id,
        { description: 'Formulário antigo', amountCents: 100000 },
        { expected: original },
      ),
    ).rejects.toThrow('outra aba');
    expect((await repository.getById('transactions', original.id)).amountCents).toBe(250000);
  });

  it('rejeita confirmação de exclusão antiga e preserva a edição recente', async () => {
    const original = await repository.create('transactions', values);
    await repository.update('transactions', original.id, { amountCents: 250000 });
    await expect(
      repository.remove('transactions', original.id, { expected: original }),
    ).rejects.toThrow('outra aba');
    expect((await repository.getById('transactions', original.id)).amountCents).toBe(250000);
  });

  it('aceita editar e excluir quando o registro esperado ainda é atual', async () => {
    const original = await repository.create('transactions', values);
    const updated = await repository.update(
      'transactions',
      original.id,
      { amountCents: 250000 },
      { expected: original },
    );
    await repository.remove('transactions', original.id, { expected: updated });
    expect(await repository.getById('transactions', original.id)).toBeNull();
  });

  it('preserva todas as criações feitas por instâncias concorrentes', async () => {
    const second = createLocalRepository({ seed: () => createDemoData('2026-11') });
    const before = (await repository.list('transactions')).length;
    await Promise.all(
      Array.from({ length: 30 }, (_, index) =>
        (index % 2 ? repository : second).create('transactions', {
          ...values,
          description: `Receita ${index}`,
        }),
      ),
    );
    expect(await repository.list('transactions')).toHaveLength(before + 30);
  });

  it('não permite dois orçamentos iguais em chamadas concorrentes', async () => {
    const budget = { categoryId: 'education', month: '2026-11', limitCents: 10000 };
    const results = await Promise.allSettled([
      repository.create('budgets', budget),
      repository.create('budgets', budget),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(
      (await repository.list('budgets')).filter((row) => row.categoryId === 'education'),
    ).toHaveLength(1);
  });

  it('mantém leitura e backup, mas bloqueia escrita sem Web Locks', async () => {
    const before = await repository.snapshot();
    const readonly = createLocalRepository({ lockManager: null });
    await expect(readonly.create('transactions', values)).rejects.toThrow('edição segura');
    expect(await readonly.snapshot()).toEqual(before);
    expect(JSON.parse(await readonly.exportBackup()).data).toEqual(before);
  });

  it('não inicializa nem substitui conteúdo se não houver edição segura', async () => {
    const readonly = createLocalRepository({ mode: 'personal', lockManager: null });
    await expect(readonly.snapshot()).rejects.toThrow('edição segura');
    expect(window.localStorage.getItem(storageKey('personal'))).toBeNull();
  });

  it('explica bloqueio de permissão sem realizar escrita', async () => {
    await repository.snapshot();
    const before = window.localStorage.getItem(storageKey('demo'));
    const blocked = createLocalRepository({
      lockManager: {
        request: () => Promise.reject(new DOMException('Permission denied', 'SecurityError')),
      },
    });
    await expect(blocked.create('transactions', values)).rejects.toThrow('bloqueou');
    expect(window.localStorage.getItem(storageKey('demo'))).toBe(before);
  });
});
