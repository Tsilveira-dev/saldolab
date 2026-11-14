import { LockKeyhole } from 'lucide-react';
import { useFinance } from '../context/FinanceContext';

export default function EditingNotice() {
  const { mode, canWrite, editingAccess } = useFinance();
  if (canWrite || (mode !== 'cloud' && editingAccess.reason === 'view')) return null;
  const descriptions = {
    'other-tab': 'Outra aba está alterando suas finanças. Feche-a e recarregue esta página para continuar.',
    reload: 'Recarregue a página para continuar fazendo alterações.',
    unsupported: 'Use um navegador atualizado em HTTPS para salvar com segurança.',
    blocked: 'O navegador bloqueou as alterações. Confira as permissões de armazenamento.',
  };
  return (
    <section className="editing-notice" aria-label="Estado das alterações" role="status">
      <LockKeyhole size={19} aria-hidden="true" />
      <div>
        <strong>Alterações indisponíveis</strong>
        <p>
          {mode === 'cloud'
            ? 'Confira sua conta em Minha conta para continuar.'
            : descriptions[editingAccess.reason] ?? 'Recarregue a página para tentar novamente.'}
        </p>
      </div>
    </section>
  );
}
