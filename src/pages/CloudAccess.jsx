import { useEffect, useState } from 'react';
import { Cloud, LogIn, LogOut } from 'lucide-react';
import { useFinance } from '../context/FinanceContext';
import { authClient, authClientConfigurationError } from '../auth/neonClient';

export default function CloudAccess() {
  const { mode, switchMode, reload } = useFinance();
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(Boolean(authClient));
  const [submitting, setSubmitting] = useState(false);
  const [signUp, setSignUp] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!authClient) return;
    let active = true;
    authClient
      .getSession()
      .then((result) => {
        if (active) {
          setUser(result.data?.user ?? null);
          setError(result.error?.message ?? '');
        }
      })
      .catch(() => {
        if (active) setError('Não foi possível consultar a sessão.');
      })
      .finally(() => {
        if (active) setChecking(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function submit(event) {
    event.preventDefault();
    if (!authClient) return;
    setSubmitting(true);
    setError('');
    try {
      const credentials = signUp
        ? { name: name.trim(), email: email.trim(), password }
        : { email: email.trim(), password };
      const result = signUp
        ? await authClient.signUp.email(credentials)
        : await authClient.signIn.email(credentials);
      if (result.error) throw new Error(result.error.message);
      const session = await authClient.getSession();
      if (session.error || !session.data?.user)
        throw new Error('Confirme o e-mail, se necessário, e entre novamente.');
      setUser(session.data.user);
      setPassword('');
    } catch (cause) {
      setError(cause.message ?? 'Não foi possível autenticar.');
    } finally {
      setSubmitting(false);
    }
  }

  async function signOut() {
    setSubmitting(true);
    setError('');
    try {
      if (mode === 'cloud') switchMode('personal');
      const result = await authClient.signOut();
      if (result.error) throw new Error(result.error.message);
      setUser(null);
    } catch (cause) {
      setError(cause.message);
    } finally {
      setSubmitting(false);
    }
  }

  function openCloud() {
    switchMode('cloud');
    if (mode === 'cloud') reload();
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
            {authClientConfigurationError ?? 'A conexão ainda não foi configurada neste ambiente. O modo local continua disponível.'}
          </div>
        ) : checking ? (
          <div role="status">Conferindo sua sessão…</div>
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
              <button className="btn btn-outline-secondary" onClick={signOut} disabled={submitting}>
                <LogOut size={16} className="me-2" /> Sair da conta
              </button>
            </div>
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
      </div>
    </div>
  );
}
