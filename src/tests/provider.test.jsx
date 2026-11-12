import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import FinanceProvider from '../context/FinanceProvider';
import { useFinance } from '../context/FinanceContext';
import { createLocalRepository } from '../repositories/localRepository';

vi.mock('../repositories/localRepository', () => ({ createLocalRepository: vi.fn() }));

function ModeProbe() {
  const { mode, data, switchMode, save, toast } = useFinance();
  return (
    <>
      <output aria-label="Modo">{mode}</output>
      <output aria-label="Dados">{data?.marker ?? 'carregando'}</output>
      <output aria-label="Mensagem">{toast?.message ?? ''}</output>
      <button onClick={() => switchMode('personal')}>Abrir pessoal</button>
      <button onClick={() => save('transactions', {})}>Salvar demonstração</button>
    </>
  );
}

it('uma gravação demorada da demonstração não substitui os dados pessoais após trocar de modo', async () => {
  let finishWrite;
  const demo = {
    snapshot: vi.fn().mockResolvedValue({ marker: 'dados demonstrativos', accounts: [] }),
    create: vi.fn(() => new Promise((resolve) => (finishWrite = resolve))),
  };
  const personal = {
    snapshot: vi.fn().mockResolvedValue({ marker: 'dados pessoais', accounts: [] }),
  };
  for (const repo of [demo, personal]) {
    repo.getEditingAccess = () => ({ canWrite: true, supported: true, reason: 'editing' });
    repo.subscribeEditing = (listener) => {
      listener(repo.getEditingAccess());
      return () => {};
    };
    repo.stopEditing = async () => {};
  }
  createLocalRepository.mockImplementation(({ mode }) => (mode === 'demo' ? demo : personal));
  const user = userEvent.setup();
  render(
    <FinanceProvider>
      <ModeProbe />
    </FinanceProvider>,
  );
  await waitFor(() =>
    expect(screen.getByLabelText('Dados')).toHaveTextContent('dados demonstrativos'),
  );
  await user.click(screen.getByRole('button', { name: 'Salvar demonstração' }));
  await user.click(screen.getByRole('button', { name: 'Abrir pessoal' }));
  await waitFor(() => expect(screen.getByLabelText('Dados')).toHaveTextContent('dados pessoais'));
  await act(async () => finishWrite());
  expect(demo.create).toHaveBeenCalledTimes(1);
  expect(screen.getByLabelText('Modo')).toHaveTextContent('personal');
  expect(screen.getByLabelText('Dados')).toHaveTextContent('dados pessoais');
  expect(screen.getByLabelText('Mensagem')).toBeEmptyDOMElement();
});
