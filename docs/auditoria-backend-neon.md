# SaldoLab — auditoria do backend Neon, PR #3

> Histórico da auditoria anterior, preservado. A preparação de lançamento e as novas evidências do Preview, e-mail, sessões e restauração estão em [lançamento v1.0](lancamento-v1.md). A rodada final acrescentou checagem de sessão ativa na API e a migração `0002`; a descrição stateless abaixo documenta a implementação antiga, não a política atual. Continuidade operacional no [guia sem Codex](guia-lancamento-sem-codex.md).

Data: 12/11/2026, America/Sao_Paulo. Repositório `Tsilveira-dev/saldolab`, branch exclusiva `feat/neon-backend-foundation`. Base da revisão: `0e4b26c`. [PR #3](https://github.com/Tsilveira-dev/saldolab/pull/3).

**Resultado: fundação validada em ambiente isolado e preparada para revisão técnica. O merge permanece condicionado aos gates externos abaixo; PR mantido como draft.** As execuções locais usam a API real, PostgreSQL 17 real e, na suíte Neon, Auth/JWKS/SQL reais. Não foi feito merge nem publicação em Production.

## Ambiente e preservação

| Ambiente                                          | Uso nesta revisão                                 | Evidência                                                                                                      |
| ------------------------------------------------- | ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Git `main`                                        | Apenas conferência do ref                         | Permanece `c8855b0f7e3e1d7c0fab555d78e041eda6246883`                                                           |
| PR #2, `fix/csv-contraste`                        | Apenas conferência do ref; sem integração         | Permanece `b637c8586b5dc1022488bb742ce76f444efb17f4`                                                           |
| Neon `main`, `br-patient-forest-bcfzjc39`         | Consultas de metadados somente leitura            | Zero tabelas financeiras; nenhuma migração executada                                                           |
| Neon `development`, `br-wandering-mouse-bc0u10oc` | Apenas agregados somente leitura                  | 1 usuário, 1 conta, soma inicial 100000 centavos, 0 categorias/transações/orçamentos; mesma evidência anterior |
| Neon QA, `br-plain-firefly-bcycj9zj`              | Migração inicial, Auth e fixtures desta auditoria | Branch `qa-pr3-20261112-auth-crud`, criada a partir da `main` vazia, sem copiar o usuário de development       |
| PostgreSQL Docker local                           | Integração repetível e injeção de falhas          | PostgreSQL 17, banco `saldolab_integration`, porta restrita a loopback                                         |
| Preview Vercel                                    | Tentativa de leitura                              | SSO/302; integração Vercel retorna 404 para o projeto na equipe correta. Smoke atual bloqueado                 |

A suíte exige `SALDOLAB_TEST_DATABASE_URL` e nunca usa `DATABASE_URL` como fallback. Um destino remoto precisa do marcador `saldolab_qa.environment`, com branch e URLs Auth correspondentes. A conferência ocorre antes de migrações ou cadastro. As credenciais e cookies ficam fora do Git; usuários fictícios são gerados em memória, sem traces, vídeos ou screenshots na suíte Neon. A branch QA foi preservada para reprodução; sua remoção exige decisão separada.

O runtime recusou TCP direto ao Neon. A execução usou `pg` por um túnel temporário pgwire/WebSocket com TLS verificada até o Neon, pelo proxy do ambiente. Apenas o trecho de loopback é sem TLS. Não houve desativação de verificação de certificado nem mudança do driver de produção. O frontend local recebeu somente a URL pública do Auth de QA.

## Problemas reproduzidos e correções

| Problema antes da correção                                               | Reprodução                                                                           | Correção / resultado                                                                                                                               |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| JWT assinado sem `exp` aceito                                            | HTTP 200 em teste negativo com assinatura EdDSA válida                               | `requiredClaims: ['sub', 'exp']`; agora 401                                                                                                        |
| Categoria mudava de tipo entre a validação e o INSERT                    | Pausa controlada antes do INSERT real permitia PATCH 200 e vínculo incompatível      | `FOR SHARE` na categoria até o commit; edição concorrente aguarda e recebe 409                                                                     |
| Outra aba mantinha dados e gravação aparentes após logout                | Conta fictícia antiga visível e botão de adicionar ativo                             | Assinatura do store de sessão do SDK, dados vinculados ao usuário, descarte de respostas antigas e fechamento/ocultação de editores e confirmações |
| Encerramento de conexão ociosa gerava erro não tratado                   | `pg_terminate_backend` somente nas conexões da API de testes: erro 57P01 não tratado | Listener do pool registra apenas código/nome; próxima requisição recria conexão e retorna 200                                                      |
| Falha do JWKS confundida com sessão inválida                             | Serviço HTTPS de chaves retorna 503                                                  | API diferencia indisponibilidade 503 de JWT inválido 401, com mensagem segura                                                                      |
| Erros remotos perdiam status HTTP e falha de rede exibia mensagem nativa | Conflito e interrupção de requisição no navegador                                    | `RemoteApiError` preserva status, mensagem de rede em português, sem toast de sucesso                                                              |
| Recuperação prometia expiração de 15 minutos                             | Provedor QA emitiu token de recuperação com TTL de 3600 segundos                     | Texto informa validade limitada; expiração e uso único verificados no serviço real                                                                 |
| Documento anterior falhava no Prettier                                   | `npm run check` interrompia em `docs/preview-vercel-neon.md`                         | Formatação corrigida                                                                                                                               |

O SDK `@neon/auth` **0.8.2** injeta o JWT do header `set-auth-jwt` em `getSession().data.session.token`. O token original obtido dessa maneira teve assinatura, algoritmo EdDSA, emissor e audiência conferidos no JWKS real e foi aceito pela API. O JWT observado tem TTL de **900 segundos**. Preservou-se esse contrato; não se presumiu que o token de sessão seria opaco nem que `token().data.token` seria o formato dessa versão.

## Matriz de validação

| Cenário                                                           | Resultado                      | Evidência reproduzível                                                                                                                                                                     |
| ----------------------------------------------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| CRUD de contas, categorias, transações e orçamentos               | PASS                           | HTTP/SQL real no Docker e no Neon; retorno, revisão e ausência após DELETE conferidos                                                                                                      |
| Nenhum sucesso antes do commit                                    | PASS                           | Trigger adiado provoca falhas reais 23514/XX000 no COMMIT; respostas 422/500, zero linhas gravadas, erro sem SQL/detalhes privados                                                         |
| Saldo, receitas, despesas, pendências e transferências            | PASS                           | Inicial 100000 + receita 250000 − despesa 75000 = saldo 275000; transferência 20000: origem 255000, destino 20000; orçamento 75%; pendência 12345 não altera saldo                         |
| Centavos, datas e referências                                     | PASS                           | Inteiros/date-only preservados; frações, limites inválidos, data inexistente, categoria incompatível e referências alheias rejeitados                                                      |
| Orçamento duplicado / exclusão em uso                             | PASS                           | 409 e registros preservados; FKs reais testadas também sem passar pela validação da API                                                                                                    |
| Isolamento A ↔ B                                                  | PASS                           | Dois usuários reais novos; listas não contêm dados alheios, GET/PATCH/DELETE de IDs alheios retornam 404; referência alheia retorna 422                                                    |
| Concorrência nas quatro entidades                                 | PASS                           | Duas abas recebem 200/409; SQL confirma revisão 2 e conteúdo vencedor; DELETE com revisão antiga retorna 409                                                                               |
| Conflito no formulário                                            | PASS                           | Mensagem 409 visível, editor permanece aberto e nenhuma confirmação de sucesso; vencedor persistido                                                                                        |
| Reload e novo login                                               | PASS                           | Cadastro pela UI, reload, logout/login e leitura SQL confirmam saldo inicial de 100000                                                                                                     |
| Troca de conta e logout entre abas                                | PASS                           | Dados antigos e formulário aberto desaparecem; acesso de B não exibe dados de A; respostas/leitura e escrita atrasadas também têm testes unitários                                         |
| JWT inválido, expirado, emissor/audiência errados e sem expiração | PASS                           | Verificação criptográfica real em HTTPS/PostgreSQL; JWT Neon real também rejeitado com relógio do verificador após `exp`                                                                   |
| Sessão expirada no provedor                                       | PASS com escopo explícito      | Apenas sessão do usuário fictício expirada no SQL de QA, cache de cookie removido e página recarregada; login exigido e dados indisponíveis                                                |
| Recuperação de senha                                              | PASS técnico / entrega BLOCKED | Solicitação real, token de QA obtido privadamente da tabela de verificações, token expirado recusado, nova senha aceita e token consumido recusado. Não houve acesso a uma caixa de e-mail |
| Erros de API / banco / rede                                       | PASS                           | COMMIT com falha, JWKS indisponível, desconexão ociosa real e requisição abortada; nenhum sucesso silencioso                                                                               |
| Desktop e mobile                                                  | PASS no Chromium               | Rotas autenticadas em 1440/390 px sem overflow; suíte geral cobre cinco resoluções, modais, menu e tema                                                                                    |
| Local versus nuvem                                                | PASS                           | Fixture local fica inalterada; não aparece na nuvem nem é importada automaticamente; backup/importação e reset remoto preservam restrições anteriores                                      |
| Preview do commit final                                           | BLOCKED                        | Vercel SSO e projeto inacessível pela integração; resultados locais não substituem esse gate                                                                                               |

## Comandos e evidências

Resultados finais e casos: [resumo sanitizado](audit-evidence/pr3-backend/results.json). Logs anexados não contêm valores de credenciais, tokens, senhas ou connection strings privadas.

- `npm ci`: PASS; nenhuma alteração de dependência/lockfile nesta revisão.
- `npm run check`: **PASS**, lint, Prettier, **121 testes** e build.
- `npm run test:integration`: **16 testes**, API/HTTP + PostgreSQL 17 + JWKS HTTPS e assinaturas reais, sem mocks de SQL.
- `npm run test:neon`: **12 testes**, browser → SDK/Auth real → API real → Neon SQL real.
- `npm run test:e2e`: **74 PASS / 6 skips**, suíte geral Chromium desktop/mobile. Os seis skips de cloud-smoke exigem URL Auth configurada; os três testes desktop passaram separadamente com a configuração do job específico do CI. Esse smoke usa respostas simuladas; a suíte Neon usa serviços reais.
- `python3 -m unittest discover -s scripts -p 'test_*.py'`: **2 testes PASS**.
- `npm audit --json`: **zero vulnerabilidades**, incluindo dependências de desenvolvimento.

Na primeira execução geral, a suíte Neon e a geral compartilharam `test-results`, causando quatro erros ENOENT de traces e um timeout mobile sob carga. As saídas foram separadas (`work/neon-test-results` para Neon), e a suíte geral foi repetida sem outra suíte de navegador concorrente. Esses erros intermediários não foram contabilizados como aprovação.

### Reproduzir a integração sem credenciais Neon

Requer Node 24, OpenSSL e Docker. Em um terminal, iniciar um PostgreSQL descartável, com trust limitado a loopback:

```bash
docker run --rm --name saldolab-pr3-integration \
  --publish 127.0.0.1:55433:5432 \
  --env POSTGRES_DB=saldolab_integration \
  --env POSTGRES_HOST_AUTH_METHOD=trust postgres:17-alpine
```

Em outro terminal:

```bash
npm ci
SALDOLAB_TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:55433/saldolab_integration npm run test:integration
npm run check
npx playwright install chromium
npm run test:e2e
python3 -m unittest discover -s scripts -p 'test_*.py'
npm audit --json
```

O job `api-integration` do GitHub Actions repete a integração com serviço PostgreSQL 17 isolado, sem segredos Neon. O emissor de teste usa uma CA temporária confiada apenas pelo processo; não se desabilita TLS.

### Reproduzir os testes reais do Neon

Usar uma branch QA vazia e Auth correspondente, nunca o usuário existente nem development. Preparar o marcador somente nessa branch:

```sql
CREATE SCHEMA IF NOT EXISTS saldolab_qa;
CREATE TABLE IF NOT EXISTS saldolab_qa.environment (
  branch_id text PRIMARY KEY,
  purpose text NOT NULL,
  auth_base_url text
);
-- Inserir o ID da própria branch QA e a sua Base URL pública de Auth.
```

Fornecer pelo ambiente protegido `SALDOLAB_TEST_DATABASE_URL`, `SALDOLAB_TEST_BRANCH_ID`, `SALDOLAB_TEST_REAL_AUTH=1`, `NEON_AUTH_BASE_URL`, `NEON_AUTH_JWKS_URL` e `VITE_NEON_AUTH_URL`, todos correspondentes ao marcador; então executar `npm run test:neon`. Nenhum segredo deve ter prefixo `VITE_`. Não salvar esse ambiente no Git. A suíte gera duas novas identidades fictícias por execução e só altera sessões/verificações dessas identidades. Um proxy do runtime é usado com TLS validada, quando configurado. Em ambientes com proxy Node, habilitar `NODE_USE_ENV_PROXY=1` antes de iniciar o processo.

## Arquivos e CI

- API: `api/_lib/auth.js`, `api/_lib/db.js`, `api/_lib/finance.js`.
- Sessões/UI: `src/auth/neonClient.js`, `src/auth/useCloudSession.js`, `src/context/FinanceProvider.jsx`, `src/pages/CloudAccess.jsx`, `src/pages/PasswordRecovery.jsx`, `src/components/EditingNotice.jsx`, `src/repositories/remoteRepository.js`.
- Testes/configuração: `tests/integration/*`, `tests/neon/*`, `src/tests/cloudSession.test.jsx`, `vitest.integration.config.js`, `playwright.neon.config.js`, `package.json`, `.github/workflows/check.yml`.
- Documentação: este relatório, `docs/preview-vercel-neon.md`, `docs/neon-backend-plan.md`, `docs/architecture.md`, nota histórica em `docs/auditoria-final.md`, README e evidências sanitizadas.

O [GitHub Actions 43286033262](https://github.com/Tsilveira-dev/saldolab/actions/runs/43286033262) do commit de código `0508e2d86b6433565e5847d0bf4380295c16c7db` terminou com **PASS nos três jobs**: `check`, `api-integration` e `cloud-auth-smoke`. Os logs do CI confirmam 121 testes unitários, 16 integrados PostgreSQL, 74 Playwright + 6 skips, 3 smoke de Auth e 2 Python. Veja [metadados da execução](audit-evidence/pr3-backend/github-actions.json) e [contagens no CI](audit-evidence/pr3-backend/github-actions.log). A Vercel também aprovou o build desse commit; o smoke do endpoint protegido continua bloqueado em `lookup_deployment`/404. Atualizações documentais posteriores devem manter os [Checks do head do PR #3](https://github.com/Tsilveira-dev/saldolab/pull/3/checks) aprovados.

## Checklist de revisão e riscos restantes

- [x] JWT compatível com o SDK instalado e assinatura verificada no backend.
- [x] CRUD persistente, autorização A/B, revisão 409 e integridade financeira testados sem depender exclusivamente de mocks.
- [x] Nenhuma migração financeira nova nem mudança do schema de produção; correções anteriores e PR #2 preservados.
- [x] Sessões observadas na UI, dados de identidades antigas ocultados e gravações indisponíveis bloqueadas.
- [x] Dados existentes de development preservados; ambiente QA segregado.
- [ ] Smoke do Preview no commit final após liberar acesso do projeto Vercel à integração. Não executar a suíte destrutiva de fixtures no Preview configurado para development.
- [ ] Confirmar entrega de recuperação em uma caixa de teste controlada. A validação do token no banco não comprova SMTP/inbox.
- [ ] Revisar a política de revogação após recuperação: a configuração observada do Auth de QA tem `revoke_sessions_on_password_reset=false`. Nenhuma configuração de development foi alterada. JWTs emitidos usam verificação stateless e podem permanecer aceitos até os 900 segundos de validade, mais tolerância de 10 segundos, mesmo após logout; não se declarou revogação imediata.
- [x] CI dos três jobs aprovado no commit de código `0508e2d`; conferir o head atual após qualquer atualização documental. Nenhum merge ou lançamento está autorizado por este relatório.

**Recomendação:** revisar o PR #3 mantendo-o draft até resolver Preview, entrega de e-mail e a decisão de revogação de sessões. Os cenários executados passaram nos ambientes descritos; isso não constitui aprovação de Production.
