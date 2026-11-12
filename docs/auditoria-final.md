# SaldoLab — auditoria e revisão final do PR #1

Revisão de 12/11/2026, America/Sao_Paulo. Branch: `fix/auditoria-saldolab`. PR: https://github.com/Tsilveira-dev/saldolab/pull/1. `main` preservada em `99ae1684380674a15c81817642612d416da262e1`.

O [diagnóstico inicial](auditoria-inicial.md) foi registrado antes das primeiras alterações. Os [resultados da primeira rodada](https://github.com/Tsilveira-dev/saldolab/blob/024d0eb2793ce7924af450e7fb0ded1b272f0f61/docs/auditoria-final.md) permanecem no histórico. Esta revisão parte do commit `024d0eb` e substitui sua política de reserva automática por edição explícita. Todos os dados e perfis utilizados são fictícios e isolados.

## A. Resumo executivo

**As correções estão prontas para revisão e autorização de merge, dentro dos cenários executados.** A revisão confirmou que uma aba aberta somente para consultar reservava edição indevidamente. Também faltavam indicação visual de consulta e cobertura dos ciclos de navegação/retomada. Esses pontos foram corrigidos e os testes locais passaram.

As páginas agora abrem em **Somente leitura**. Consulta, navegação, filtros, tema, CSV e backup continuam disponíveis; criar, editar, excluir, importar, restaurar e limpar dados financeiros ficam desabilitados. **Ativar edição** recarrega a página com o mesmo mês e filtro de conta e tenta reservar uma única editora para o modo ativo, antes de sua primeira leitura financeira. Isso evita promover uma consulta com um snapshot potencialmente antigo.

A aba explicitamente ativada mantém a reserva ao navegar entre rotas internas. **Encerrar edição**, fechar/sair do documento e trocar de modo liberam a reserva. Atualizar uma consulta não a transforma em editora. Atualizar a editora tenta retomá-la no documento novo. Voltar de outro documento, inclusive pelo BFCache, mantém a sessão antiga em consulta, atualiza os dados e exige ativação para editar novamente.

Nenhuma correção foi integrada à `main` ou publicada na Vercel. Os problemas P0 da baseline continuam relevantes para a versão publicada. As correções anteriores de integridade, validação, CRUD móvel, instalação e testes foram preservadas. Não foi implementado banco de dados ou alterado outro projeto.

## B. Resultados dos testes

### Comandos executados nesta revisão

| Teste                               | Resultado local           | Evidência                                                                                                                                             | Observação                                                                                                                                                                                                    |
| ----------------------------------- | ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run check`                     | Aprovado                  | [Log completo](audit-evidence/pr1-review/check-first.log)                                                                                             | Lint sem avisos, formatação, 105 testes Vitest e build                                                                                                                                                        |
| `npm run test:e2e`                  | Aprovado                  | [74/74](audit-evidence/pr1-review/e2e-full-first.log)                                                                                                 | Desktop e emulação móvel; zero falhas e sem retries locais                                                                                                                                                    |
| `npm audit --json`                  | Aprovado                  | [Resultado](audit-evidence/pr1-review/npm-audit.json)                                                                                                 | Zero vulnerabilidades conhecidas; dependências não foram alteradas                                                                                                                                            |
| Python `unittest`                   | Aprovado                  | [2/2](audit-evidence/pr1-review/python.log)                                                                                                           | Regressão do gerador preservada                                                                                                                                                                               |
| Formatação após documentação        | Verificada antes do envio | [Log](audit-evidence/pr1-review/format-final.log)                                                                                                     | Inclui este relatório e as novas evidências                                                                                                                                                                   |
| GitHub Actions da revisão funcional | Aprovado                  | [Execução 43148562602](https://github.com/Tsilveira-dev/saldolab/actions/runs/43148562602), [resumo](audit-evidence/pr1-review/ci-final-summary.json) | Commit `bf0e4fb`: instalação limpa, check, 105 Vitest, 74 Playwright e 2 Python aprovados; sem falhas/flaky. O [Checks do PR](https://github.com/Tsilveira-dev/saldolab/pull/1/checks) acompanha o head atual |

Ambiente local: Node 24.22.1, npm 11.9.0 e Chromium 156.0.8078.79. O comando E2E usou `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium`; o cache npm ficou em `work/npm-cache`. O CI instala seu próprio Chromium com Playwright.

### Cenários solicitados

| Cenário                                                  | Resultado                  | Evidência / asserção                                                                                                                                                                            |
| -------------------------------------------------------- | -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Abrir dashboard, listar, consultar e exportar sem editar | Aprovado                   | Nenhum lock de edição e nenhuma inicialização da base financeira; testes unitários e de navegador                                                                                               |
| Consulta aberta antes de outra aba solicitar edição      | Aprovado                   | A segunda aba consegue editar; a primeira continua consultando e recebe os novos valores                                                                                                        |
| Indicação visual de consulta e controles indisponíveis   | Aprovado                   | [Desktop](audit-evidence/pr1-review/desktop-readonly.png), [mobile](audit-evidence/pr1-review/mobile-readonly.png); CTAs, ações de linhas, FAB, formulários, importação e limpeza desabilitados |
| Fechar consulta                                          | Aprovado                   | Reserva da editora permanece com o mesmo `clientId`                                                                                                                                             |
| Fechar editora / encerrar explicitamente                 | Aprovado                   | Lock desaparece; outra aba ativa edição e preserva as gravações anteriores                                                                                                                      |
| Atualizar editora                                        | Aprovado                   | Novo documento assume uma única reserva; `clientId` muda e os dados persistem                                                                                                                   |
| Atualizar consulta, inclusive após encerrar edição       | Aprovado                   | Continua em consulta e sem reserva                                                                                                                                                              |
| Navegação SPA e Voltar entre rotas internas              | Aprovado                   | Mantêm a mesma reserva, sem duplicação                                                                                                                                                          |
| Sair do documento e Voltar                               | Aprovado                   | A reserva antiga é liberada; a outra editora pode salvar; o retorno fica em consulta com os novos dados                                                                                         |
| BFCache real em consulta e antiga editora                | Aprovado localmente        | Mesmo ID de documento e `pageshow.persisted=true` nos quatro casos desktop/mobile; provas abaixo                                                                                                |
| Aba aberta pela editora                                  | Aprovado                   | Não herda permissão mesmo com estado de sessão copiado; atualizar a nova aba continua sem reservar edição                                                                                       |
| Trocar demonstração/pessoal                              | Aprovado                   | Libera o modo anterior; o novo começa em consulta; dados continuam separados                                                                                                                    |
| Falta de Web Locks / bloqueio de navegação               | Aprovado                   | Indicação de indisponibilidade; nenhuma permissão concedida; consulta e backup continuam possíveis                                                                                              |
| Create/update/delete das quatro entidades                | Aprovado                   | Retorno normalizado corresponde ao JSON realmente persistido; exclusão só conclui após conferir sua gravação                                                                                    |
| `setItem` sem efeito                                     | Aprovado em falha simulada | Create/update/delete, importação e restauração rejeitam a operação; o navegador mantém formulário com erro e não anuncia sucesso                                                                |
| Concorrência de três abas                                | Aprovado                   | 20 gravações aceitas preservadas, 40 recusas explícitas, nenhum sucesso perdido; observador novo confere registros e centavos                                                                   |
| Regressões financeiras e funcionais anteriores           | Aprovado                   | Receita 2.500→3.000→excluir, despesa 750→800→excluir, transferências, pendências, orçamentos, filtros, gráficos, backup, corrupção, cota, datas e cinco resoluções                              |

Provas do BFCache: [consulta desktop](audit-evidence/pr1-review/bfcache-reader-chromium.json), [editora desktop](audit-evidence/pr1-review/bfcache-editor-chromium.json), [consulta mobile](audit-evidence/pr1-review/bfcache-reader-mobile.json), [editora mobile](audit-evidence/pr1-review/bfcache-editor-mobile.json). As identidades antes/depois são iguais e `restored` é verdadeiro. O teste exige restauração real para a consulta; para a antiga editora, aceita também o carregamento novo que navegadores podem escolher e verifica o mesmo comportamento seguro. Nesta execução local ambos os caminhos de editora foram realmente restaurados do cache.

O Playwright desabilita BFCache por padrão. O arquivo de ciclo de vida remove explicitamente essa flag e usa `channel: chromium`, com o binário completo e o novo modo headless. O headless shell padrão do Playwright não restaurou documentos no CI, apesar de os controles e dados estarem corretos. O Voltar aguarda `commit` e o estado da aplicação, pois uma restauração do cache não dispara um novo `load`. As datas financeiras são fixadas sem substituir Navigation Timing ou o relógio das animações.

### Falhas intermediárias detectadas e resolvidas

- A reprodução inicial confirmou o dashboard de consulta segurando `saldolab:v1:demo:editor` e a segunda aba recebendo erro apesar dos botões habilitados: [JSON](audit-evidence/pr1-review/reader-blocks-before.json) e [captura](audit-evidence/pr1-review/reader-blocks-before.png).
- O relógio completo do Playwright removia Navigation Timing e impedia reconhecer uma recarga nos novos testes. A preparação passou a fixar somente `Date`, preservando navegação e eventos reais.
- Uma primeira tentativa de retomada preparada somente em `pagehide` não foi confiável nos testes. Agora a intenção de retomada é mantida enquanto a edição está ativa e descartada ao encerrar, trocar de modo, abrir uma visita normal ou retornar pelo histórico.
- Os primeiros testes de BFCache aguardavam `load` e expiravam após a restauração já ter ocorrido. Foram corrigidos para aguardar `commit` e verificar DOM, identidade e `pageshow.persisted`.
- A primeira asserção do FAB em desktop procurava um botão oculto por CSS pelo papel acessível. A verificação passou a conferir o atributo `disabled` no elemento existente.

A primeira execução no GitHub Actions teve 105 testes Vitest aprovados e 72/74 E2E: os dois casos de consulta retornaram um documento novo, falhando na exigência de BFCache real. A suíte de ciclo de vida passou a selecionar o canal Chromium completo, mantendo as asserções de identidade e `pageshow.persisted`. [Registro da execução](audit-evidence/pr1-review/ci-first-summary.json). Não foi removida a exigência de cache real para tornar o CI verde.

A execução local completa registrou 105 testes de JavaScript e 74 de navegador aprovados; a seleção explícita do canal de navegador foi rechecada em 4/4 casos locais. O CI subsequente do commit `bf0e4fb` confirmou os 105 testes Vitest, os 74 Playwright e os dois Python, sem falhas ou testes flaky: [execução aprovada](https://github.com/Tsilveira-dev/saldolab/actions/runs/43148562602).

## C. Problemas identificados nesta revisão

### REV-001 — P1 — consulta reservava edição indevidamente — corrigido

- **Componente:** `localRepository.js`, antiga aquisição automática em toda leitura.
- **Reprodução:** abrir somente o dashboard em uma aba; abrir outra e tentar salvar uma transação.
- **Resultado anterior:** a consulta segura a reserva e a outra aba não salva.
- **Causa:** `snapshot`, listagem e exportação usavam o mesmo caminho que adquiria uma reserva de editora por toda a vida do documento.
- **Correção:** leituras puras, sem reserva e sem inicialização financeira no storage. Ativação explícita num documento novo antes de sua primeira leitura. O repositório recusa promover uma sessão que já leu dados.
- **Motivo da recarga:** os testes da primeira auditoria mostraram que somente serializar operações não evitava snapshots desatualizados entre processos. Essa proteção foi preservada, sem voltar à escrita concorrente.

### REV-002 — P1 — ausência de indicação e bloqueio visual — corrigido

- **Componentes:** contexto, `EditingNotice`, componentes de ações, layout, configurações e recuperação.
- **Reprodução:** abrir uma aba sem reserva e observar criação/edição/exclusão/importação habilitadas, falhando somente ao salvar.
- **Causa:** a reserva existia apenas dentro do repositório, sem estado observável na UI.
- **Correção:** `canWrite` e assinatura de acesso no contexto; aviso persistente e ações **Ativar edição / Encerrar edição**. Escritas financeiras indisponíveis ficam desabilitadas, inclusive campos e confirmações. O repositório e o provider também verificam permissão; a proteção não depende do atributo `disabled`.
- **Preservado:** consulta, navegação, filtros, tema e exportações.

### REV-003 — P1 — ciclo da reserva sem cobertura suficiente — corrigido e testado

- **Componentes:** sessão de edição e ciclo de vida do provider.
- **Reprodução:** ativar/fechar/recarregar a editora, trocar de modo ou sair e retornar por Voltar/BFCache.
- **Causa:** a versão anterior guardava uma promessa de reserva por documento, sem expor a perda da permissão à UI ou definir claramente a retomada.
- **Correção:** sessão observável; liberação em `pagehide`, encerramento e troca de modo; sessão suspensa permanece sem escrita. Recarga retoma somente uma intenção explícita da editora anterior. No BFCache, atualizar leitura e fechar formulários/confirmadores antigos. Uma aba nova não herda permissão.
- **Regressões:** reserva pendente não pode ser concedida após sair do documento ou depois de uma leitura financeira intermediária. A navegação SPA mantém a reserva; navegação entre documentos a libera.

### REV-004 — P1 de robustez financeira — confirmação sem leitura de retorno — reforçado

- **Componente:** método de gravação do repositório.
- **Limite da constatação:** o navegador nativo deve gravar ou lançar erro em `setItem`; não foi observada uma falha nativa silenciosa. Foi injetado um `setItem` sem efeito para validar a confirmação de sucesso exigida nesta revisão.
- **Causa anterior:** confiar somente no retorno de `setItem`, sem verificar o conteúdo efetivamente disponível.
- **Correção:** validar o agregado, gravar, ler de volta e comparar o JSON. Todas as mutações financeiras usam esse caminho. Falha de confirmação rejeita a operação e pede conferir/recarregar; não promete preservação do valor anterior quando o resultado é incerto.
- **Resultado:** create/update/delete das quatro entidades correspondem ao estado persistido; cinco tipos de mutação não retornam sucesso no teste de gravação sem efeito; UI permanece com erro e sem toast de sucesso.

### Problemas da primeira auditoria

| ID      | Prioridade | Estado nesta revisão                                                                                                            |
| ------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------- |
| AUD-001 | P0         | Proteção contra perda entre abas preservada; o stress continua aprovado                                                         |
| AUD-002 | P0         | Comparação do registro esperado em editar/excluir preservada e coberta; impedimento visual de escrita em consultas acrescentado |
| AUD-003 | P1         | Correção de contenção da tabela móvel preservada; CRUD móvel aprovado                                                           |
| AUD-004 | P1         | Lockfile corrigido preservado; nenhuma dependência atualizada nesta revisão                                                     |
| AUD-005 | P1         | Descoberta restrita do Vitest preservada                                                                                        |
| AUD-006 | P2         | Seletores robustos preservados; revisão ampla de rótulos explícitos permanece pendente                                          |
| AUD-007 | P2         | Reforço de CSV para espaços/quebras antes de fórmulas permanece pendente; nenhum motor de planilha foi testado                  |
| AUD-008 | P2         | Contraste e legibilidade permanecem pendentes; identidade visual geral preservada                                               |

As reproduções, causas e evidências detalhadas desses IDs estão no [relatório da primeira rodada](https://github.com/Tsilveira-dev/saldolab/blob/024d0eb2793ce7924af450e7fb0ded1b272f0f61/docs/auditoria-final.md) e no diagnóstico inicial.

## D. Cobertura, qualidade e limites

- **105 testes Vitest aprovados**, zero reprovados, sete arquivos. A primeira rodada tinha 82; esta revisão acrescenta 23 casos de acesso, ciclo de reserva, intenção de recarga e confirmação da persistência.
- **74 execuções Playwright aprovadas**, zero reprovadas/ignoradas e sem retries locais. São 37 cenários nos projetos desktop/mobile; a primeira rodada tinha 52 execuções. Acrescentados 11 cenários de ciclo de vida, além da adaptação das verificações de abas ao fluxo explícito de edição.
- **Dois testes Python aprovados.** Total das suítes locais finais: **181 casos**. As 115 verificações adicionais de domínio da primeira auditoria permanecem como evidência histórica separada.
- **Cobertura percentual:** não medida.
- **Build:** aprovado. Permanecem somente os avisos de anotações de comentários de dependência Zod já documentados.
- **Qualidade do navegador:** contextos novos e dados fictícios; nada foi apagado de um perfil real. Sem erros de console nas capturas dos novos estados. As resoluções e o tema escuro continuam cobertos na suíte completa.
- **Limites:** mobile é emulação Chromium; Safari/iOS e Android reais não foram executados. BFCache foi comprovado localmente por eventos reais, sem simular `pageshow`. Excel/LibreOffice e uma auditoria WCAG completa continuam pendentes.

A versão corrigida não foi publicada. A validação anterior de https://saldolab.vercel.app avaliou a baseline e precisou do transporte HTTP Playwright com TLS verificado devido ao certificado da inspeção do ambiente, conforme o relatório histórico. Esta revisão não declara validação em produção das novas correções.

## E. Arquivos e correções entregues

| Arquivos                                                                                                       | Alteração                                                                                            |
| -------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `src/repositories/editingSession.js`                                                                           | Estado observável, aquisição explícita antes da primeira leitura, invalidação e liberação da reserva |
| `src/repositories/editingRequest.js`                                                                           | Intenção de navegação sem dados financeiros, consumida somente em recarga                            |
| `src/repositories/localRepository.js`                                                                          | Leituras puras, permissão exigida em toda mutação e conferência do JSON gravado                      |
| `src/context/FinanceProvider.jsx`                                                                              | Acesso no contexto, ativação/encerramento, retomada segura, troca de modo e BFCache                  |
| `src/components/EditingNotice.jsx`, `src/styles/components.css`                                                | Aviso e controles claros, com os tokens e o layout existentes                                        |
| `src/app/Layout.jsx`, `src/components/ui.jsx`, `src/components/Editors.jsx`                                    | Desabilitar CTAs, linhas, FAB, campos e confirmação quando a escrita está indisponível               |
| `src/pages/Settings.jsx`, `src/pages/StorageRecovery.jsx`                                                      | Importação/restauração/limpeza indisponíveis em consulta; exportação preservada                      |
| `src/tests/editing.test.js`, `editingRequest.test.js`                                                          | 23 novos testes de acesso, ciclo e persistência                                                      |
| `src/tests/setup.js`, `repository.test.js`, `concurrency.test.js`, `integration.test.jsx`, `provider.test.jsx` | Reservas de teste isoladas e operações anteriores adaptadas à edição explícita                       |
| `e2e/editing-lifecycle.spec.js`, `e2e/helpers.js`                                                              | 11 novos cenários, BFCache real, datas financeiras sem remover Navigation Timing                     |
| `e2e/audit.spec.js`, `e2e/concurrency.spec.js`, `e2e/finance.spec.js`                                          | Preservar e adaptar regressões à indicação e ativação da edição                                      |
| `README.md`, `docs/architecture.md`, `docs/persistence.md`, este relatório e novas evidências                  | Contrato e comportamento atualizados                                                                 |

O contrato financeiro continua assíncrono, o JSON permanece na versão 1 e as chaves financeiras não mudaram. Não foram removidas funcionalidades nem executadas migrações. O arquivo `vercel.json` continua desabilitando o deploy automático de `fix/auditoria-saldolab`.

Entrega no mesmo [PR #1](https://github.com/Tsilveira-dev/saldolab/pull/1), mantendo-o em rascunho até a decisão do responsável. `main` e a versão publicada permanecem sem estas alterações.

## F. Pendências e recomendação

**Recomendo o merge das correções após a autorização do responsável.** Os cenários críticos solicitados e as regressões anteriores passaram localmente e no CI da revisão funcional. A atualização final de documentação não altera código da aplicação; o Checks do PR acompanha a verificação do head atual. Essa recomendação não autoriza merge ou deploy e não significa aprovação completa de acessibilidade, planilhas ou aparelhos reais.

As cinco prioridades seguintes são:

1. Revisar o PR e seus Checks; antes de uma publicação autorizada, conferir backup e fechar/recarregar todas as abas antigas, pois versões anteriores não respeitam a reserva atual.
2. Reforçar AUD-007 e testar CSV em Excel/LibreOffice, preservando o ciclo de backup/restauração.
3. Corrigir contraste, legibilidade e rótulos explícitos, mantendo a identidade visual.
4. Ampliar a matriz para Firefox, WebKit/Safari e aparelhos reais, incluindo histórico/BFCache e armazenamento restrito.
5. Planejar com o responsável uma futura persistência remota com autenticação, autorização por usuário, transações, controle de concorrência e migração explícita. Nenhum banco é implementado nesta etapa.
