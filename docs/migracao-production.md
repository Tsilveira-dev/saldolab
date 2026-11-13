# Plano de mudança — Neon main e Vercel Production

**Preparado, não executado.** Nenhuma etapa de escrita abaixo está autorizada por este documento. O PR #3 continua draft. Merge, Auth/migração no Neon main, variáveis/deploy Production e alterações de permissões precisam de autorização explícita posterior.

## Alvos e pré-condições

- Repositório `Tsilveira-dev/saldolab`; código revisado na branch `feat/neon-backend-foundation`.
- Neon projeto `soft-term-72911921`, destino futuro `br-patient-forest-bcfzjc39` (`main`), banco `saldolab`.
- Vercel projeto `prj_gawaPXbUz7w8b0OrFlY3cJQzmQnf`, equipe `fair-play7` (`team_DlOUI4nj6rsxAKk0BvDfCJ9f`).
- Confirmar que a main Neon segue sem tabelas financeiras/Auth antes da mudança. Se houver qualquer dado ou divergência, parar e revisar o plano; não usar `IF NOT EXISTS` como prova de compatibilidade.
- Congelar o SHA aprovado, resultados de CI, responsáveis, janela e fallback. Não há importação automática de usuários/finanças de development ou QA.
- Confirmar plano/capacidade de Neon e Vercel, SMTP, privacidade, estratégia de backup e decisão sobre revogação JWT. Não habilitar cobrança como efeito colateral.

## Ordem proposta após autorização

| Ordem | Ação futura                                                                                                     | Critério para continuar                                                                                                  |
| ----- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| 1     | Conferir IDs, snapshot/backup de segurança e acesso administrativo                                              | Alvos corretos; nenhuma credencial em registro público                                                                   |
| 2     | Habilitar Managed Neon Auth na main, banco `saldolab`                                                           | URLs próprias de Production; não reutilizar QA                                                                           |
| 3     | Configurar SMTP próprio e domínio; política de e-mail/sessões                                                   | Verificação obrigatória, reenvio controlado, reset revoga sessões; localhost desabilitado e origens exatas de Production |
| 4     | Aplicar `0001_initial_finance_schema.sql` e `0002_active_session_authorization.sql`, em ordem e transação única | Quatro tabelas e função de sessão ativa esperadas; zero erro, sem substituição de tabelas/dados                          |
| 5     | Criar role de runtime sem privilégios administrativos e aplicar grants mínimos                                  | Login permitido; sem superuser, createdb, createrole, replication, bypassrls ou memberships privilegiadas                |
| 6     | Configurar as quatro variáveis **somente no alvo Production**                                                   | URL pooler da main com role de runtime; Base/JWKS/Auth públicos da main correspondentes                                  |
| 7     | Revisar o disparo automático do Git antes do merge                                                              | Infraestrutura pronta antes de qualquer push/merge em main                                                               |
| 8     | Autorizar merge/publicação e fazer build próprio de Production                                                  | Artefato contém a URL pública Auth correta; não promover o build QA com Auth compilado de QA                             |
| 9     | Executar smoke pós-publicação e aceite do titular com dados fictícios                                           | Login/verificação/reset, A/B, CRUD, reload, exportação, logs e celular no SHA autorizado                                 |
| 10    | Autorizar uso real somente após GO                                                                              | Todos os gates e contingência revisados; piloto fechado                                                                  |

O endpoint `/api/health` sozinho não comprova conexão ao banco nem autorização. Conferir o fluxo completo. Manter Previews protegidos por SSO; não ampliar Trusted Sources para Production como atalho.

## Migração e permissões

A migração inicial contém IDs compatíveis com JSON v1, centavos bigint limitados, datas sem timezone, revisões, FKs compostas por usuário, regra de transferência e orçamento único por usuário/categoria/mês. A autorização por usuário continua aplicada na API; este projeto não declara isolamento por RLS com a conexão de serviço.

Uma execução futura deve usar conexão administrativa direta protegida, parada em qualquer erro e uma transação única. Registrar checksum do arquivo e conferir catálogo de tabelas/constraints/índices após aplicar. Não executar por um job de Preview ou pela aplicação. Os ensaios anteriores em PostgreSQL 17 e QA não autorizam aplicar na main.

A migração `0002` requer Neon Auth habilitado no mesmo banco. Cria apenas a função booleana `public.saldolab_session_active(text,uuid)`, sem alterar dados ou tabelas Auth. O runtime passa o sujeito assinado do JWT e o ID opaco da sessão do SDK; ambos são exigidos em todas as transações da API. A função usa `SECURITY DEFINER` com SQL estático, objetos qualificados e `search_path=pg_catalog`; remover EXECUTE de PUBLIC e manter o proprietário administrativo diferente da role runtime. A role do aplicativo recebe apenas EXECUTE, sem leitura direta de `neon_auth`. A falta de função/grant falha fechada, sem fallback para JWT sozinho.

Checksums SHA-256 revisados desta entrega (recalcular no SHA congelado; uma divergência exige revisão):

| Arquivo                                               | SHA-256                                                            |
| ----------------------------------------------------- | ------------------------------------------------------------------ |
| `db/migrations/0001_initial_finance_schema.sql`       | `3a95055305891a925a357cb71afccb38761e38e991902375b1b22729336ab688` |
| `db/migrations/0002_active_session_authorization.sql` | `5c41eeee16771a3ff7dd7593009bc5105e1cd3b60a95afd313a3a2879627721b` |
| `db/operations/runtime-grants.sql`                    | `128df42ad28b2566593e846d2843b0eb375ad27a3cc74cfd155d80f00f744997` |

O arquivo [runtime-grants.sql](../db/operations/runtime-grants.sql) é um roteiro de grants, não uma migração automática. Criar a role por canal administrativo seguro e conferir suas memberships: uma role `NOINHERIT` que ainda possa assumir uma role administrativa não atende ao mínimo privilégio. Conexão do runtime não deve acessar `neon_auth.account`/senhas nem criar objetos. O SDK de Auth usa o serviço Neon separadamente.

Executar [verify-runtime.sql](../db/operations/verify-runtime.sql) conectado como runtime e conferir todos os resultados, inclusive ausência de CREATE em public, SELECT em Auth e memberships administrativas. Teste local demonstrou CRUD via API com role restrita, negação de SELECT em Auth/SET ROLE e falha fechada sem EXECUTE; isto não substitui a verificação da role que vier a ser criada no Neon main. Não conceder permissões amplas para resolver erro 500.

## Variáveis e validação

`DATABASE_URL` é privada, pooler da main com a role restrita e `sslmode=verify-full`. `NEON_AUTH_BASE_URL`, `NEON_AUTH_JWKS_URL` e `VITE_NEON_AUTH_URL` devem apontar para o Auth de Production. Não copiar o token OIDC local nem credenciais de QA para as variáveis do aplicativo. O prefixo `VITE_` é reservado a valores públicos.

`DATABASE_URL_UNPOOLED` no arquivo de exemplo é somente para administração/migração por conexão direta protegida. Não configurar a conexão owner como variável das Functions; o runtime precisa somente das quatro variáveis acima.

Comparar project/team e target antes de salvar configurações. Validar `target=production` somente na mudança explicitamente autorizada. Uma variável em Preview ou um deploy QA aprovado não configura Production.

## Pontos de parada

- SMTP/domínio ou titularidade ainda não demonstrados no ambiente autorizado.
- Role administrativa usada pelo aplicativo, grant excessivo, origem incorreta ou variáveis cruzadas.
- Divergência de schema/dados na main; qualquer proposta de DROP/TRUNCATE ou restauração in-place.
- Build com URL Auth de QA, CI do SHA divergente, aceite incompleto ou ausência de fallback.
- Código ou fallback que aceite JWT sem checar sessão ativa; reset que não revogue sessões; recusa dos pares JWT/sessão anteriores não comprovada no ambiente publicado.

Em qualquer parada, manter o PR draft e Production existente intacta. [Rollback](rollback.md) separa reversão da aplicação de recuperação do banco.

Roteiro de UI, comandos e continuidade independente: [guia de lançamento sem Codex](guia-lancamento-sem-codex.md). A versão pessoal mantém inscrições restritas; abertura pública e eventual uso comercial são outra decisão, fora desta preparação.
