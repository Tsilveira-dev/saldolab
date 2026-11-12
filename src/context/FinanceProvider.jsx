import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FinanceContext } from './FinanceContext';
import { createLocalRepository } from '../repositories/localRepository';
import { currentMonth } from '../domain/finance';
import { readPreferences, savePreferences } from '../repositories/preferencesRepository';

export default function FinanceProvider({ children }) {
  const [preferences] = useState(readPreferences);
  const activeMode = useRef(preferences.mode);
  const [mode, setMode] = useState(preferences.mode);
  const [month, setMonth] = useState(currentMonth);
  const [accountId, setAccountId] = useState('');
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [theme, setTheme] = useState(preferences.theme);
  const [editor, setEditor] = useState(null);
  const [confirmation, setConfirmation] = useState(null);
  const generation = useRef(0);
  const repository = useMemo(() => {
    try {
      return createLocalRepository({ mode });
    } catch (cause) {
      return {
        snapshot: async () => {
          throw cause;
        },
      };
    }
  }, [mode]);
  const reload = useCallback(async () => {
    const request = ++generation.current;
    const requestMode = mode;
    setLoading(true);
    try {
      const next = await repository.snapshot();
      if (request === generation.current && requestMode === activeMode.current) {
        setData(next);
        setError(null);
      }
    } catch (cause) {
      if (request === generation.current && requestMode === activeMode.current) setError(cause);
    } finally {
      if (request === generation.current && requestMode === activeMode.current) setLoading(false);
    }
  }, [repository, mode]);
  useEffect(() => {
    reload();
    const onStorage = () => reload();
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('storage', onStorage);
    };
  }, [reload]);
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
  const mutate = async (operation, message = 'Alterações salvas.') => {
    await operation(repository);
    const next = await repository.snapshot();
    if (mode !== activeMode.current) return;
    setData(next);
    setAccountId((previous) =>
      next.accounts.some((account) => account.id === previous) ? previous : '',
    );
    setError(null);
    notify(message);
  };
  const switchMode = (value) => {
    activeMode.current = value;
    setEditor(null);
    setConfirmation(null);
    setData(null);
    setAccountId('');
    setMode(value);
  };
  const save = async (entity, values, id, expected) =>
    mutate((repo) =>
      id ? repo.update(entity, id, values, { expected }) : repo.create(entity, values),
    );
  const remove = (entity, row) =>
    setConfirmation({
      title: 'Excluir registro?',
      message: `“${row.description ?? row.name ?? 'Este orçamento'}” será removido. Essa ação não pode ser desfeita.`,
      confirmLabel: 'Excluir registro',
      danger: true,
      action: () =>
        mutate((repo) => repo.remove(entity, row.id, { expected: row }), 'Registro excluído.'),
    });
  return (
    <FinanceContext.Provider
      value={{
        mode,
        switchMode,
        month,
        setMonth,
        accountId,
        setAccountId,
        data,
        error,
        loading,
        reload,
        repository,
        toast,
        setToast,
        notify,
        theme,
        setTheme,
        editor,
        setEditor,
        confirmation,
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
