# E-mail, senha e sessões

## Uso pelo titular

1. Acessar o ambiente informado pelo responsável. QA, development e Production têm identidades independentes.
2. Em **Minha nuvem**, cadastrar-se quando inscrições estiverem autorizadas. Se exigido pelo provedor, a sessão só será emitida após confirmar o e-mail.
3. Em **Verificar meu e-mail**, informar o endereço e o código recebido. Solicitar outro se expirado; a interface aguarda 60 segundos entre reenvios. Esse limite de interface não substitui rate limiting do provedor.
4. Após a confirmação, entrar com senha. A política ensaiada não faz login automático após verificar o e-mail.
5. Para recuperar acesso, usar **Esqueci minha senha**, abrir o link do e-mail e escolher uma senha exclusiva. O link é de uso único. O TTL observado no QA foi 3600 segundos; a interface não promete esse prazo para outros ambientes.

Não encaminhar códigos, senhas, links ou backups ao chat/PR. O token chega no link do provedor e é removido da barra do navegador ao abrir a tela. Logs de hospedagem e ferramentas de suporte precisam tratar URLs com `token` como sensíveis; não exportar requisições brutas de recuperação.

## Política escolhida e testada em QA

- Verificação de titularidade obrigatória, envio por OTP no cadastro e em login de endereço não confirmado.
- `auto_sign_in_after_verification=false`.
- `revoke_sessions_on_password_reset=true`.
- Mudança de senha com `revokeOtherSessions=true` encerra os outros dispositivos.
- **Sair de todos os dispositivos** usa `revokeSessions()` do Neon Auth e encerra a sessão local.
- Nenhuma sessão/senha é colocada no backup JSON.

**Limite importante:** os JWTs financeiros emitidos são stateless. Foi observado HTTP **200** com um JWT emitido antes do logout global, apesar de zero sessões no provedor. A validade observada é 900 segundos, com tolerância de 10 segundos no backend. Revogar sessão impede renovação; não revoga imediatamente esse JWT. A interface informa a janela aproximada. Não prometer encerramento imediato de acessos já autorizados.

Para Production é necessário aceitar explicitamente essa janela ou implementar uma verificação adicional de revogação no servidor e testá-la. Essa decisão integra o GO/NO-GO; o relatório não a toma em nome do responsável.

## Production planejada, ainda não executada

O lançamento proposto é um **piloto fechado**. Manter SSO dos Previews e controle de inscrição no provedor; após o cadastro/aceite do titular aprovado, bloquear novas inscrições (`disable_sign_up=true`). Não anunciar cadastro público antes de revisar abuso, capacidade, suporte e privacidade.

Production deverá exigir verificação antes da primeira sessão, ter localhost desabilitado, apenas as origens de Production na allowlist e SMTP próprio com domínio do responsável. O SMTP compartilhado usado no QA comprovou entrega; ele não substitui a configuração de envio de Production exigida pelo Neon. Preparar remetente e SPF/DKIM/DMARC e validar entrega em caixa controlada após autorização. Não criar billing, domínio ou credenciais SMTP sem autorização.

Alterações de configuração desta revisão ocorreram somente no novo QA. Os usuários de development e do QA anterior não receberam alterações de política ou senha.

## Incidente de acesso

Orientar o titular a redefinir senha e encerrar todos os dispositivos; registrar a janela residual. Em comprometimento ativo, o responsável por infraestrutura deve autorizar contenção do acesso do runtime, considerando também leitura e deployments antigos. Não apagar dados financeiros para resolver autenticação. Usar os procedimentos de [rollback](rollback.md) e [backup](backups.md).
