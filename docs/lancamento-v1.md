# SaldoLab v1.0 — prontidão para lançamento

## Rodada final — uso pessoal controlado

Data: 12/11/2026, America/Sao_Paulo. Base recebida: `26c9bed`. Escopo encerrado em requisitos críticos do PR #3, branch `feat/neon-backend-foundation`; nenhuma funcionalidade financeira nova. [Checklist mais recente do titular](https://github.com/Tsilveira-dev/saldolab/pull/3#issuecomment-6840078579).

**Decisão: NO-GO para publicação/finanças reais; código preparado para revisão técnica, PR em draft.** A infraestrutura Production não foi executada. O titular confirmou o fluxo e a correção de troca de identidade no QA; a conferência pessoal no celular ainda precisa ser concluída. O [guia de lançamento sem Codex](guia-lancamento-sem-codex.md) contém os passos para concluir e operar o projeto independentemente deste ambiente.

### Resultado atual PASS / FAIL / BLOCKED

| Requisito                                          | Resultado                                  | Evidência / próximo passo                                                                                                                                                                                |
| -------------------------------------------------- | ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Frontend, domínio financeiro, API e erros          | **PASS**                                   | `npm run check`: lint, formatação, 136 testes e build; testes reais mantêm commit antes de sucesso, centavos, FKs e 409                                                                                  |
| Integração PostgreSQL 17                           | **PASS — 27 testes**                       | CRUD, A/B, saldo/receita/despesa/transferência/orçamento, falha de commit, concorrência, sessão e seis cenários de restore                                                                               |
| Playwright geral                                   | **PASS — 80; 6 skips condicionais**        | Desktop/mobile, modos, Web Locks, formulários, persistência e cadastro rápido vazio; os skips de Auth configurado têm job próprio no CI                                                                  |
| Preview protegido com serviços reais               | **PASS — 10 cenários**                     | Código `01c9273` em `https://saldolab-i9cni7y69-fair-play7.vercel.app`; metadata do SHA/projeto/QA conferida; OIDC só nessa origem, TLS validada                                                         |
| Conta/categoria dentro da transação                | **PASS**                                   | Receita e despesa, 1440/390px: cadastro rápido desde zero contas/categorias, seleção automática, rascunho preservado, edição, reload e exclusão                                                          |
| Sessões e JWT anterior                             | **PASS na API nova**                       | Pares JWT/sessão revogados recebem 401 após logout individual/global, troca/reset; outro login não reativa o par antigo. JWT sem sessão ou sessão alheia é recusado                                      |
| OTP/inbox real do titular                          | **PASS do fluxo anterior corroborado**     | Titular confirmou inbox e conclusão do fluxo; nova consulta somente leitura no mesmo QA encontrou `emailVerified=true`. Nenhum código humano foi lido ou flag do titular alterada por SQL                |
| Aceite do titular e celular no QA                  | **PASS titular / BLOCKED celular**         | Titular confirmou a correção 01c9273: nova identidade mostra Neon PostgreSQL e não traz dados locais automaticamente. Aceite no celular permanece pendente; emulação mobile passou                       |
| Exportação e recuperação isolada                   | **PASS**                                   | JSON baixado pela UI nova; dry-run e restore no Neon isolado: 2 contas, 2 categorias, 4 transações, 1 orçamento, saldo 275000 e gasto 75000 centavos; IDs novos, origem preservada e repetição bloqueada |
| Python e dependências                              | **PASS**                                   | 2 testes Python; `npm audit --json`: zero vulnerabilidades, inclusive dependências de desenvolvimento; lockfile preservado                                                                               |
| CI do pacote definitivo                            | **PASS código / conferir head definitivo** | As URLs/SHA dos checks e Preview definitivos são indexadas na descrição do PR após fechar esta documentação; run antigo não aprova novo head                                                             |
| Neon main / Auth / SMTP / role / Vercel Production | **BLOCKED — execução não autorizada**      | Plano, checksums, ordem e consulta de privilégios preparados; aplicar e validar somente em mudança autorizada                                                                                            |
| Backup externo/PITR operacional e monitoramento    | **BLOCKED**                                | Ensaios não configuram agenda, retenção, alertas ou cópia fora do projeto. Definir responsável e comprovar recuperação antes do uso real                                                                 |

**FAIL aberto nos cenários concluídos: nenhum.** BLOCKED não significa PASS. Não se declara o ambiente Production aprovado por resultados de QA.

O commit funcional `01c9273` passou nos três jobs do [CI 43343071173](https://github.com/Tsilveira-dev/saldolab/actions/runs/43343071173). A revisão documental final não substitui a conferência dos checks do seu próprio head, vinculados no PR.

### Correção crítica de autorização

O Managed JWT observado não contém `sid`, `sessionId` ou `jti`; `/get-session` com Bearer JWT sem cookie não faz introspecção. A assinatura, sozinha, continuava válida após logout. `ca9e3cc` acrescenta a exigência de `X-SaldoLab-Session-Id`, obtido pelo SDK, e verifica no PostgreSQL se a sessão existe, pertence ao sujeito assinado e não expirou. A consulta é feita em toda transação financeira, sem cache positivo e sem fallback stateless.

A migração `0002_active_session_authorization.sql` cria somente uma função booleana, sem mudar dados Auth/financeiros. Usa SQL fixo, `SECURITY DEFINER`, `search_path=pg_catalog`, nomes qualificados e EXECUTE removido de PUBLIC. A role de runtime só recebe EXECUTE; o teste real de role mínima comprovou API funcional sem SELECT em Auth ou SET ROLE administrativo. Remover EXECUTE causa erro seguro e nenhuma gravação. Há uma consulta SQL adicional por operação, na conexão/transação já usadas, sem chamada HTTP de Auth. Não se usa cache para esconder essa dependência.

No provedor real, a troca com `revokeOtherSessions=true` também rotacionou a sessão atual: par anterior 401, nova sessão 200; os demais dispositivos perderam acesso. Reset revogou todas as sessões anteriores. O logout individual preservou outro dispositivo ativo; o global recusou ambos os pares anteriores, inclusive após novo login.

**Alcance exato:** revoga-se a autorização da API nova mediante a credencial de sessão. A assinatura Neon continua válida por 900s +10s, e o JWT pode ser idêntico entre sessões emitidas no mesmo segundo. Uma nova sessão legítima é uma nova credencial; não se promete invalidar os bytes do JWT em outros serviços. Requisições já autorizadas em andamento, downloads e APIs antigas não são cancelados. Não promover/reativar builds que aceitem somente JWT. Os Previews antigos do QA não foram apagados nem tratados como endpoints protegidos pela mudança nova.

### Auditoria de persistência e primeira utilização

As correções de `26c9bed` foram preservadas. A conta criada dentro do formulário permanece selecionada; a categoria correspondente ao tipo fica junto dos seletores e mantém descrição/valor. Nenhum layout geral foi refeito. A suíte publicada começa com identidades fictícias vazias e usa UI, SDK, API e SQL reais; valida também reload/novo login, exportação sem credenciais e tentativas A/B de leitura, edição e exclusão nas quatro entidades. A suíte PostgreSQL confirma 409 e falhas de COMMIT sem falso sucesso.

**Defeito de fluxo encontrado pelo titular nesta rodada:** após sair da nuvem, `CloudAccess` selecionava automaticamente o modo pessoal. Como esse armazenamento pertence ao navegador/origem, e não ao e-mail, seus registros continuavam aparecendo após outro login que ainda não selecionara a nuvem. O titular confirmou o selo **Armazenamento local**; o teste reproduziu a exibição de uma conta local sentinela após logout. A correção `01c9273` mantém a nuvem sem sessão ao sair, seleciona a nuvem ao enviar login/cadastro e invalida respostas pendentes antes de limpar a apresentação. Nenhum dado foi apagado ou transferido.

Os dois cenários novos A→B→A usam a **mesma aba/perfil**, em 1440 e 390px: A cria sua conta, sai, B é cadastrada e entra sem clicar em um botão adicional de modo, começa vazia e cria sua própria conta; retornar a A recupera só A. O conteúdo local permanece igual e os registros SQL de ambas permanecem com seus respectivos usuários. Essa regressão cobre o fluxo que o teste anterior, com perfis independentes, não exercitava. Dois testes React adicionais cobrem leitura atrasada ao reentrar no mesmo modo e ocultação enquanto a identidade está pendente.

As fixtures automatizadas têm o e-mail preparado no SQL **somente para usuários fictícios recém-criados**; não são evidência de inbox. A interface OTP tem três testes unitários simulados e o fluxo humano foi corroborado separadamente. Nenhum reset/verificação deste ensaio modificou a senha ou sessões do titular.

Os testes expuseram problemas nos auxiliares: duas sessões podem compartilhar o mesmo JWT (o mapa por token foi substituído por pares explícitos), uma variável ocultava o mapa de credenciais, e uma expectativa não considerava a rotação da sessão atual. Foram corrigidos antes de contabilizar os cenários publicados como PASS. A verificação nova de troca de identidade também ajustou o seletor do teste ao selo oculto pelo layout mobile, conferindo o estado do modo e o aviso visível de nuvem. A primeira tentativa local de Playwright não tinha o binário padrão; a execução válida utilizou Chromium do sistema pela opção já existente. Não houve aprovação baseada nessas tentativas falhas.

### Recuperação e preservação

O novo JSON foi restaurado em `br-cold-base-bc3peopn`, somente para uma identidade fictícia nova e vazia. As impressões digitais dos registros financeiros anteriores da branch permaneceram iguais. IDs e vínculos foram remapeados; nova tentativa foi recusada. A fase lógica levou 982ms, excluindo provisionamento e ativação: não é RTO/SLA. Não se executou PITR histórico nem dump externo. A restauração por snapshot anterior permanece documentada; a cópia atual não foi ativada como origem de nenhuma aplicação.

Consultas somente leitura reconfirmaram:

- Git main e PR #2 preservados; código novo somente na branch #3.
- Neon main sem tabelas em `public`/`neon_auth`; nenhuma migração, role ou Auth Production criados.
- Development: 1 usuário, 1 conta com saldo inicial 100000 centavos, 1 categoria e 1 despesa confirmada de 10000 centavos, zero orçamentos — o estado do aceite parcial do titular, sem escritas desta rodada.
- Vercel Production no deployment `dpl_2AW7mCUorWQF4oQBUidAThX8FHW5`, zero variáveis Production; SSO igual e nenhum bypass de automação ativo. Sem alterações de faturamento.

`0002` foi aplicada somente no QA de release e no PostgreSQL descartável. O código novo depende dessa função: **o alias automático ligado a development não é a URL de aceite** e precisa de preparação de schema por uma mudança autorizada antes de receber esta versão. Não usar owner ou desligar a checagem para contornar esse pré-requisito.

### Pendências que o titular consegue concluir sem Codex

1. Concluir a conferência no celular pelo Preview QA. O aceite de login/cadastro, CRUD e correção da troca de espaço já foi informado pelo titular; registrar o resultado móvel sem segredos.
2. Autorizar separadamente o plano Production: Neon main/Auth, SMTP/domínio, migrações `0001`/`0002`, role mínima e quatro variáveis Vercel. Os [checksums e pontos de parada](migracao-production.md) estão revisados.
3. Definir e configurar backup independente, retenção, monitoramento e responsável; executar ensaio e smoke do ambiente efetivamente publicado antes de finanças reais.
4. Conferir os três jobs no SHA definitivo, revisar o PR, registrar GO e só então autorizar merge/build Production. O build precisa das URLs de Production, não pode ser promoção do artefato QA.

O [guia sem Codex](guia-lancamento-sem-codex.md) detalha interfaces, comandos, critérios de parada e rotina. [Recuperação](recuperacao.md), [backups](backups.md), [rollback](rollback.md), [instalação](instalacao.md) e README foram revisados. Uso público/comercial, exclusão de conta em autosserviço e funcionalidades adicionais ficam fora da v1 pessoal.

Limitação de desempenho registrada: o Vite emite aviso de bundle principal acima de 500kB (aproximadamente 925kB, 279kB gzip no build sem Auth configurado). Build e navegação passaram; otimização de chunks não foi adicionada à rodada crítica.

Arquivos funcionais desta rodada: `api/_lib/auth.js`, `api/_lib/errors.js`, `api/finance.js`, `db/migrations/0002_active_session_authorization.sql`, `db/operations/runtime-grants.sql`, `db/operations/verify-runtime.sql`, `src/auth/neonClient.js`, `src/repositories/remoteRepository.js`, `src/pages/CloudAccess.jsx` e `src/context/FinanceProvider.jsx`. Testes: `src/tests/cloudSession.test.jsx`, `tests/integration/finance.test.js`, `tests/integration/harness.js`, `tests/neon/helpers.js` e `tests/release/published.spec.js`. Documentação: README, relatórios/planos/guias de operação e evidências sanitizadas. O diff completo fica em Files changed do PR #3.

Evidências novas sanitizadas: [audit-evidence/v1-final](audit-evidence/v1-final). O PR registra o SHA/CI/Preview definitivos sem criar uma referência circular ao hash do próprio documento.

<details>
<summary>Histórico da preparação anterior a 26c9bed — políticas e gates antigos, preservados para rastreabilidade</summary>

Data: 12/11/2026, America/Sao_Paulo. Repositório `Tsilveira-dev/saldolab`, exclusivamente `feat/neon-backend-foundation`, PR #3 em draft. Critérios originados na [checklist da conversa do PR](https://github.com/Tsilveira-dev/saldolab/pull/3#issuecomment-6833605286).

**Recomendação: NO-GO para ativar a nuvem em Production ou inserir finanças reais.** Os avanços abaixo foram demonstrados em Preview protegido e QA isolado. Production continua sem configuração de nuvem e depende de autorização própria. O plano está preparado para revisão, sem merge ou migração da Neon main.

## Critérios de aceite

| Gate                             | Resultado                                                 | Evidência e pendência                                                                                                                                                                                                                            |
| -------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| G1 — Preview publicado protegido | **PASS no QA ensaiado**                                   | OIDC local autenticou saúde 200, página 200 e API sem JWT 401; cinco cenários publicados com API/Auth/Neon reais, incluindo o bloqueio de categorias relatado pelo titular. Head e Preview finais são registrados na descrição do PR após o CI   |
| G2 — entrega e titularidade      | **PASS entrega / BLOCKED conclusão do titular**           | Usuário confirmou recebimento na caixa de entrada. Relatou verificação/reset/login, mas a consulta do novo QA ainda encontrou `emailVerified=false`; confirmação adicional solicitada. Não considerar esse relato isolado como conclusão técnica |
| G2 — política Production         | **PASS plano / BLOCKED ativação**                         | Verificação obrigatória, OTP, sem login automático após confirmar; piloto fechado e SMTP próprio planejados. SMTP compartilhado de QA não configura Production                                                                                   |
| G3 — revogação                   | **PASS mecanismos suportados / BLOCKED decisão residual** | Logout global: zero sessões e segundo dispositivo sem sessão. Troca de senha revoga outros; reset revoga todas. JWT anterior ainda retorna 200 até expirar; janela 900s + 10s requer aceite explícito ou mecanismo adicional                     |
| G4 — infraestrutura Production   | **PASS plano / BLOCKED execução**                         | Neon main continua sem tabelas financeiras/Auth; Vercel tem zero variáveis Production. Role mínima, sequência, validações e pontos de parada preparados, sem execução                                                                            |
| G5 — backup/recuperação          | **PASS ensaio / BLOCKED operação Production**             | Exportação pela UI publicada, snapshot em nova branch e restauração JSON real sem sobrescrever dados. Backup externo/PITR histórico/agendamento/retensão operacionais ainda precisam ser configurados e aceitos                                  |
| G6 — rollback e PR #2            | **PASS preparação**                                       | Roteiro separa aplicação, banco e Auth. Quatro arquivos do PR #2 revisados e portados em commit próprio; PR #2 não foi merged nem alterado                                                                                                       |
| G7 — instalação/privacidade      | **PASS documentação / BLOCKED abertura pública**          | README e instalação corrigidos; recuperação, privacidade e limites escritos. Contato, retenção, operação e eventual adequação comercial do plano precisam de decisão do responsável                                                              |
| G8 — aceite do titular           | **BLOCKED após correção do bloqueio relatado**            | Titular relatou que contas funcionavam, mas transações não tinham categorias. Correção passou em desktop/mobile, inclusive no Preview. A confirmação do titular após a correção e do modo nuvem ainda está pendente                              |

Não há falha de persistência conhecida nos cenários concluídos. Os estados BLOCKED não são convertidos em PASS por testes com mocks ou por funcionamento da versão local.

## Preview e preservação

- Preview inicial de lançamento: `https://saldolab-q1v154x7r-fair-play7.vercel.app`, código `1828db8`.
- Preview com correção de categorias: `https://saldolab-1iwv53x4y-fair-play7.vercel.app`, código `438e7a5`. Ambos são Previews protegidos, ligados ao **novo QA**, não a development.
- Neon de lançamento: `qa-v1-release-20261112`, `br-gentle-water-bc8ceb2q`, criado da main vazia. Auth e fixtures são próprios desse ambiente.
- Recuperação: `qa-v1-restore-20261112`, `br-cold-base-bc3peopn`, snapshot do QA de lançamento. Nenhuma troca de conexão de origem.
- Production permaneceu no deployment `dpl_2AW7mCUorWQF4oQBUidAThX8FHW5`; variáveis Production e configuração SSO permaneceram iguais.
- A CLI autenticada confirmou o projeto/equipe corretos. O acesso utilizou OIDC restrito à origem do Preview, com TLS validada. A credencial temporária criada pela tentativa de `vercel curl` foi revogada; nenhum SSO foi desativado.
- Consultas somente leitura reconfirmaram development com 1 usuário, 1 conta e saldo inicial agregado de 100000 centavos, sem categorias/transações/orçamentos. Neon main tinha zero tabelas em `public`/`neon_auth`.

Dados locais pertencem à origem do navegador. Uma nova URL de Preview não transporta o localStorage da anterior. Para verificar a nuvem, entrar em **Minha nuvem → Abrir finanças na nuvem** e conferir o selo **Neon PostgreSQL**. Nenhum backup local é enviado automaticamente.

## Correções desta preparação

1. Confirmação de e-mail por OTP na interface, com erros neutros, senha/código fora de logs e cooldown de reenvio. O novo QA exige titularidade antes de emitir sessão. Login sem verificação foi recusado com 403 `EMAIL_NOT_VERIFIED`, sem JWT.
2. Logout global implementado com `revokeSessions`; reset no QA usa `revoke_sessions_on_password_reset=true`. Mudança de senha, reset e segunda sessão foram exercitados no serviço publicado.
3. Exportação v1 reutiliza validação comum; ferramenta de restauração tem dry-run padrão, marcador QA, destino vazio, verificação de identidade, IDs remapeados e uma transação. Main/development conhecidos são recusados explicitamente. Não há DELETE ou opção de sobrescrita.
4. Correções do PR #2 avaliadas antes do porte: proteção CSV contra prefixos invisíveis e contraste. Candidato passou em nove entradas hostis; contraste de texto secundário medido em 6,09:1 claro e 8,80:1 escuro. Porte rastreável em `dffa6c5`, origem `b637c8586b5dc1022488bb742ce76f444efb17f4`.
5. **Bloqueio relatado em transações:** quando não havia categoria do tipo selecionado, o formulário exigia seleção sem oferecer saída direta. Agora permite criar a categoria no próprio lançamento, seleciona-a e mantém descrição/valor. O salvamento aguarda uma categoria válida; receitas/despesas continuam com vínculos obrigatórios. Transferências continuam sem categoria. Os atalhos das seções Receitas/Despesas preselecionam o tipo correto.
6. Publicação exclui artefatos privados/testes via `.vercelignore`, preservando exclusões anteriores. O modelo de conexão passou a `sslmode=verify-full`; o QA corrigido usa essa opção para explicitar validação TLS e evitar o aviso de futura mudança de semântica de `require` no driver.

## Testes novos e limites de evidência

| Verificação                                     | Resultado                                                                                                                                                  |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Interface OTP: sucesso, falha segura e reenvio  | 3 testes unitários PASS; respostas simuladas, não prova de inbox                                                                                           |
| CSV portado do PR #2                            | 11 verificações filtradas PASS; restante do arquivo não repetido manualmente                                                                               |
| Restauração em PostgreSQL 17 real               | 6 testes PASS: vínculos/centavos/IDs, destino preenchido, branch errada/protegida, formato/identidade inválidos e concorrência                             |
| Categorias dentro do lançamento em modos locais | 4 Playwright PASS: receita/despesa em desktop/mobile; rascunho preservado, edição 10→20 e exclusão                                                         |
| QA publicado                                    | 5 testes PASS: cadastro exige confirmação, logout global, senha/reset/segunda sessão, exportação e criação/edição/exclusão guiadas em 1440/390 px          |
| Snapshot e restauração no Neon                  | PASS: 2 contas, 2 categorias, 4 transações e 1 orçamento; saldo 275000 centavos; orçamento gasto 75000; IDs novos, origem preservada e repetição bloqueada |

A suíte publicada prepara suas identidades **fictícias** com e-mail verificado no SQL do QA para testar sessões e finanças. Não se considera essa preparação prova da verificação do titular. Uma tentativa de automatizar OTP pelo banco encontrou o código protegido pelo provedor e não foi usada como aprovação. O gate de inbox/titularidade permanece separado.

O primeiro teste publicado precisou corrigir um seletor ambíguo de “Adicionar conta” na tela vazia. Isso foi uma falha do teste, não aprovação nem defeito de persistência. O bloqueio de categorias informado pelo titular foi uma falha de fluxo e recebeu correção e teste específico.

A auditoria anterior (121 unitários, 16 integrações PostgreSQL, 12 Neon, 74 Playwright + 6 condicionais, 3 smoke e 2 Python) permanece preservada em [auditoria-backend-neon.md](auditoria-backend-neon.md). Nesta etapa foram executados testes novos/afetados; o CI realiza regressões nos commits atualizados. Dependências do aplicativo e lockfile não mudaram; a auditoria anterior do mesmo lockfile reportou zero vulnerabilidades.

## Observabilidade e recuperação

As respostas HTTP foram observadas no ambiente publicado e as gravações conferidas em SQL de QA. A consulta inicial de runtime encontrou um aviso TLS do driver enviado a stderr e classificado como error pela plataforma, não uma falha SQL/HTTP. A configuração QA seguinte foi ajustada para `verify-full`. Logs brutos ficaram privados; não foram publicados headers, tokens, URLs de recuperação ou e-mails.

O ensaio lógico de restauração demorou 973 ms, excluindo provisionamento/revisão/ativação. Não é SLA. Não foi executado PITR histórico nem dump externo. Backup físico pode restaurar credenciais/sessões antigas; o [procedimento](backups.md) exige reconciliação de Auth antes de ativar uma cópia.

Documentação de operação: [instalação](instalacao.md), [recuperação](recuperacao.md), [backups](backups.md), [plano Production](migracao-production.md), [rollback](rollback.md) e [privacidade](privacidade.md).

## Evidências e decisão

Evidências sanitizadas em [audit-evidence/v1-launch](audit-evidence/v1-launch): testes publicados, HTTP autenticado, comparação de Production/SSO, restauração e avaliação do PR #2. O head final, seu CI e a publicação correspondente são registrados na [descrição do PR #3](https://github.com/Tsilveira-dev/saldolab/pull/3) após as verificações finais, mantendo este relatório rastreável aos ensaios descritos.

- [x] Código e testes novos preparados exclusivamente na branch #3; nenhuma alteração da main Git.
- [x] Preview protegido acessado sem desativar SSO.
- [x] Mecanismos suportados de revogação e recuperação administrativa ensaiados em QA.
- [x] Defeito de categoria corrigido com prova desktop/mobile publicada.
- [x] Plano de migração/configuração/rollback preparado, sem executá-lo em Production.
- [ ] Corroborar confirmação do e-mail e aceite do titular no QA correto, após a correção.
- [ ] Aceitar a janela residual JWT ou implementar/revalidar revogação adicional.
- [ ] Autorizar e executar separadamente infraestrutura Production, SMTP, role mínima, backup/alertas/privacidade e smoke da publicação autorizada.
- [ ] Emitir GO apenas quando os gates aplicáveis estiverem concluídos; manter draft até lá.

**NO-GO atual não impede revisar os commits e o plano. Ele impede tratar os ensaios QA como autorização para merge, Production ou finanças reais.**

</details>
