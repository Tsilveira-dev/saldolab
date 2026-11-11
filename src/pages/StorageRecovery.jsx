import { useRef, useState } from 'react';
import { AlertTriangle, Download, Upload } from 'lucide-react';
import { useFinance } from '../context/FinanceContext';
import { downloadFile } from '../services/files';
import { parseBackup } from '../repositories/localRepository';
import { InlineError } from '../components/ui';

export default function StorageRecovery() {
  const { error, mode, switchMode, reload, mutate, setConfirmation } = useFinance();
  const [importError, setImportError] = useState('');
  const ref = useRef(null);
  const recover = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      if (file.size > 20_000_000) throw new Error('O backup deve ter no máximo 20 MB.');
      const text = await file.text();
      parseBackup(text);
      setConfirmation({
        title: 'Recuperar com este backup?',
        message:
          'O conteúdo atual será substituído pelo backup validado. Exporte o conteúdo original antes de continuar.',
        confirmLabel: 'Recuperar dados',
        action: () => mutate((repo) => repo.importBackup(text), 'Dados recuperados.'),
      });
    } catch (cause) {
      setImportError(cause.message);
    }
  };
  return (
    <section className="panel recovery-panel">
      <AlertTriangle size={40} />
      <h1>Seus dados precisam de atenção</h1>
      <p>{error.message}</p>
      <InlineError message={importError} />
      <div className="recovery-actions">
        {error.raw !== null && error.raw !== undefined && (
          <button
            className="btn btn-primary"
            onClick={() => downloadFile(error.raw, 'saldolab-conteudo-original.txt', 'text/plain')}
          >
            <Download size={17} />
            Exportar conteúdo original
          </button>
        )}
        <button className="btn btn-outline-secondary" onClick={() => ref.current.click()}>
          <Upload size={17} />
          Importar backup válido
        </button>
        <button className="btn btn-light" onClick={reload}>
          Tentar novamente
        </button>
        <button
          className="btn btn-light"
          onClick={() => switchMode(mode === 'demo' ? 'personal' : 'demo')}
        >
          Abrir outro modo
        </button>
      </div>
      <input
        ref={ref}
        type="file"
        accept=".json"
        onChange={recover}
        aria-label="Backup para recuperação"
        className="visually-hidden"
      />
    </section>
  );
}
