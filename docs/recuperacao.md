# E-mail, senha e sessões

## Uso pelo titular

1. Acessar o ambiente informado pelo responsável. QA, development e Production têm identidades independentes.
2. Em **Minha nuvem**, cadastrar-se quando inscrições estiverem autorizadas. Se exigido pelo provedor, a sessão só será emitida após confirmar o e-mail.
3. Em **Verificar meu e-mail**, informar o endereço e o código recebido. Solicitar outro se expirado; a interface aguarda 60 segundos entre reenvios. Esse limite de interface não substitui rate limiting do provedor.
4. Após a confirmação, entrar com senha. A política ensaiada não faz login automático após verificar o e-mail. O envio de login/cadastro seleciona o espaço nuvem; sair permanece nesse espaço sem sessão. Dados locais só reaparecem ao escolher explicitamente o modo pessoal e não pertencem ao e-mail autenticado.
5. Para recuperar acesso, usar **Esqueci minha senha**, abrir o link do e-mail e escolher uma senha exclusiva. O link é de uso único. O TTL observado no QA foi 3600 segundos; a interface não promete esse prazo para outros ambientes.

Não encaminhar códigos, senhas, links ou backups ao chat/PR. O token chega no link do provedor e é removido da barra do navegador ao abrir a tela. Logs de hospedagem e ferramentas de suporte precisam tratar URLs com `token` como sensíveis; não exportar requisições brutas de recuperação.

## Política escolhida e testada em QA

- Verificação de titularidade obrigatória, envio por OTP no cadastro e em login de endereço não confirmado.
- `auto_sign_in_after_verification=false`.
- `revoke_sessions_on_password_reset=true`.
- Mudança de senha com `revokeOtherSessions=true` encerra os outros dispositivos e, no QA observado, rotaciona a sessão atual: as credenciais anteriores dela também são recusadas e o dispositivo recebe uma nova sessão.
- **Sair de todos os dispositivos** usa `revokeSessions()` do Neon Auth e encerra a sessão local.
- Nenhuma sessão/senha é colocada no backup JSON.

## Validação adicional da sessão na API

O JWT atual de `@neon/auth@0.8.2` tem validade de 900 segundos, sem claim `sid`, `sessionId` ou `jti`. A consulta `/get-session` com Bearer JWT, sem cookie, não introspecta essa autorização. Nas versões anteriores a `ca9e3cc`, foi observado HTTP **200** com JWT anterior ao logout global, apesar de zero sessões no provedor. Essa evidência histórica permanece válida para os builds antigos.

A partir desta revisão, cada requisição financeira exige **JWT EdDSA válido + `X-SaldoLab-Session-Id`** obtido de `authClient.getSession().data.session.id`. O ID opaco é uma credencial adicional e só é aceito para o mesmo sujeito do JWT. A função SQL `saldolab_session_active` verifica existência e validade da sessão em cada transação, sem cache positivo. A role de runtime tem apenas EXECUTE nessa função booleana, sem leitura direta de Auth. Banco/função/grant indisponíveis impedem o acesso; não existe fallback stateless.

Após o provedor persistir a revogação, os próximos pedidos com **o par JWT/sessão anterior** devem receber 401, inclusive após outro login. Os testes negativos cobrem logout individual, logout global, reset e os dois dispositivos após mudança de senha com `revokeOtherSessions=true`. No QA essa mudança emitiu uma nova sessão para o dispositivo atual; o par antigo recebeu 401 e o novo recebeu 200. A continuidade do dispositivo não significa manter a credencial anterior.

**Limites:** a assinatura do JWT continua válida até `exp` (+10s de tolerância); o novo controle não revoga criptograficamente o JWT no Neon ou em outros serviços. JWTs de duas sessões do mesmo usuário podem ser idênticos no mesmo segundo. Uma nova sessão ativa é uma nova credencial legítima, não é rejeitada porque reutiliza os mesmos bytes de JWT. O controle não cancela operações em andamento já autorizadas nem remove arquivos já baixados. Não registrar/exportar o identificador opaco junto com JWTs. A comprovação publicada e o estado PASS/FAIL estão no [relatório final](lancamento-v1.md).

Antes de Production, aplicar `0002_active_session_authorization.sql` após habilitar Auth, restringir EXECUTE e validar a role mínima. Manter os serviços/deployments antigos sem acesso às credenciais Production; não fazer rollback para uma API que só confira JWT. A garantia vale para a API nova, não para endpoints antigos ainda disponíveis no QA.

## Production planejada, ainda não executada

O lançamento proposto é um **piloto fechado**. Manter SSO dos Previews e controle de inscrição no provedor; após o cadastro/aceite do titular aprovado, bloquear novas inscrições (`disable_sign_up=true`). Não anunciar cadastro público antes de revisar abuso, capacidade, suporte e privacidade.

Production deverá exigir verificação antes da primeira sessão, ter localhost desabilitado, apenas as origens de Production na allowlist e SMTP próprio com domínio do responsável. O SMTP compartilhado usado no QA comprovou entrega; ele não substitui a configuração de envio de Production exigida pelo Neon. Preparar remetente e SPF/DKIM/DMARC e validar entrega em caixa controlada após autorização. Não criar billing, domínio ou credenciais SMTP sem autorização.

Alterações de configuração desta revisão ocorreram somente no novo QA. Os usuários de development e do QA anterior não receberam alterações de política ou senha.

## Incidente de acesso

Orientar o titular a redefinir senha e encerrar todos os dispositivos; conferir que pedidos novos das sessões anteriores falham na API. Em comprometimento ativo, o responsável por infraestrutura deve autorizar contenção do acesso do runtime, considerando também leitura e deployments antigos. Não apagar dados financeiros para resolver autenticação. Usar os procedimentos de [rollback](rollback.md) e [backup](backups.md).
