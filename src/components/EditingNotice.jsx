import { LockKeyhole, Pencil } from 'lucide-react';
import { useFinance } from '../context/FinanceContext';

export default function EditingNotice() {
  const { mode, canWrite, editingAccess, activatingEditing, activateEditing, stopEditing } =
    useFinance();
  if (mode === 'cloud')
    return (
      <section className="editing-notice" aria-label="Edição no banco de dados" role="status">
        <Pencil size={19} aria-hidden="true" />
        <div>
          <strong>{canWrite ? 'Dados protegidos na nuvem' : 'Nuvem em somente leitura'}</strong>
          <p>
            {canWrite
              ? 'Suas alterações são verificadas pelo servidor e salvas no Neon. Conflitos entre sessões exigem recarregar os dados.'
              : 'Confira sua sessão em Minha nuvem ou tente carregar os dados novamente antes de editar.'}
          </p>
        </div>
      </section>
    );
  const descriptions = {
    view: 'Consulte e exporte seus dados livremente. Ativar a edição recarrega a página com os dados atuais e libera criar, alterar ou excluir registros.',
    'other-tab':
      'A edição está ativa em outra aba. Encerre a edição nela ou feche-a e tente ativar aqui.',
    reload:
      'A edição foi encerrada ou esta sessão foi retomada. Ative novamente para conferir os dados atuais.',
    unsupported:
      'A edição segura está indisponível neste navegador. Você pode consultar e exportar os dados; use um navegador atualizado em uma conexão segura para editar.',
    blocked:
      'O navegador bloqueou a edição segura. Confira as permissões de armazenamento antes de tentar novamente.',
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
