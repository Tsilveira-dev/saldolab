# SaldoLab — validação do Preview Vercel + Neon (PR #3)

Data: 2026-11-12. Estado: **Preview funcional para login, leitura e primeira gravação financeira; não aprovado para merge/produção**.

## Escopo e segregação

- Repositório `Tsilveira-dev/saldolab`, PR [#3](https://github.com/Tsilveira-dev/saldolab/pull/3), branch Git `feat/neon-backend-foundation`, base `main`.
- [Preview público de testes](https://saldolab-git-feat-neon-backend-foundation-fair-play7.vercel.app).
- Neon project `soft-term-72911921`, **somente branch `development`** (`br-wandering-mouse-bc0u10oc`), banco `saldolab`.
- Branch Neon `main` (`br-patient-forest-bcfzjc39`) não recebeu migrações nem tabelas financeiras. **Não alterar** sem aprovação de lançamento.
- Vercel: quatro variáveis da branch Git de Preview: `DATABASE_URL` (Secret, pooled de development), `NEON_AUTH_BASE_URL`, `NEON_AUTH_JWKS_URL`, `VITE_NEON_AUTH_URL`. Não colocar segredos `VITE_*`, no repositório, nos logs ou no chat. Sem variáveis financeiras em Production.
- PR #1 já incorporado em main; PR #2 (`fix/csv-contraste`) está separado e sem merge. Não misturar trabalhos silenciosamente.

## Evidência já obtida

| Item | Evidência | Estado |
| --- | --- | --- |
| `GET /api/health` | Resposta `{"app":"SaldoLab","status":"ok"}` no Preview | Confirmado |
| React /nuvem | Tela branca foi corrigida retirando a separação `manualChunks`; Playwright em CI | Confirmado |
| Cadastro e sessão | Usuário criado via Neon Auth e sessão visualizada no Preview; contagem de usuários no banco = 1 | Confirmado |
| Recuperação de senha | Interface/link habilitado; testes automatizados com respostas simuladas passaram; login posterior do usuário funcionou | UI confirmada; entrega de e-mail real não validada tecnicamente |
| Acesso PostgreSQL | Um erro `42P01` foi identificado no Request Log e resolvido após trocar `DATABASE_URL` para branch correta e Redeploy Preview | Confirmado |
| Dashboard na nuvem | Exibiu dados zerados com indicador `Neon PostgreSQL` | Confirmado |
| Primeira gravação | Usuário criou uma conta fictícia; consulta read-only do Neon development encontrou 1 `accounts`, soma de saldo inicial = 100000 centavos (R$ 1000,00), 0 categorias, 0 transações, 0 orçamentos | **Persistência no SQL confirmada** |
| CI | Checks `Qualidade` (Vitest, lint, format, build, Playwright, Python) e `cloud-auth-smoke` no commit `73dc96db` | Aprovados naquele commit |

> Contagens são evidência de teste, não dados financeiros reais. Não expor e-mail, nomes privados, tokens ou connection strings.

## Gates ainda pendentes — PR #3 permanece DRAFT

1. **CRUD integrado via API autenticada**: categorias receita/despesa, transações confirmadas/pendentes, orçamentos, transferências, listar, editar e excluir. Para cada operação, verificar diretamente no Postgres (somente development) e depois de atualizar/reabrir o Preview; sem persistir senhas nem dados privados em logs.
2. **Isolamento entre usuários**: duas contas de teste exclusivas, com IDs diferentes; validar listagem, GET por ID, POST com referências a recursos de outro usuário, PATCH/DELETE cross-user; resultado seguro 404/403 e sem escrita.
3. **Concorrência remota**: duas sessões alterando o mesmo registro com `revision` antiga; uma alteração aprovada, a outra 409; conflito comunicado na UI; exclusão concorrente também.
4. **Comportamento financeiro**: centavos exatos, date-only sem timezone, saldo inicial, categorias compatíveis, transferências não contadas como receita/despesa, pendências, referências FK, budgets `UNIQUE(user_id,category_id,month)`.
5. **Sessões e token**: testar `GET /api/finance` sem JWT 401, token inválido/expirado 401, `getAuthToken()` compatível com SDK Neon Auth atual, issuer/audience e rotação JWKS; confirmar no Preview real.
6. **Troca de modos e backups**: demo/local funcionam sem login, nunca sincronizam silenciosamente, importação na nuvem continua bloqueada, backup JSON exportável, múltiplas abas e mobile.
7. **Erros seguros**: desconexão SQL, auth indisponível, CORS e mensagens sem dados secretos ou SQL; testar regressão de `42P01`.
8. **Entrega/lançamento**: rodar `npm ci`, `npm run check`, Playwright, Python e auditoria de dependências; anexar evidência dos testes reais ao PR. Revisar o PR #2 independentemente. **Não fazer merge, deploy Production, migrations em Neon main nem importar backups sem revisão/consentimento explícito.**

## Execução recomendada ao Codex

Trabalhar somente em `feat/neon-backend-foundation`, mantendo os commits no PR #3. Começar pelos testes que exercitam a API real (não apenas mocks SQL); se precisar de usuários de teste, usar um ambiente/branch de teste isolado de `development`, não a conta do usuário que criou a conta fictícia de R$ 1000,00. Se for necessário criar ou apagar recursos de infraestrutura, pedir autorização antes. Nunca copiar variáveis secretas a logs/código. Não declarar validação concluída sem resultado observado. Publicar relatório de aprovação com PASS/FAIL, links CI e bloqueios restantes.
