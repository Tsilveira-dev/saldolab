import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { it, expect, vi } from 'vitest';
import FinanceProvider from '../context/FinanceProvider';
import { useFinance } from '../context/FinanceContext';
import { createRemoteRepository } from '../repositories/remoteRepository';

const state = vi.hoisted(() => ({ session: null }));
vi.mock('../auth/useCloudSession', () => ({ useCloudSession: () => state.session }));
vi.mock('../repositories/preferencesRepository', () => ({
  readPreferences: () => ({ mode: 'cloud', theme: 'light' }),
  savePreferences: () => {},
}));
vi.mock('../repositories/remoteRepository', () => ({ createRemoteRepository: vi.fn() }));
const session = (id) => ({ data: { user: { id } }, isPending: false });
const dataset = (marker) => ({ marker, accounts: [] });
function repo(snapshot, create = vi.fn()) {
  return {
    snapshot,
    create,
    getEditingAccess: () => ({ canWrite: true }),
    subscribeEditing: () => () => {},
    stopEditing: async () => {},
  };
}
function Probe() {
  const { data, canWrite, save, toast, switchMode } = useFinance();
  return (
    <>
      <output aria-label="Dados">{data?.marker ?? 'sem dados'}</output>
      <output aria-label="Permissão">{String(canWrite)}</output>
      <output aria-label="Mensagem">{toast?.message ?? ''}</output>
      <button onClick={() => save('accounts', {})}>Salvar</button>
      <button onClick={() => switchMode('cloud')}>Ocultar antes de autenticar</button>
    </>
  );
}
const app = () => (
  <FinanceProvider>
    <Probe />
  </FinanceProvider>
);

it('uma leitura atrasada da conta A não aparece após conectar a conta B no mesmo modo nuvem', async () => {
  let finishRead;
  const a = repo(
    vi.fn(
      () =>
        new Promise((resolve) => {
          finishRead = resolve;
        }),
    ),
  );
  const b = repo(vi.fn().mockResolvedValue(dataset('conta B')));
  createRemoteRepository.mockImplementation(({ userId }) => (userId === 'A' ? a : b));
  state.session = session('A');
  const view = render(app());
  await waitFor(() => expect(a.snapshot).toHaveBeenCalled());
  state.session = session('B');
  view.rerender(app());
  await waitFor(() => expect(screen.getByLabelText('Dados')).toHaveTextContent('conta B'));
  await act(async () => finishRead(dataset('conta A')));
  expect(screen.getByLabelText('Dados')).toHaveTextContent('conta B');
});

it('uma gravação atrasada de A não substitui os dados de B nem mostra sucesso na sessão nova', async () => {
  let finishWrite;
  const a = repo(
    vi.fn().mockResolvedValue(dataset('conta A')),
    vi.fn(
      () =>
        new Promise((resolve) => {
          finishWrite = resolve;
        }),
    ),
  );
  const b = repo(vi.fn().mockResolvedValue(dataset('conta B')));
  createRemoteRepository.mockImplementation(({ userId }) => (userId === 'A' ? a : b));
  state.session = session('A');
  const view = render(app());
  await waitFor(() => expect(screen.getByLabelText('Dados')).toHaveTextContent('conta A'));
  await userEvent.setup().click(screen.getByRole('button', { name: 'Salvar' }));
  state.session = session('B');
  view.rerender(app());
  await waitFor(() => expect(screen.getByLabelText('Dados')).toHaveTextContent('conta B'));
  await act(async () => finishWrite());
  expect(screen.getByLabelText('Dados')).toHaveTextContent('conta B');
  expect(screen.getByLabelText('Mensagem')).toBeEmptyDOMElement();
  state.session = { data: null, isPending: false };
  view.rerender(app());
  expect(screen.getByLabelText('Dados')).toHaveTextContent('sem dados');
  expect(screen.getByLabelText('Permissão')).toHaveTextContent('false');
});

it('invalida leitura em andamento ao ocultar a nuvem mesmo sem mudar de modo', async () => {
  let finishRead;
  const a = repo(
    vi.fn(
      () =>
        new Promise((resolve) => {
          finishRead = resolve;
        }),
    ),
  );
  createRemoteRepository.mockReturnValue(a);
  state.session = session('A');
  render(app());
  await waitFor(() => expect(a.snapshot).toHaveBeenCalled());
  await userEvent
    .setup()
    .click(screen.getByRole('button', { name: 'Ocultar antes de autenticar' }));
  await act(async () => finishRead(dataset('conta A')));
  expect(screen.getByLabelText('Dados')).toHaveTextContent('sem dados');
  expect(screen.getByLabelText('Permissão')).toHaveTextContent('false');
});

it('oculta snapshot e escrita enquanto a identidade está sendo conferida', async () => {
  createRemoteRepository.mockReturnValue(repo(vi.fn().mockResolvedValue(dataset('conta A'))));
  state.session = session('A');
  const view = render(app());
  await waitFor(() => expect(screen.getByLabelText('Dados')).toHaveTextContent('conta A'));
  state.session = { ...session('A'), isPending: true };
  view.rerender(app());
  expect(screen.getByLabelText('Dados')).toHaveTextContent('sem dados');
  expect(screen.getByLabelText('Permissão')).toHaveTextContent('false');
});
