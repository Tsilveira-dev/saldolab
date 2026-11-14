import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FinanceContext } from './FinanceContext';
import { createLocalRepository, StorageError } from '../repositories/localRepository';
import { createRemoteRepository } from '../repositories/remoteRepository';
import {
  rememberEditingRequest,
  takeEditingRequest,
  clearEditingRequest,
} from '../repositories/editingRequest';
import { currentMonth } from '../domain/finance';
import { readPreferences, savePreferences } from '../repositories/preferencesRepository';
import { useCloudSession } from '../auth/useCloudSession';
import { CloudSessionError } from '../auth/neonClient';

export default function FinanceProvider({ children }) {
  const session = useCloudSession();
  const cloudUserId = session.data?.user?.id ?? null;
  const [preferences] = useState(readPreferences);
  const activeMode = useRef(preferences.mode);
  const [mode, setMode] = useState(preferences.mode);
  const [month, setMonth] = useState(currentMonth);
  const [accountId, setAccountId] = useState('');
  const [data, setData] = useState(null);
  const [dataUserId, setDataUserId] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [theme, setTheme] = useState(preferences.theme);
  const [editor, setEditor] = useState(null);
  const [confirmation, setConfirmation] = useState(null);
  const generation = useRef(0);
  const startup = useRef(null);
  const [activatingEditing, setActivatingEditing] = useState(false);
  const repositoryUserId = mode === 'cloud' ? cloudUserId : null;
  const repository = useMemo(() => {
    try {
      return mode === 'cloud'
        ? createRemoteRepository({ userId: repositoryUserId })
        : createLocalRepository({ mode });
    } catch (cause) {
      return {
        getEditingAccess: () => ({ canWrite: false, supported: false, reason: 'blocked' }),
        subscribeEditing: () => () => {},
        startEditing: async () => false,
        stopEditing: async () => {},
        snapshot: async () => {
          throw cause;
        },
      };
    }
  }, [mode, repositoryUserId]);
  const [editingAccess, setEditingAccess] = useState(() => repository.getEditingAccess());
  useEffect(() => {
    if (!editingAccess.canWrite) return;
    try {
      rememberEditingRequest({ mode, month, accountId });
    } catch {
      // A reload safely returns to reading when navigation state is unavailable.
    }
  }, [editingAccess.canWrite, mode, month, accountId]);
  const reload = useCallback(async () => {
    const request = ++generation.current;
    const requestMode = mode;
    setLoading(true);
    if (mode === 'cloud' && session.isPending) return;
    try {
      if (mode === 'cloud' && !cloudUserId)
        throw new CloudSessionError('Sua sessão expirou. Entre novamente em Minha nuvem.');
      const next = await repository.snapshot();
      if (request === generation.current && requestMode === activeMode.current) {
        setData(next);
        setDataUserId(cloudUserId);
        setError(null);
      }
    } catch (cause) {
      if (request === generation.current && requestMode === activeMode.current) {
        if (mode === 'cloud') setData(null);
        setError(cause);
      }
    } finally {
      if (request === generation.current && requestMode === activeMode.current) setLoading(false);
    }
  }, [repository, mode, cloudUserId, session.isPending]);
  useEffect(() => {
    if (mode !== 'cloud') return;
    setEditor(null);
    setConfirmation(null);
    setToast(null);
    setAccountId('');
  }, [cloudUserId, mode]);
  useEffect(() => {
    setEditingAccess(repository.getEditingAccess());
    const unsubscribe = repository.subscribeEditing((access) => {
      if (mode === activeMode.current) setEditingAccess(access);
    });
    // Acquire the local write lease before the first read, without a manual button.
    // A second tab stays read-only until its own reload.
    const request = startup.current ? null : takeEditingRequest();
    const entry = {
      request,
      ready: mode === 'cloud' ? Promise.resolve(false) : repository.startEditing(),
    };
    startup.current = entry;
    let mounted = true;
    entry.ready.then(() => {
      if (!mounted) return;
      if (entry.request?.mode === mode) {
        if (/^\d{4}-\d{2}$/.test(entry.request.month)) setMonth(entry.request.month);
        if (typeof entry.request.accountId === 'string') setAccountId(entry.request.accountId);
        entry.request = null;
      }
      reload();
    });
    const onStorage = (event) => {
      if (event.key === null || event.key === `saldolab:v1:${mode}`) reload();
    };
    const onPageShow = (event) => {
      if (!event.persisted) return;
      clearEditingRequest();
      setEditor(null);
      setConfirmation(null);
      setToast(null);
      setEditingAccess(repository.getEditingAccess());
      reload();
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener('pageshow', onPageShow);
    return () => {
      mounted = false;
      unsubscribe();
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('pageshow', onPageShow);
    };
  }, [reload, repository, mode]);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  useEffect(() => {
    savePreferences({ mode, theme });
  }, [mode, theme]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(timer);
  }, [toast]);
  const notify = useCallback((message, variant = 'success') => setToast({ message, variant }), []);
  const activateEditing = () => {
    try {
      rememberEditingRequest({ mode, month, accountId });
      setActivatingEditing(true);
      window.location.reload();
    } catch {
      setActivatingEditing(false);
      notify(
        'Não foi possível ativar a edição. Confira as permissões do navegador; a consulta e o backup continuam disponíveis.',
        'danger',
      );
    }
  };
  const stopEditing = async () => {
    clearEditingRequest();
    setEditor(null);
    setConfirmation(null);
    setToast(null);
    await repository.stopEditing();
  };
  const mutate = async (operation, message = 'Alterações salvas.') => {
    if (mode === 'cloud' && (!cloudUserId || session.isPending || error))
      throw new CloudSessionError('Reabra seus dados em Minha nuvem antes de salvar.');
    if (!repository.getEditingAccess().canWrite) {
      throw new StorageError(
        'Esta aba está em modo somente leitura. Ative a edição para salvar alterações.',
      );
    }
    const request = generation.current;
    let next, result;
    try {
      result = await operation(repository);
      next = await repository.snapshot();
    } catch (cause) {
      if (mode === 'cloud' && cause.status === 401 && request === generation.current) {
        setData(null);
        setError(cause);
      }
      throw cause;
    }
    if (mode !== activeMode.current || request !== generation.current) return;
    setData(next);
    setDataUserId(cloudUserId);
    setAccountId((previous) =>
      next.accounts.some((account) => account.id === previous) ? previous : '',
    );
    setError(null);
    notify(message);
    return result;
  };
  const switchMode = (value) => {
    // Also invalidate in-flight reads when re-entering the same mode during
    // sign-out/sign-in; an old response must not repopulate the cleared view.
    generation.current++;
    repository.stopEditing();
    clearEditingRequest();
    setEditingAccess({
      canWrite: false,
      supported: Boolean(navigator.locks?.request),
      reason: 'view',
    });
    activeMode.current = value;
    setEditor(null);
    setConfirmation(null);
    setToast(null);
    setData(null);
    setDataUserId(null);
    setAccountId('');
    setMode(value);
  };
  const save = async (entity, values, id, expected) => {
    const messages = {
      accounts: ['Conta cadastrada com sucesso.', 'Conta atualizada com sucesso.'],
      categories: ['Categoria cadastrada com sucesso.', 'Categoria atualizada com sucesso.'],
      transactions: ['Transação cadastrada com sucesso.', 'Transação atualizada com sucesso.'],
      budgets: ['Orçamento cadastrado com sucesso.', 'Orçamento atualizado com sucesso.'],
    };
    return mutate(
      (repo) => (id ? repo.update(entity, id, values, { expected }) : repo.create(entity, values)),
      (messages[entity] ?? ['Registro cadastrado.', 'Registro atualizado.'])[id ? 1 : 0],
    );
  };
  const remove = (entity, row) =>
    setConfirmation({
      title: 'Excluir registro?',
      message: `“${row.description ?? row.name ?? 'Este orçamento'}” será removido. Essa ação não pode ser desfeita.`,
      confirmLabel: 'Excluir registro',
      danger: true,
      action: () =>
        mutate((repo) => repo.remove(entity, row.id, { expected: row }), 'Registro excluído.'),
    });
  const cloudUnavailable =
    mode === 'cloud' &&
    (session.isPending || !cloudUserId || dataUserId !== cloudUserId || Boolean(error) || !data);
  return (
    <FinanceContext.Provider
      value={{
        mode,
        switchMode,
        month,
        setMonth,
        accountId,
        setAccountId,
        data: cloudUnavailable ? null : data,
        error,
        loading,
        reload,
        repository,
        canWrite:
          editingAccess.canWrite &&
          (mode !== 'cloud' ||
            Boolean(cloudUserId && !session.isPending && !error && dataUserId === cloudUserId)),
        editingAccess,
        activatingEditing,
        activateEditing,
        stopEditing,
        toast,
        setToast,
        notify,
        theme,
        setTheme,
        editor: cloudUnavailable ? null : editor,
        setEditor,
        confirmation: cloudUnavailable ? null : confirmation,
        setConfirmation,
        save,
        remove,
        mutate,
      }}
    >
      {children}
    </FinanceContext.Provider>
  );
}
