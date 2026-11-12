import { useRef, useState } from 'react';
import { Download, Upload, RotateCcw, HardDrive, ShieldCheck, Moon, Sun } from 'lucide-react';
import { useFinance } from '../context/FinanceContext';
import { downloadFile } from '../services/files';
import { parseBackup } from '../repositories/localRepository';
import { PageHeading, Panel, InlineError } from '../components/ui';

export default function Settings() {
  const {
    mode,
    switchMode,
    theme,
    setTheme,
    repository,
    mutate,
    notify,
    setConfirmation,
    canWrite,
  } = useFinance();
  const [error, setError] = useState('');
  const inputRef = useRef(null);
  const exportBackup = async () => {
    try {
      downloadFile(await repository.exportBackup(), `saldolab-${mode}-backup.json`);
      notify('Backup exportado. Guarde o arquivo em um local seguro.');
    } catch (cause) {
      setError(cause.message);
    }
  };
  const importFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setError('');
    try {
      if (file.size > 20_000_000) throw new Error('O backup deve ter no máximo 20 MB.');
      const text = await file.text();
      const candidate = parseBackup(text);
      setConfirmation({
        title: 'Substituir os dados deste modo?',
        message: `O backup contém ${candidate.transactions.length} transações, ${candidate.accounts.length} contas, ${candidate.categories.length} categorias e ${candidate.budgets.length} orçamentos. Os dados do modo ${mode === 'demo' ? 'demonstração' : 'pessoal'} serão substituídos. Exporte um backup dos dados atuais antes de continuar.`,
        confirmLabel: 'Importar backup',
        action: () => mutate((repo) => repo.importBackup(text), 'Backup importado com sucesso.'),
      });
    } catch (cause) {
      setError(cause.message);
    }
  };
  const reset = () =>
    setConfirmation({
      title: mode === 'demo' ? 'Restaurar demonstração?' : 'Apagar dados pessoais?',
      message:
        mode === 'demo'
          ? 'As alterações na demonstração serão substituídas pelos dados fictícios originais. Os dados pessoais serão preservados.'
          : 'Todas as suas contas, categorias, transações e orçamentos pessoais serão apagados. Exporte um backup antes de continuar.',
      confirmLabel: mode === 'demo' ? 'Restaurar dados' : 'Apagar dados pessoais',
      danger: true,
      action: () => mutate((repo) => repo.reset(), 'Dados restaurados.'),
    });
  return (
    <>
      <PageHeading
        eyebrow="PREFERÊNCIAS"
        title="Do seu jeito."
        description="Personalize seu espaço e mantenha seus dados por perto."
      />
      <InlineError message={error} />
      <div className="settings-grid">
        <Panel title="Seu espaço" subtitle="Dois modos, dados separados">
          <div className="settings-body">
            <div className="mode-options">
              {[
                ['demo', 'Demonstração', 'Explore dados fictícios e experimente todas as funções.'],
                ['personal', 'Pessoal', 'Comece do zero e organize suas próprias finanças.'],
                ...(import.meta.env.VITE_NEON_AUTH_URL
                  ? [['cloud', 'Nuvem', 'Acesse os dados da sua conta autenticada.']]
                  : []),
              ].map(([value, title, description]) => (
                <label className={`mode-option ${mode === value ? 'selected' : ''}`} key={value}>
                  <input
                    type="radio"
                    name="mode"
                    value={value}
                    checked={mode === value}
                    onChange={() => switchMode(value)}
                  />
                  <span>
                    <strong>{title}</strong>
                    <small>{description}</small>
                  </span>
                </label>
              ))}
            </div>
            <div className="setting-divider" />
            <h3>Aparência</h3>
            <div className="appearance-buttons">
              <button
                className={`btn ${theme === 'light' ? 'btn-primary' : 'btn-light'}`}
                aria-pressed={theme === 'light'}
                onClick={() => setTheme('light')}
              >
                <Sun size={17} />
                Claro
              </button>
              <button
                className={`btn ${theme === 'dark' ? 'btn-primary' : 'btn-light'}`}
                aria-pressed={theme === 'dark'}
                onClick={() => setTheme('dark')}
              >
                <Moon size={17} />
                Escuro
              </button>
            </div>
          </div>
        </Panel>
        <Panel title="Backup e portabilidade" subtitle="Seus dados continuam sendo seus">
          <div className="settings-body">
            <span className="settings-large-icon">
              <HardDrive size={25} />
            </span>
            <h3>
              {mode === 'cloud' ? 'Salvo no Neon PostgreSQL' : 'Salvo apenas neste navegador'}
            </h3>
            <p>
              {mode === 'cloud'
                ? 'Seus registros estão vinculados à sua conta no Neon. Você pode exportar um backup JSON; a importação remota ainda não está disponível.'
                : 'Esta versão utiliza armazenamento local. Os registros não são sincronizados entre dispositivos e podem ser perdidos ao limpar os dados do navegador.'}
            </p>
            <div className="backup-buttons">
              <button className="btn btn-primary" onClick={exportBackup}>
                <Download size={16} />
                Exportar backup JSON
              </button>
              <button
                className="btn btn-outline-secondary"
                disabled={!canWrite || mode === 'cloud'}
                onClick={() => inputRef.current.click()}
              >
                <Upload size={16} />
                Importar backup
              </button>
            </div>
            <input
              ref={inputRef}
              aria-label="Arquivo de backup JSON"
              type="file"
              disabled={!canWrite || mode === 'cloud'}
              accept=".json,application/json"
              className="visually-hidden"
              onChange={importFile}
            />
            <p className="settings-footnote">
              <ShieldCheck size={16} />O arquivo é validado antes de substituir os dados.
            </p>
          </div>
        </Panel>
        <Panel
          title={
            mode === 'demo'
              ? 'Restaurar demonstração'
              : mode === 'cloud'
                ? 'Ações remotas protegidas'
                : 'Limpar dados pessoais'
          }
          subtitle={
            mode === 'demo'
              ? 'Um novo começo para explorar'
              : mode === 'cloud'
                ? 'Exclusão total indisponível'
                : 'Operação permanente no modo pessoal'
          }
          className="full-width"
        >
          <div className="settings-reset">
            <p>
              {mode === 'demo'
                ? 'Restaure as contas e movimentações fictícias para o estado original.'
                : mode === 'cloud'
                  ? 'Por segurança, a exclusão completa dos dados na nuvem está desabilitada nesta versão.'
                  : 'Remova todos os registros pessoais deste navegador. Faça um backup primeiro.'}
            </p>
            <button
              className="btn btn-outline-danger"
              onClick={reset}
              disabled={!canWrite || mode === 'cloud'}
            >
              <RotateCcw size={16} />
              {mode === 'demo' ? 'Restaurar demonstração' : 'Apagar dados pessoais'}
            </button>
          </div>
        </Panel>
      </div>
    </>
  );
}
