import { LockKeyhole, Pencil } from 'lucide-react';
import { useFinance } from '../context/FinanceContext';

export default function EditingNotice() {
  const { mode, canWrite, editingAccess, activatingEditing, activateEditing, stopEditing } =
    useFinance();
  // Successful cloud sessions do not need to expose storage implementation details.
  if (mode === 'cloud')
    return canWrite ? null : (
      <section className="editing-notice" aria-label="Permissão de edição" role="status">
        <LockKeyhole size={19} aria-hidden="true" />
        <div>
          <strong>Não foi possível editar agora</strong>
          <p>Confira sua conta em Minha conta e atualize a página.</p>
        </div>
      </section>
    );
  const descriptions = {
    view: 'Para salvar seus lançamentos, habilite as alterações nesta aba.',
    'other-tab': 'As alterações estão abertas em outra aba. Feche-a para continuar.',
    reload: 'Habilite as alterações novamente para continuar.',
    unsupported: 'Este navegador não permite alterações seguras. Use um navegador atualizado.',
    blocked: 'O navegador bloqueou as alterações. Confira as permissões.',
  };
  return (
    <section className="editing-notice" aria-label="Permissão de edição">
      {canWrite ? (
        <Pencil size={19} aria-hidden="true" />
      ) : (
        <LockKeyhole size={19} aria-hidden="true" />
      )}
      <div role="status">
        <strong>{canWrite ? 'Edição ativa nesta aba' : 'Somente leitura'}</strong>
        <p>
          {canWrite
            ? 'As outras abas continuam disponíveis para consulta. Encerre a edição para liberar outra aba.'
            : descriptions[editingAccess.reason]}
        </p>
      </div>
      <button
        className="btn btn-light"
        disabled={activatingEditing || !editingAccess.supported}
        onClick={canWrite ? stopEditing : activateEditing}
      >
        {activatingEditing ? 'Ativando…' : canWrite ? 'Encerrar edição' : 'Ativar edição'}
      </button>
    </section>
  );
}
