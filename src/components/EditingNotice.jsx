import { LockKeyhole } from 'lucide-react';
import { useFinance } from '../context/FinanceContext';

export default function EditingNotice() {
  const { mode, canWrite, editingAccess } = useFinance();
  if (canWrite) return null;
  if (mode !== 'cloud' && editingAccess.reason === 'view') return null;

  let message = 'Recarregue a página para tentar novamente.';
  if (mode === 'cloud') {
    message = 'Confira sua conta em Minha conta para continuar.';
  } else if (editingAccess.reason === 'other-tab') {
    message = 'Outra aba está alterando suas finanças. Feche-a e recarregue esta página.';
  } else if (editingAccess.reason === 'unsupported') {
    message = 'Use um navegador atualizado em HTTPS para salvar com segurança.';
  } else if (editingAccess.reason === 'blocked') {
    message = 'O navegador bloqueou as alterações. Confira as permissões de armazenamento.';
  }

  return (
    <section className="editing-notice" aria-label="Estado das alterações" role="status">
      <LockKeyhole size={19} aria-hidden="true" />
      <div>
        <strong>Alterações indisponíveis</strong>
        <p>{message}</p>
      </div>
    </section>
  );
}
