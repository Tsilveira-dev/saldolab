import { useEffect, useState } from 'react';
import { Cloud, LogIn, LogOut } from 'lucide-react';
import { useFinance } from '../context/FinanceContext';
import { authClient, authClientConfigurationError } from '../auth/neonClient';
import PasswordRecovery from './PasswordRecovery';
import EmailVerification from './EmailVerification';
import { useCloudSession } from '../auth/useCloudSession';

export default function CloudAccess() {
  const { mode, switchMode, reload } = useFinance();
  const { data: session, isPending: checking } = useCloudSession();
  const user = session?.user ?? null;
  const [submitting, setSubmitting] = useState(false);
  const [signUp, setSignUp] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [verificationView, setVerificationView] = useState(false);
  const [resetToken] = useState(() => new URLSearchParams(window.location.search).get('token'));
  const [resetError] = useState(() => new URLSearchParams(window.location.search).get('error'));
  const [recoveryView, setRecoveryView] = useState(() =>
    resetToken || resetError ? 'reset' : null,
  );

  useEffect(() => {
    if (!resetToken && !resetError) return;
    // Keep one-time password reset tokens out of subsequent URLs and screenshots.
    window.history.replaceState(window.history.state, '', window.location.pathname);
  }, [resetToken, resetError]);

  async function submit(event) {
    event.preventDefault();
    if (!authClient) return;
    setSubmitting(true);
    setError('');
    setMessage('');
    // Entering a cloud identity is an explicit choice of the cloud workspace.
    // The browser's independent personal data must not appear under that login.
    switchMode('cloud');
    try {
      const credentials = signUp
        ? { name: name.trim(), email: email.trim(), password }
        : { email: email.trim(), password };
      const result = signUp
        ? await authClient.signUp.email(credentials)
        : await authClient.signIn.email(credentials);
      if (result.error)
        throw Object.assign(new Error(result.error.message), { code: result.error.code });
      if (signUp && result.data?.user && !result.data.user.emailVerified && !result.data.token) {
        setPassword('');
        setVerificationView(true);
        return;
      }
      const session = await authClient.getSession();
      if (session.error || !session.data?.user)
        throw new Error('Confirme o e-mail, se necessário, e entre novamente.');
      if (result.data?.user?.id && session.data.user.id !== result.data.user.id)
        throw new Error('A conta conectada mudou. Atualize a página e entre novamente.');
      setPassword('');
    } catch (cause) {
      if (
        ['EMAIL_NOT_VERIFIED', 'EMAIL_NOT_CONFIRMED'].includes(String(cause.code).toUpperCase())
      ) {
        setPassword('');
        setVerificationView(true);
      }
      setError(cause.message ?? 'Não foi possível autenticar.');
    } finally {
      setSubmitting(false);
    }
  }

  async function signOut(everywhere = false) {
    setSubmitting(true);
    setError('');
    try {
      // Stay in the cloud workspace without a session; local data belongs to the
      // browser, not to the next email that signs in. Never reset either store.
      switchMode('cloud');
      if (everywhere) {
        const revoked = await authClient.revokeSessions();
        if (revoked.error)
          throw new Error('Não foi possível encerrar todas as sessões. Tente novamente.');
      }
      const result = await authClient.signOut();
      if (result.error) throw new Error(result.error.message);
    } catch (cause) {
      setError(cause.message);
    } finally {
      setSubmitting(false);
    }
  }

  function openCloud() {
    if (mode === 'cloud') reload();
    else switchMode('cloud');
  }

  return (
    <div className="mx-auto" style={{ maxWidth: 640 }}>
      <div className="panel p-4">
        <div className="d-flex gap-2 align-items-center mb-3">
          <Cloud size={24} />
          <h1 className="h4 m-0">SaldoLab na nuvem</h1>
        </div>
        <p className="text-secondary">
          Dados pessoais protegidos em PostgreSQL, separados da demonstração e do armazenamento
          local. O acesso à nuvem não envia automaticamente seus backups.
        </p>
        {!authClient ? (
          <div role="status" className="alert alert-info">
            {authClientConfigurationError ??
              'A conexão ainda não foi configurada neste ambiente. O modo local continua disponível.'}
          </div>
        ) : checking ? (
          <div role="status">Conferindo sua sessão…</div>
        ) : recoveryView ? (
          <PasswordRecovery
            view={recoveryView}
            token={resetToken}
            onBack={() => {
              setRecoveryView(null);
              setError('');
            }}
          />
        ) : verificationView ? (
          <EmailVerification
            initialEmail={email}
            onBack={() => {
              setVerificationView(false);
              setSignUp(false);
              setError('');
            }}
            onVerified={() => {
              setVerificationView(false);
              setSignUp(false);
              setError('');
              setMessage('E-mail confirmado. Entre com sua senha.');
            }}
          />
        ) : user ? (
          <div>
            <p>
              Conectado como <strong>{user.email}</strong>.
            </p>
            <div className="d-flex gap-2 flex-wrap">
              <button className="btn btn-primary" onClick={openCloud} disabled={submitting}>
                <Cloud size={16} className="me-2" />{' '}
                {mode === 'cloud' ? 'Atualizar dados' : 'Abrir finanças na nuvem'}
              </button>
              <button
                className="btn btn-outline-secondary"
                onClick={() => signOut()}
                disabled={submitting}
              >
                <LogOut size={16} className="me-2" /> Sair da conta
              </button>
              <button
                className="btn btn-outline-secondary"
                onClick={() => signOut(true)}
                disabled={submitting}
              >
                Sair de todos os dispositivos
              </button>
            </div>
            <p className="text-secondary small mt-3">
              Ao encerrar uma sessão, os próximos acessos aos dados na nuvem exigem uma sessão
              ativa. Sair de todos os dispositivos encerra todas as sessões dessa conta.
            </p>
          </div>
        ) : (
          <form onSubmit={submit} className="d-grid gap-3">
            <h2 className="h5">{signUp ? 'Criar conta' : 'Entrar na minha conta'}</h2>
            {signUp && (
              <label>
                Seu nome
                <input
                  className="form-control mt-1"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  required
                  minLength={2}
                  maxLength={100}
                  autoComplete="name"
                />
              </label>
            )}
            <label>
              E-mail
              <input
                className="form-control mt-1"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                autoComplete="email"
              />
            </label>
            <label>
              Senha
              <input
                className="form-control mt-1"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                minLength={8}
                autoComplete={signUp ? 'new-password' : 'current-password'}
              />
            </label>
            <button className="btn btn-primary" disabled={submitting} type="submit">
              <LogIn size={16} className="me-2" />
              {submitting ? 'Aguarde…' : signUp ? 'Criar conta' : 'Entrar'}
            </button>
            {!signUp && (
              <button
                className="btn btn-link"
                type="button"
                onClick={() => {
                  setRecoveryView('forgot');
                  setError('');
                }}
              >
                Esqueci minha senha
              </button>
            )}
            <button
              className="btn btn-link"
              type="button"
              onClick={() => {
                setVerificationView(true);
                setError('');
              }}
            >
              Verificar meu e-mail
            </button>
            <button
              className="btn btn-link"
              type="button"
              onClick={() => {
                setSignUp(!signUp);
                setError('');
              }}
            >
              {signUp ? 'Já tenho uma conta' : 'Quero criar uma conta'}
            </button>
          </form>
        )}
        {error && (
          <div className="alert alert-danger mt-3" role="alert">
            {error}
          </div>
        )}
        {message && (
          <div role="status" className="alert alert-success mt-3">
            {message}
          </div>
        )}
      </div>
    </div>
  );
}
