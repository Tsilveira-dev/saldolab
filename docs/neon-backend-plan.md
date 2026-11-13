# SaldoLab — Plano técnico de Neon PostgreSQL (ADR-001)

**Estado atual:** API autenticada e repositório remoto implementados com `pg`, Neon Auth, controle de revisão e verificação de sessão ativa por função SQL (`0002`). Resultados finais e implantação futura estão em [lançamento v1.0](lancamento-v1.md) e [migração Production](migracao-production.md); a [auditoria do PR #3](auditoria-backend-neon.md) é histórica. As seções de planejamento abaixo preservam a proposta original; Drizzle não foi introduzido nesta etapa.
**Data:** 2026-11-12
**Base:** main após merge do PR #1. O PR #2 (CSV/contraste) é independente e permanece em revisão.

## Registro histórico do provisionamento inicial (2026-11-12)

- Organização Neon no plano Free; projeto `saldolab` (ID `soft-term-72911921`), AWS `us-east-1`, PostgreSQL 17.
- Branch de banco `main`: `br-patient-forest-bcfzjc39`, sem tabelas financeiras e sem migração aplicada.
- Branch de banco `development`: `br-wandering-mouse-bc0u10oc`, isolada da principal.
- Neon Auth (`better_auth`) habilitado **apenas** na branch `development`; esquema `neon_auth` verificado e ainda sem usuários cadastrados.
- Arquivo de migração `db/migrations/0001_initial_finance_schema.sql` versionado e aplicado somente em `development`.
- Verificado via SQL: tabelas `accounts`, `categories`, `transactions`, `budgets` existem; as quatro estão vazias.
- `.env.example` contém exclusivamente placeholders, sem credenciais reais.
- As regras de categoria/tipo e autorização por usuário ainda exigem implementação e testes na API. Os campos `user_id` não são, sozinhos, prova de isolamento.
- Nenhuma conexão de produção, variável Vercel, login React ou deployment alterados.

## 1. Objetivo e limites

Evoluir o SaldoLab (React + Vite + Bootstrap, hospedado na Vercel) para aplicação full-stack com armazenamento remoto por usuário, API REST, autenticação e dashboard real, sem alterar a identidade visual nem comprometer os backups JSON v1.

- Banco eleito: **Neon PostgreSQL**.
- Backend: **Node.js em Vercel Functions**, dentro da pasta api/ do repositório existente.
- Modelagem e migrações: **Drizzle ORM/Drizzle Kit**, versões verificadas antes da instalação.
- Autenticação proposta: **Neon Managed Better Auth (Neon Auth)**, usando seu SDK atual e verificação do token no backend.
- Python continua dedicado a scripts/relatórios offline; não é necessário um segundo backend Python.
- O modo demonstração continua funcionando localmente sem login; dados pessoais locais permanecem intactos até uma importação explícita.
- Não criar contas pagas, ligar billing, conectar banco de produção nem executar migrations de produção sem autorização do responsável.

## 2. Fluxo de arquitetura

1. React/Vite oferece UI e solicita login ao Neon Auth.
2. O cliente autenticado chama /api/* com credencial de sessão adequada ao fluxo documentado do Neon Auth.
3. A função Vercel **verifica a assinatura, issuer, audience quando aplicável, expiração e identidade** com mecanismos oficiais atuais. Um ID enviado no corpo/query nunca autentica nem autoriza o usuário.
4. A API valida payload e ownerId, executa a regra financeira e SQL com Drizzle usando DATABASE_URL somente no servidor.
5. As respostas da API reproduzem o contrato de createLocalRepository, incluindo snapshot/list/getById/create/update/remove.
6. Dashboard e relatórios consomem os dados remotos sem lógica financeira duplicada.

**Não** usar DATABASE_URL, DATABASE_URL_UNPOOLED, credenciais SQL, chaves privadas nem serviço com privilégios administrativos em import.meta.env, variáveis VITE_*, arquivos públicos ou código React.

## 3. Modelo de dados (proposta)

**Identidade:** usuários e sessões são geridos pelo Neon Auth no esquema neon_auth, sem duplicar senhas. User ID é texto opaco validado a partir do contexto autenticado.

| Tabela       | Campos principais                                                                                                                                                          | Regras                                                  |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| accounts     | id UUID, user_id TEXT, name, type, initial_balance_cents BIGINT, created_at, revision                                                                                      | Uma conta sempre pertence a um usuário                  |
| categories   | id UUID, user_id TEXT, name, type, color, icon, revision                                                                                                                   | Tipo income/expense; proteção quando usada              |
| transactions | id UUID, user_id TEXT, description, type, amount_cents BIGINT, category_id, account_id, destination_account_id, date DATE, status, notes, revision, created_at, updated_at | Receitas/despesas/transferências com vínculos coerentes |
| budgets      | id UUID, user_id TEXT, category_id, month CHAR(7), limit_cents BIGINT, revision                                                                                            | UNIQUE(user_id, category_id, month)                     |

Propriedade da linha: aplicar user_id em **todas** as consultas e mutações. Definir constraints e FKs de propriedade (por exemplo, referência composta user_id + account_id) para impedir que uma transação aponte para conta ou categoria de outra pessoa. Sem cascade de exclusão de contas/categorias em uso.

Regras financeiras:

- Montantes em centavos inteiros, positivos nas transações; validar limites, precisão e serialização de BIGINT sem perda de precisão em JavaScript.
- Transferência entre duas contas distintas de um mesmo usuário; uma transação representa ambos os lados, sem receita/despesa fictícia.
- Transferências e pendentes são excluídas das somas respectivas conforme o contrato atual.
- Categoria obrigatória e do tipo correspondente para receita/despesa, inexistente para transferência.
- Datas civis sem troca de dia por fuso; orçamento mensal no formato YYYY-MM.
- Edits/deletes com optimistic concurrency: revision original obrigatório; atualizar em condição user_id + id + revision e retornar 409 em conflito.
- Operações compostas e importação em transações do Postgres; confirmar commit antes de sucesso.
- Em caso de entrada inválida 422; sem sessão 401; sem acesso 403 ou 404 (sem revelar registros alheios); conflitos 409; demais erros sem expor SQL ou dados privados.

## 4. Interface de API sugerida

- GET /api/health — resposta sem segredos, sem contar registros privados.
- GET /api/snapshot — contas, categorias, transações e orçamentos do usuário autenticado.
- GET/POST /api/accounts; PATCH/DELETE /api/accounts/:id.
- GET/POST /api/categories; PATCH/DELETE /api/categories/:id.
- GET/POST /api/transactions; PATCH/DELETE /api/transactions/:id.
- GET/POST /api/budgets; PATCH/DELETE /api/budgets/:id.
- POST /api/import/preview — valida JSON v1, mostra contagens e possíveis conflitos sem gravar.
- POST /api/import/confirm — importação explícita, transacional e protegida por idempotency key; não apaga dados existentes sem escolha inequívoca.
- GET /api/export — exportação JSON autenticada, com mesmo formato documentado ou adaptador versionado.

Evitar implementar uma superfície CRUD pública sem autenticação. Decidir e testar política de CORS e CSRF conforme sessão/cookies usados. Em produção, respostas sensíveis devem utilizar cabeçalhos adequados de não-cache.

## 5. Implementação sem quebrar o MVP

- Manter createLocalRepository como está; adicionar createRemoteRepository/HTTP com a mesma assinatura assíncrona.
- A seleção do repositório fica apenas no FinanceProvider (ou composição equivalente): demo => local, pessoal local => local, usuário autenticado e modo nuvem => remoto.
- Não transformar o botão “Ativar edição” (Web Locks) em controle de acesso remoto: a versão remota usa autorização e concorrência no servidor e pode permitir mais de uma aba.
- Não remover o controle de edição local enquanto houver armazenamento local.
- Não mudar os identificadores/chaves do localStorage existentes.
- Introduzir telas de login/cadastro e status de sincronização de forma incremental, sem trocar a identidade visual.

## 6. Infraestrutura Neon / Vercel

1. Após autorização, provisionar **uma instância/projeto Neon** em região adequada ao público-alvo e ao runtime da Vercel; verificar preço/plano antes de habilitar cobrança.
2. Preferir conectar pela integração Neon/Vercel, com DATABASE_URL (pooler) para execução e DATABASE_URL_UNPOOLED para migrações, se fornecidos.
3. Habilitar Managed Better Auth com origens confiáveis e redirects apenas dos ambientes autorizados; configurar URL de auth específica por ambiente.
4. Usar branches isoladas de banco para desenvolvimento/preview e nunca rodar migrações de testes na branch produtiva.
5. Variáveis secretas no painel, **não** no GitHub público. Arquivo .env.example usa apenas placeholders sem valores.
6. Revisar rewrites existentes no vercel.json para não redirecionar /api/* a index.html.
7. Validar scripts de migração, permissões, backups, custos e rollback antes de publicar.

## 7. Segurança e testes exigidos

- Dois usuários A e B: A não consegue ler/escrever/excluir recursos de B mesmo alterando IDs ou referências cruzadas.
- Falta de autenticação ou tokens inválidos/expirados => 401; não confiar em user_id do corpo.
- Testes de concorrência com duas sessões alterando o mesmo recurso => uma falha controlada com 409, sem perda de dados.
- Testes de CRUD completo e regras monetárias no nível da API/DB; restrições de FK e UNIQUE; importação com rollback.
- Testes de falha de rede, banco indisponível, sessões expiradas, paginação e filtros no servidor.
- Testes de integridade de backups e mudança entre modo local e nuvem sem mistura de dados.
- CI com Vitest, Playwright, testes de integração e migrações em banco isolado; não expor logs com credenciais.
- Conferir acessibilidade e compatibilidade mobile, incluindo login/saída, erros e estados vazios.

## 8. Execução por fases

**Fase A — Preparação (sem credenciais):** arquitetura, esquemas Drizzle, migrações versionadas, definição da interface API, testes unitários com mocks, documentação e .env.example. Não depender de banco remoto para build.

**Fase B — Provisionamento:** após conexão autorizada do Neon, ativar banco e Neon Auth e testar conexão em ambiente de desenvolvimento isolado. Registrar setup sem segredos.

**Fase C — Backend:** implementar API, autenticação de requests, autorização e CRUD completo; provar isolamento de usuários e transações.

**Fase D — Frontend:** login/cadastro, repositório HTTP, modos local/demo/nuvem, carregamento, erros, gráficos e UX preservados.

**Fase E — Migração e lançamento:** prévia e confirmação de importação JSON, backups verificados, teste ponta a ponta e deployment somente após revisão de PR e autorização.

## 9. Critérios de aceitação da fase de planejamento

- Decisão arquitetural registrada e revisável no GitHub.
- Nenhum segredo, custo, banco externo ou dado financeiro real usado.
- Contrato e riscos explícitos para o Codex implementar sem alterar produção.
- O PR #2 de CSV/contraste permanece independente; integrar/rebase apenas conforme revisão.

## 10. Referências técnicas (consultar versões atuais ao executar)

- https://neon.com/docs/get-started/connect-neon
- https://neon.com/docs/guides/vercel-managed-integration
- https://neon.com/docs/auth/overview
- https://vercel.com/docs/frameworks/frontend/vite
- https://vercel.com/docs/functions
- https://orm.drizzle.team/docs/connect-neon

**Nota:** este documento é o planejamento, não é prova de banco criado, autenticação implementada, migrations executadas, testes passando ou deploy concluído.
