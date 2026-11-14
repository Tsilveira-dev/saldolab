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
      <button onClick={() => switchMode('demo')}>Abrir demonstração</button>
      <button onClick={() => save('transactions', {})}>Salvar pessoal</button>
    </>
  );
}

it('não mistura dados após uma gravação demorada e troca de modo', async () => {
  let finishWrite;
  const demo = {
    snapshot: vi.fn().mockResolvedValue({ marker: 'dados demonstrativos', accounts: [] }),
  };
  const personal = {
    snapshot: vi.fn().mockResolvedValue({ marker: 'dados pessoais', accounts: [] }),
    create: vi.fn(() => new Promise((resolve) => (finishWrite = resolve))),
  };
  for (const repo of [demo, personal]) {
    repo.getEditingAccess = () => ({ canWrite: true, supported: true, reason: 'editing' });
    repo.subscribeEditing = (listener) => {
      listener(repo.getEditingAccess());
      return () => {};
    };
    repo.stopEditing = async () => {};
    repo.startEditing = async () => true;
  }
  createLocalRepository.mockImplementation(({ mode }) => (mode === 'demo' ? demo : personal));
  window.localStorage.setItem('saldolab:preferences:v1', JSON.stringify({ mode: 'personal' }));
  const user = userEvent.setup();
  render(
    <FinanceProvider>
      <ModeProbe />
    </FinanceProvider>,
  );
  await waitFor(() =>
    expect(screen.getByLabelText('Dados')).toHaveTextContent('dados pessoais'),
  );
  await user.click(screen.getByRole('button', { name: 'Salvar pessoal' }));
  await user.click(screen.getByRole('button', { name: 'Abrir demonstração' }));
  await waitFor(() =>
    expect(screen.getByLabelText('Dados')).toHaveTextContent('dados demonstrativos'),
  );
  await act(async () => finishWrite());
  expect(personal.create).toHaveBeenCalledTimes(1);
  expect(screen.getByLabelText('Modo')).toHaveTextContent('demo');
  expect(screen.getByLabelText('Dados')).toHaveTextContent('dados demonstrativos');
  expect(screen.getByLabelText('Mensagem')).toBeEmptyDOMElement();
});
