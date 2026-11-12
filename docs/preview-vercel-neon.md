# SaldoLab — validação do Preview Vercel + Neon (PR #3)

Data: 2026-11-12. Estado: **CRUD, Auth e concorrência validados com Neon real em QA isolado; Preview do commit final e entrega de e-mail ainda pendentes. Não aprovado para merge/produção**. Veja [auditoria técnica atual](auditoria-backend-neon.md).

## Escopo e segregação

- Repositório `Tsilveira-dev/saldolab`, PR [#3](https://github.com/Tsilveira-dev/saldolab/pull/3), branch Git `feat/neon-backend-foundation`, base `main`.
- [Preview público de testes](https://saldolab-git-feat-neon-backend-foundation-fair-play7.vercel.app).
- O Preview existente usa Neon project `soft-term-72911921`, branch `development` (`br-wandering-mouse-bc0u10oc`), banco `saldolab`. Os testes novos usam exclusivamente a branch QA `qa-pr3-20261112-auth-crud` (`br-plain-firefly-bcycj9zj`) e Auth correspondente; não executar as fixtures de CRUD no Preview de development.
- Branch Neon `main` (`br-patient-forest-bcfzjc39`) não recebeu migrações nem tabelas financeiras. **Não alterar** sem aprovação de lançamento.
- Vercel: quatro variáveis da branch Git de Preview: `DATABASE_URL` (Secret, pooled de development), `NEON_AUTH_BASE_URL`, `NEON_AUTH_JWKS_URL`, `VITE_NEON_AUTH_URL`. Não colocar segredos `VITE_*`, no repositório, nos logs ou no chat. Sem variáveis financeiras em Production.
- PR #1 já incorporado em main; PR #2 (`fix/csv-contraste`) está separado e sem merge. Não misturar trabalhos silenciosamente.

## Evidência histórica obtida antes da revisão final

| Item                 | Evidência                                                                                                                                                                                       | Estado                                                          |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `GET /api/health`    | Resposta `{"app":"SaldoLab","status":"ok"}` no Preview                                                                                                                                          | Confirmado                                                      |
| React /nuvem         | Tela branca foi corrigida retirando a separação `manualChunks`; Playwright em CI                                                                                                                | Confirmado                                                      |
| Cadastro e sessão    | Usuário criado via Neon Auth e sessão visualizada no Preview; contagem de usuários no banco = 1                                                                                                 | Confirmado                                                      |
| Recuperação de senha | Interface/link habilitado; testes automatizados com respostas simuladas passaram; login posterior do usuário funcionou                                                                          | UI confirmada; entrega de e-mail real não validada tecnicamente |
| Acesso PostgreSQL    | Um erro `42P01` foi identificado no Request Log e resolvido após trocar `DATABASE_URL` para branch correta e Redeploy Preview                                                                   | Confirmado                                                      |
| Dashboard na nuvem   | Exibiu dados zerados com indicador `Neon PostgreSQL`                                                                                                                                            | Confirmado                                                      |
| Primeira gravação    | Usuário criou uma conta fictícia; consulta read-only do Neon development encontrou 1 `accounts`, soma de saldo inicial = 100000 centavos (R$ 1000,00), 0 categorias, 0 transações, 0 orçamentos | **Persistência no SQL confirmada**                              |
| CI                   | Checks `Qualidade` (Vitest, lint, format, build, Playwright, Python) e `cloud-auth-smoke` no commit `73dc96db`                                                                                  | Aprovados naquele commit                                        |

> Contagens são evidência de teste, não dados financeiros reais. Não expor e-mail, nomes privados, tokens ou connection strings.

## Gates ainda pendentes — PR #3 permanece DRAFT

CRUD, cálculos, isolamento A/B, concorrência 409, persistência após novo login, sessões e modos separados passaram nas suítes reais de QA. As correções e a matriz PASS/FAIL/BLOCKED estão no [relatório da auditoria](auditoria-backend-neon.md) e no [resumo sanitizado](audit-evidence/pr3-backend/results.json).

1. **Preview atual:** liberar o acesso do projeto Vercel `saldolab`, equipe FAIR PLAY, para a integração. A tentativa atual encontra SSO/302 e 404 no projeto pela integração; o funcionamento histórico acima não aprova o commit final.
2. **E-mail de recuperação:** fluxo técnico real, expiração e uso único passaram em QA; entrega em caixa de e-mail controlada ainda não observada.
3. **Revogação:** decidir a política após troca de senha. A configuração observada em QA não revoga sessões automaticamente no reset; JWTs são stateless, com validade observada de 900 segundos e tolerância de 10 segundos. Não se promete revogação imediata no logout. Configurações de development não foram alteradas.
4. **CI do novo head:** conferir os três jobs (`check`, `cloud-auth-smoke`, `api-integration`) no [PR #3](https://github.com/Tsilveira-dev/saldolab/pull/3/checks). PR #2 continua independente. Merge, Production e migração da Neon main dependem de autorização própria.

## Execução recomendada ao Codex

Continuar somente em `feat/neon-backend-foundation`, mantendo os commits no PR #3. Testes de escrita devem usar QA isolado e novas identidades fictícias, sem alterar o usuário existente de development. A autorização desta revisão cobre correções e testes normais no ambiente de testes; operações destrutivas ou infraestrutura fora dele exigem autorização separada. Nunca copiar segredos a logs/código nem declarar aprovação sem evidência.
