# Instalação e revisão do SaldoLab v1.0

Estado: branch `feat/neon-backend-foundation`, PR #3 em draft. Instalar a aplicação não autoriza merge, migração ou deploy Production.

## Interface e modos locais

Requer Node 24 LTS e npm. Python 3.10+ é opcional.

```bash
git clone https://github.com/Tsilveira-dev/saldolab.git
cd saldolab
git switch feat/neon-backend-foundation
npm ci
npm run dev
```

O Vite serve a interface em localhost; demonstração e modo pessoal funcionam sem login. `/api/finance` é uma Vercel Function e não é criada por `npm run dev` ou `npm run preview`.

## Nuvem e ambiente isolado

Cada ambiente tem banco, identidade e URL Auth próprios. Não copiar senhas, sessões ou dados de development para Production. As variáveis de [.env.example](../.env.example) são:

| Variável             | Escopo           | Uso                                          |
| -------------------- | ---------------- | -------------------------------------------- |
| `DATABASE_URL`       | Somente servidor | Conexão pooler do ambiente e role de runtime |
| `NEON_AUTH_BASE_URL` | Servidor         | URL HTTPS de Auth, terminando em `/auth`     |
| `NEON_AUTH_JWKS_URL` | Servidor         | JWKS correspondente ao mesmo Auth            |
| `VITE_NEON_AUTH_URL` | Pública, build   | A mesma Base URL Auth usada no ambiente      |

Nunca prefixar connection strings, senhas ou tokens com `VITE_`. Guardar arquivos privados fora do Git; `.gitignore` e `.vercelignore` excluem `work/` e arquivos `.env*`. Alterar a URL pública Auth exige novo build.

Usar `sslmode=verify-full` nas conexões remotas. Isso explicita a verificação de certificado/hostname e evita o aviso do driver sobre a futura mudança de semântica de `sslmode=require`. O modo sem TLS usado nos túneis de ensaio é restrito ao loopback; a conexão WSS até o Neon valida TLS.

Para desenvolvimento completo com Vercel CLI, conferir primeiro o projeto existente `fair-play7/saldolab` e usar somente configurações QA aprovadas. `vercel dev` fornece Functions locais; não executar `vercel --prod`. Não aceitar vinculação automática a outro projeto. A CLI pode baixar `.env.local`: conferir o escopo e mantê-lo privado antes de iniciar o Vite.

O servidor de ensaio `node tests/neon/server.js` oferece UI e API reais exclusivamente para QA marcado. Exige `SALDOLAB_TEST_DATABASE_URL`, `SALDOLAB_TEST_BRANCH_ID`, `SALDOLAB_TEST_REAL_AUTH=1` e as três URLs Auth correspondentes ao marcador `saldolab_qa.environment`. Valida o marcador antes de aplicar a migração inicial. Não é um servidor de Production.

## Acesso ao Preview protegido

Usar a CLI autenticada no projeto existente ou o header de Trusted Sources `x-vercel-trusted-oidc-idp-token`, restrito à origem exata do Preview. O token local de desenvolvimento do mesmo projeto acessa Preview; não autoriza Production por padrão. Não desativar SSO nem colocar tokens em URLs, comandos publicados, testes versionados ou screenshots.

Nesta revisão a CLI 65.15.0 encaminhou incorretamente `--global-config` para curl. A validação usou o OIDC local em memória e certificado TLS verificado. A credencial de automação criada pela tentativa de `vercel curl` foi revogada; o SSO permaneceu configurado como antes. Não repetir essa tentativa como etapa obrigatória.

## Testes desta etapa

```bash
npx vitest run src/tests/emailVerification.test.jsx
SALDOLAB_TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:55433/saldolab_integration npx vitest run --config vitest.integration.config.js tests/integration/restore.test.js
```

O serviço PostgreSQL 17 local deve ser descartável e acessível apenas em loopback. Para testar um Preview **QA isolado** usar `npm run test:release`, com `SALDOLAB_RELEASE_BASE_URL`, banco/marcador QA, URLs Auth e OIDC carregados de ambiente protegido. A suíte bloqueia requisições para outros hosts Neon Auth, gera identidades fictícias e não grava traces/vídeos/screenshots. A preparação das identidades fictícias verifica o e-mail no SQL para testar sessões; isso não substitui o aceite de e-mail por inbox real.

O ensaio do runtime usou pgwire sobre WSS com TLS validada porque TCP direto ao Neon foi recusado. Fora desse runtime pode-se usar a conexão TLS normal do banco. Não desativar a validação de certificados.

O CI executa regressões para cada novo commit. Os testes aprovados na auditoria anterior permanecem como histórico; não são apresentados como uma validação nova do ambiente publicado.
