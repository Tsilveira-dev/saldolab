import { useEffect, useState } from 'react';
import { authClient } from '../auth/neonClient';

export default function EmailVerification({ initialEmail, onBack, onVerified }) {
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState('');
  const [pending, setPending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  useEffect(() => {
    if (!cooldown) return;
    const timer = setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);
  async function send() {
    setPending(true);
    setError('');
    try {
      const result = await authClient.emailOtp.sendVerificationOtp({
        email: email.trim().toLowerCase(),
        type: 'email-verification',
      });
      if (result.error) throw new Error();
      setSent(true);
      setCooldown(60);
    } catch {
      setError('Não foi possível solicitar o código. Aguarde e tente novamente.');
    } finally {
      setPending(false);
    }
  }
  async function verify(event) {
    event.preventDefault();
    setPending(true);
    setError('');
    try {
      const result = await authClient.emailOtp.verifyEmail({
        email: email.trim().toLowerCase(),
        otp: code.trim(),
      });
      if (result.error) throw new Error();
      setCode('');
      onVerified();
    } catch {
      setCode('');
      setError('Não foi possível confirmar. Confira o código recebido ou solicite outro.');
    } finally {
      setPending(false);
    }
  }
  return (
    <section aria-labelledby="email-verification-title">
      <h2 id="email-verification-title" className="h5">
        Verificar meu e-mail
      </h2>
      <p>
        Use o código enviado ao seu e-mail para confirmar que ele pertence a você. Depois, entre com
        sua senha.
      </p>
      <form className="d-grid gap-3" onSubmit={verify}>
        <label>
          E-mail para verificar
          <input
            className="form-control mt-1"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        <label>
          Código de verificação
          <input
            className="form-control mt-1"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            minLength={6}
            maxLength={6}
            required
            value={code}
            onChange={(event) => setCode(event.target.value)}
          />
        </label>
        <button className="btn btn-primary" disabled={pending} type="submit">
          {pending ? 'Aguarde…' : 'Confirmar e-mail'}
        </button>
        <button
          className="btn btn-outline-secondary"
          type="button"
          disabled={pending || cooldown > 0 || !email.trim()}
          onClick={send}
        >
          {cooldown ? `Solicitar outro código em ${cooldown}s` : 'Enviar código de verificação'}
        </button>
      </form>
      {sent && (
        <p role="status" className="alert alert-info mt-3">
          Se esse e-mail precisar de confirmação, você receberá um código. Verifique também o spam.
        </p>
      )}
      {error && (
        <p role="alert" className="alert alert-danger mt-3">
          {error}
        </p>
      )}
      <button className="btn btn-link mt-2" type="button" onClick={onBack} disabled={pending}>
        Voltar ao login
      </button>
    </section>
  );
}
