import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import EmailVerification from '../pages/EmailVerification';
import { authClient } from '../auth/neonClient';

vi.mock('../auth/neonClient', () => ({
  authClient: { emailOtp: { sendVerificationOtp: vi.fn(), verifyEmail: vi.fn() } },
}));
beforeEach(() => {
  authClient.emailOtp.sendVerificationOtp.mockReset();
  authClient.emailOtp.verifyEmail.mockReset();
});
describe('verificação de titularidade de e-mail', () => {
  it('confirma o código pelo SDK e só anuncia sucesso após a resposta', async () => {
    authClient.emailOtp.verifyEmail.mockResolvedValue({ data: { status: true } });
    const verified = vi.fn();
    render(
      <EmailVerification initialEmail="qa@example.com" onBack={() => {}} onVerified={verified} />,
    );
    await userEvent.setup().type(screen.getByLabelText('Código de verificação'), '123456');
    await userEvent.setup().click(screen.getByRole('button', { name: 'Confirmar e-mail' }));
    await waitFor(() => expect(verified).toHaveBeenCalledOnce());
    expect(authClient.emailOtp.verifyEmail).toHaveBeenCalledWith({
      email: 'qa@example.com',
      otp: '123456',
    });
    expect(screen.getByLabelText('Código de verificação')).toHaveValue('');
  });
  it('recusa código inválido sem divulgar resposta privada do provedor', async () => {
    authClient.emailOtp.verifyEmail.mockRejectedValue(new Error('private provider detail'));
    const verified = vi.fn();
    render(
      <EmailVerification initialEmail="qa@example.com" onBack={() => {}} onVerified={verified} />,
    );
    await userEvent.setup().type(screen.getByLabelText('Código de verificação'), '123456');
    await userEvent.setup().click(screen.getByRole('button', { name: 'Confirmar e-mail' }));
    await expect(screen.findByRole('alert')).resolves.toHaveTextContent(
      'Não foi possível confirmar',
    );
    expect(verified).not.toHaveBeenCalled();
    expect(screen.queryByText('private provider detail')).toBeNull();
  });
  it('envia solicitação neutra e limita reenvios na interface', async () => {
    authClient.emailOtp.sendVerificationOtp.mockResolvedValue({ data: { success: true } });
    render(
      <EmailVerification initialEmail="qa@example.com" onBack={() => {}} onVerified={() => {}} />,
    );
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Enviar código de verificação' }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Solicitar outro código em/ })).toBeDisabled(),
    );
    expect(screen.getByRole('status')).toHaveTextContent('Se esse e-mail precisar de confirmação');
  });
});
