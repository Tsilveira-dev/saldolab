import { useState } from 'react';

// Standard Managed Better Auth password recovery endpoints. No account passwords
// or reset tokens are stored in localStorage, URLs after opening, or application logs.
const authBaseURL = import.meta.env.VITE_NEON_AUTH_URL;

async function recoveryRequest(endpoint, body) {
  if (!authBaseURL) throw new Error('A autenticação não está configurada neste ambiente.');
  let result;
  try {
    const response = await fetch(authBaseURL.replace(/\/$/, '') + endpoint, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
    });
    result = response.ok;
  } catch {
    throw new Error('Não foi possível conectar ao Neon Auth. Confira sua conexão.');
  }
  if (!result) throw new Error('Não foi possível concluir a solicitação. Tente novamente.');
}

export default function PasswordRecovery({ view, token, onBack }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState('');

  async function submit(event) {
    event.preventDefault();
    if (pending) return;
    setError('');
    setPending(true);
    try {
      if (view === 'forgot') {
        await recoveryRequest('/request-password-reset', {
          email: email.trim().toLowerCase(),
          redirectTo: window.location.origin + '/nuvem',
        });
        setSent(true);
      } else {
        if (!token) throw new Error('O link de recuperação está inválido. Solicite outro.');
        if (password.length < 8 || password.length > 128)
          throw new Error('A nova senha deve ter entre 8 e 128 caracteres.');
        if (password !== confirmation) throw new Error('As senhas digitadas não coincidem.');
        await recoveryRequest('/reset-password', { newPassword: password, token });
        setPassword('');
        setConfirmation('');
        setCompleted(true);
      }
    } catch (cause) {
      setError(cause.message ?? 'Não foi possível concluir a solicitação.');
    } finally {
      setPending(false);
    }
  }

  const heading = view === 'forgot' ? 'Esqueci minha senha' : 'Redefinir senha';
  return (
    <section aria-labelledby="password-recovery-title">
      <h2 id="password-recovery-title" className="h5 mb-3">
        {heading}
      </h2>
      {view === 'forgot' && sent ? (
        <div role="status" className="alert alert-success">
          Se esse e-mail estiver cadastrado, você receberá um link de recuperação. Verifique também
          o spam. O link expira em 15 minutos.
        </div>
      ) : view === 'reset' && completed ? (
        <div role="status" className="alert alert-success">
          Senha redefinida. Entre novamente com sua nova senha.
        </div>
      ) : (
        <form onSubmit={submit} className="d-grid gap-3">
          {view === 'forgot' ? (
            <label>
              E-mail da sua conta
              <input
                className="form-control mt-1"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>
          ) : (
            <>
              <label>
                Nova senha
                <input
                  className="form-control mt-1"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  maxLength={128}
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </label>
              <label>
                Confirme a nova senha
                <input
                  className="form-control mt-1"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  maxLength={128}
                  required
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                />
              </label>
            </>
          )}
          <button type="submit" className="btn btn-primary" disabled={pending}>
            {pending
              ? 'Aguarde…'
              : view === 'forgot'
                ? 'Enviar link de recuperação'
                : 'Salvar nova senha'}
          </button>
        </form>
      )}
      {error && (
        <div className="alert alert-danger mt-3" role="alert">
          {error}
        </div>
      )}
      <button type="button" className="btn btn-link mt-2" onClick={onBack} disabled={pending}>
        Voltar ao login
      </button>
    </section>
  );
}
