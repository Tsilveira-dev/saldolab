# SaldoLab — auditoria técnica, testes e correções do MVP

Auditoria iniciada em 11/11/2026, America/Sao_Paulo. Repositório: https://github.com/Tsilveira-dev/saldolab. Baseline: `main` em `99ae1684380674a15c81817642612d416da262e1`. Correções: [fix/auditoria-saldolab](https://github.com/Tsilveira-dev/saldolab/tree/fix/auditoria-saldolab).

O [diagnóstico inicial](auditoria-inicial.md) foi registrado no commit `18f6e11` antes de modificar a aplicação. Esta auditoria utilizou somente dados fictícios e contextos de navegador isolados. Nenhum perfil ou dado financeiro real do usuário foi acessado.

## A. Resumo executivo

**A versão publicada continua reprovada para uso financeiro confiável:** foram reproduzidas perda de lançamentos entre abas, sobrescrita de valores por formulário antigo e falha de edição no celular. As correções estão na branch separada e passaram nos cenários executados. Não houve merge nem deploy.

Foram aprovados na branch: CRUD das quatro entidades, saldos em centavos, pendências, transferências sem duplicar receitas/despesas, filtros, relatórios, gráficos, orçamentos excedidos, backup/importação, recuperação explícita de corrupção, erros de cota e separação demonstração/pessoal. Instalação limpa, lint, formatação, build e as suítes automatizadas passaram.

A proteção adotada permite **uma aba editora por modo**. Outras abas preservam leitura e exportação, mas não podem gravar. Para transferir a edição, fechar a aba editora e recarregar a outra. Sem Web Locks/contexto seguro, os dados existentes ficam disponíveis para leitura/backup e a escrita é recusada. Isso evita confirmar uma gravação que depois desaparece; não oferece edição colaborativa.

Permanecem pendências P2 de contraste/acessibilidade e reforço da proteção CSV. O armazenamento local não oferece conta de usuário, backup remoto ou recuperação após limpeza do navegador. Aprovação dos cenários executados não equivale a certificação de segurança ou autorização de produção.

## B. Resultados dos testes

### Comandos, na ordem solicitada

| Teste                  | Baseline                          | Após correções | Evidência / observação                                                                                                                     |
| ---------------------- | --------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm ci`               | Reprovado                         | Aprovado       | [Log final](audit-evidence/validated-1.log); lockfile reconciliado, sem atualização principal                                              |
| `npm run lint`         | Aprovado                          | Aprovado       | [Log](audit-evidence/validated-2.log), sem avisos                                                                                          |
| `npm run format:check` | Aprovado                          | Aprovado       | [Log da sequência](audit-evidence/validated-3.log); documentação e teste adicional conferidos novamente                                    |
| `npm run test`         | Descoberta indevida, interrompido | Aprovado       | [82 testes finais](audit-evidence/unit-complete-82.log); a sequência completa anterior tinha 81, antes do teste adicional de troca de modo |
| `npm run build`        | Aprovado                          | Aprovado       | [Log](audit-evidence/validated-5.log); avisos de comentários da dependência Zod não impedem o build                                        |
| `npm run test:e2e`     | 8/12 com navegador disponível     | Aprovado       | [52/52](audit-evidence/validated-6.log), desktop e emulação móvel, sem retries locais                                                      |

[Códigos de saída, duração e ambiente da sequência](audit-evidence/validated-command-results.json). Node 24.22.1, npm 11.9.0 e Chromium 156.0.8078.79. Foram usadas as variáveis `npm_config_cache=work/npm-cache` e `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium`.

Falhas e rechecagens registradas:

- A instalação inicial falhou com `EUSAGE`, por entradas transitivas AJV ausentes/inconsistentes no lockfile: [log](audit-evidence/baseline-1.log). Impacto: ambiente limpo/CI não reproduzível; correção: reconciliar o lockfile.
- A descoberta original de Vitest entrou em dependências temporárias de `work/`; a execução foi interrompida, sem contagem final válida. Os 65 testes restritos a `src/tests` passaram na baseline. Correção: limitar a descoberta aos testes do projeto.
- O primeiro E2E não iniciou fluxos, pois o navegador esperado não estava no cache. Com Chromium instalado, 8/12 passaram e quatro seletores exatos falharam: [resumo](audit-evidence/baseline-browser-results-summary.json). Foram ajustados os seletores semânticos.
- Uma repetição falhou porque o cache npm padrão do sandbox não era gravável; os comandos seguintes ficaram sem binários. Foi corrigida a configuração do ambiente, sem mudar dependências: [registro](audit-evidence/environment-retry-summary.json).
- A primeira rodada das correções terminou com 50/52 E2E: a nova comparação de registro antigo recusava um orçamento com campos calculados pelo cartão. A UI passou a enviar o registro original; [rechecagem 2/2](audit-evidence/budget-recheck.log), seguida de 52/52 completos.
- Ao ampliar as asserções de atualização dos tooltips após CRUD, um helper tentou medir um path SVG substituído durante a animação e falhou em dois dos quatro casos. A medição passou a usar o contêiner estável do gráfico, aguardando o tooltip; [falha do helper](audit-evidence/chart-hover-harness-before.log) e [rechecagem 4/4](audit-evidence/chart-crud-after.log). Não foi uma falha de cálculo financeiro.

### Fluxos, integridade e segurança

| Teste                                           | Resultado                             | Evidência                                                                                                                                                      | Observações                                                                                                   |
| ----------------------------------------------- | ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Receita R$ 2.500 → R$ 3.000 → excluir           | Aprovado na branch                    | `e2e/audit.spec.js`, log E2E                                                                                                                                   | Listagem, recarga, saldo, totais e série do gráfico                                                           |
| Despesa R$ 750 → R$ 800 → excluir               | Aprovado na branch                    | Mesmo arquivo/log                                                                                                                                              | Saldo e distribuição por categoria recalculados                                                               |
| Contas e transferências                         | Aprovado na branch                    | Mesmo arquivo/log                                                                                                                                              | CRUD, saldo inicial, origem/destino e bloqueio de exclusão vinculada                                          |
| Categorias                                      | Aprovado na branch                    | Mesmo arquivo/log                                                                                                                                              | Criar, editar, vincular; exclusão em uso recusada                                                             |
| Orçamento R$ 1.000, gasto R$ 750, limite R$ 500 | Aprovado na branch                    | Mesmo arquivo/log                                                                                                                                              | 75% → 150%, excedente R$ 250, duplicata recusada e exclusão                                                   |
| Pendências, filtros, relatórios e CSV           | Aprovado nos casos executados         | Mesmo arquivo/log                                                                                                                                              | Valores zero/inválidos e transferência para mesma conta recusados; ressalva CSV em AUD-007                    |
| Backup/importação e corrupção                   | Aprovado na branch                    | Mesmo arquivo/log                                                                                                                                              | Arquivo baixado e lido; importação válida só após confirmação; bruto corrompido preservado/exportável         |
| Cota e armazenamento bloqueado                  | Aprovado na branch                    | Mesmo arquivo/log                                                                                                                                              | Mensagens de erro e dados anteriores preservados                                                              |
| Modos e restauração demo                        | Aprovado na branch                    | E2E e `provider.test.jsx`                                                                                                                                      | Demo alterada e restaurada sem afetar pessoal; conclusão assíncrona antiga não troca dados do modo atual      |
| Concorrência: três abas, 60 tentativas          | Aprovado para política de uma editora | [Antes](audit-evidence/concurrency-before.json), [depois](audit-evidence/concurrency-after.json)                                                               | Antes: 60 sucessos, 40 perdidos. Depois: 20 sucessos preservados, 40 recusas explícitas, zero sucesso perdido |
| Edição/exclusão desatualizadas                  | Aprovado na branch                    | `e2e/concurrency.spec.js`, `src/tests/concurrency.test.js`                                                                                                     | Valor recente preservado; fechar editora e recarregar permite editar na outra aba                             |
| Datas/cálculos em cinco fusos                   | Aprovado                              | [115 verificações da baseline](audit-evidence/domain-baseline.json), E2E final                                                                                 | UTC, São Paulo, Nova York, Tóquio e Kiritimati; centavos, virada de ano e datas inválidas                     |
| Tooltips e gráficos SVG reais                   | Aprovado na amostra                   | [Valores](audit-evidence/charts-after.json), [captura](audit-evidence/charts-after.png)                                                                        | Barras/linhas coincidiram com indicadores; rosca com categoria; zero erro de console/rede nessa execução      |
| Cinco resoluções, menu, tema e modais           | Aprovado nos fluxos executados        | E2E, [mobile corrigido](audit-evidence/mobile-after.png)                                                                                                       | 1440×900, 1366×768, 768×1024, 390×844, 360×740; contraste continua pendente                                   |
| Contraste de texto do dashboard                 | Reprovado                             | [Amostra computada](audit-evidence/contrast-after.json), [tema claro](audit-evidence/desktop-light-after.png), [escuro](audit-evidence/desktop-dark-after.png) | AUD-008; não é auditoria WCAG completa                                                                        |
| Entrada HTML maliciosa                          | Aprovado no payload testado           | E2E funcional                                                                                                                                                  | HTML exibido como texto; não criou imagem nem executou handler                                                |
| `npm audit --json`                              | Aprovado                              | [Resultado](audit-evidence/npm-audit-validated.json)                                                                                                           | Zero vulnerabilidades conhecidas; não prova ausência de falhas no código                                      |
| Python `unittest`                               | Aprovado                              | [2/2](audit-evidence/python-validated.log)                                                                                                                     | Reprodutibilidade e integridade do gerador                                                                    |
| Excel/LibreOffice, Safari/iOS e Android reais   | Não executado                         | Limitação declarada                                                                                                                                            | Sem aprovação desses consumidores/dispositivos                                                                |

### Aplicação publicada

A URL https://saldolab.vercel.app e suas sete páginas foram acessadas, incluindo rotas diretas. [Sete assets JS/CSS](audit-evidence/production-assets-before.json) coincidiram byte a byte com o build da baseline. Não foi possível confirmar o commit por metadados Vercel: a consulta ao projeto na equipe conhecida retornou 404.

Na [rodada publicada](audit-evidence/functional-production-summary.json), 22/26 casos passaram: três falharam pela edição móvel e um por encerramento do transporte de QA enquanto uma requisição ainda estava em andamento. O [complemento publicado](audit-evidence/functional-production-supplement-summary.json) passou em 6/6, incluindo a rechecagem de recuperação após corrigir esse encerramento. Isso não elimina as três falhas de produto. O [formulário antigo também foi reproduzido na URL publicada](audit-evidence/stale-edit-production.json): 250.000 centavos voltaram para 100.000.

Localmente, a auditoria funcional inicial teve [23/26](audit-evidence/functional-local-summary.json), mais [4/4 complementares](audit-evidence/functional-local-supplement-summary.json). Os três casos móveis foram corrigidos e passaram na suíte final da branch.

**Limite de HTTPS:** o Chromium recusou diretamente o certificado da inspeção HTTPS deste ambiente (`ERR_CERT_AUTHORITY_INVALID`). Os fluxos publicados usaram recursos reais obtidos pelo cliente HTTP Playwright com proxy e CA confiáveis, repassados ao navegador por `route.fulfill`. TLS permaneceu validado; não foram usados mocks do produto, `ignoreHTTPSErrors` ou flags para ignorar certificados. Esses testes aprovam os fluxos entregues por esse transporte, sem aprovar TLS direto do Chromium. A branch corrigida não foi publicada nem testada em produção.

A [checagem HTTP final](audit-evidence/production-http-final.json) retornou 200 para as sete rotas, ainda com a entrada JS da baseline. As sondagens de `/.env`, `/.git/config`, `/package.json` e `/entrega/saldolab.zip` receberam o HTML da SPA, idêntico ao da raiz; não expuseram esses arquivos nos caminhos testados. Isso não é uma varredura exaustiva de todos os caminhos.

## C. Problemas identificados

### AUD-001 — P0 — perda de lançamentos entre abas — corrigido na branch

- **Componente:** `src/repositories/localRepository.js`.
- **Reprodução:** três abas da mesma origem, 3.000 registros de um centavo, 20 criações simultâneas por aba.
- **Resultado original:** todas as 60 operações retornaram sucesso; agregado final com 3.020 registros, em vez de 3.060, e saldo 40 centavos menor.
- **Causa:** sequência leitura/alteração/gravação do agregado sem controle de concorrência. Além disso, a experiência com bloqueio apenas por operação ainda perdeu 25 registros por snapshots locais desatualizados entre processos do navegador: [alternativa rejeitada](audit-evidence/operation-lock-only-rejected.json).
- **Solução:** reserva de uma aba editora por modo durante a vida do documento, serialização de operações na aba e recusa explícita de outras escritoras. Navegadores sem proteção ficam sem escrita. JSON v1 e chaves existentes preservados.
- **Regressão:** três abas e observador novo confirmam 3.020 registros para 20 gravações aceitas, sem perda de sucesso confirmado. Não se afirma que as 60 tentativas foram aceitas.

### AUD-002 — P0 — formulário antigo sobrescreve valor salvo — corrigido na branch

- **Componentes:** repositório, `FinanceProvider.jsx`, `Editors.jsx` e ações de `Budgets.jsx`.
- **Reprodução:** editar a mesma receita em duas abas; salvar R$ 2.500 na primeira; alterar somente a descrição na segunda, que ainda contém R$ 1.000, e salvar.
- **Resultado original:** valor volta silenciosamente para R$ 1.000, inclusive na URL publicada.
- **Causa:** o salvamento não verifica se o registro exibido ainda corresponde ao persistido.
- **Solução:** UI envia o registro original; update/delete comparam o esperado antes da alteração, dentro da operação protegida. Conflito mantém o modal com erro e preserva os dados. A reserva da aba também impede outras escritoras.
- **Regressão:** edição e exclusão antigas recusadas; edição atual funciona. O teste de orçamento detectou uma regressão intermediária por campos calculados extras; as ações agora recebem o registro persistido original, e a suíte completa passou.

### AUD-003 — P1 — CRUD de transação inacessível no celular — corrigido na branch

- **Componentes:** `TransactionTable.jsx` / `src/styles/components.css`.
- **Reprodução:** abrir tabela com registros em 390×844, com emulação móvel, e clicar em Editar.
- **Causa:** `span.visually-hidden` absolutamente posicionado no cabeçalho Ações escapa da contenção da tabela, levando o documento a 614 px e deslocando os cliques.
- **Solução:** `position: relative` nos cabeçalhos; preservar a rolagem da tabela dentro de seu contêiner.
- **Evidência:** [antes](audit-evidence/mobile-before.png), [geometria anterior](audit-evidence/mobile-before.json), [geometria corrigida](audit-evidence/mobile-after.json). Após: documento com 390 px, modal abre e edição passa.
- **Teste corrigido:** comparar `scrollWidth` ao `clientWidth`, pois `innerWidth` também era indevidamente ampliado.

### AUD-004 — P1 — `npm ci` falha — corrigido na branch

- **Componente:** `package-lock.json`.
- **Reprodução:** instalação limpa em Node 24/npm 11.
- **Causa:** entradas transitivas AJV/json-schema-traverse inconsistentes com a árvore exigida pelo ESLint.
- **Impacto:** instalação/CI não reproduzível.
- **Solução:** reconciliar apenas o lockfile, mantendo versões principais; instalação limpa e auditoria de dependências repetidas com sucesso.

### AUD-005 — P1 — Vitest executa testes de ferramentas temporárias — corrigido na branch

- **Componente:** `vite.config.js`.
- **Reprodução:** executar `npm run test` com dependências auxiliares em `work/vercel-cli/node_modules`.
- **Causa:** exclusão `node_modules/**` cobre somente a raiz; substituía os padrões esperados.
- **Impacto:** execução entra em dependências e não produz resultado confiável do projeto.
- **Solução:** incluir somente `src/**/*.test.{js,jsx}` e excluir dependências aninhadas, E2E e `work/`.

### AUD-006 — P2 — seletores E2E frágeis — testes corrigidos; acessibilidade a revisar

- **Componente:** rótulos implícitos de selects e `e2e/finance.spec.js`.
- **Reprodução:** selecionar Categoria ou Modo de uso por rótulo exato no Chromium.
- **Causa:** o nome acessível inclui textos das opções; o seletor exato não encontra o controle, embora jsdom aceite.
- **Solução aplicada:** localizar o controle por papel `combobox` e prefixo de nome, sem depender das opções. Os quatro casos passaram.
- **Pendente:** revisar rótulos explícitos/associação `id`–`htmlFor` em uma revisão de acessibilidade.

### AUD-007 — P2 — proteção CSV incompleta — pendente

- **Componente:** `src/services/files.js`, `escapeCsv`.
- **Reprodução de código:** exportar observação ou ID importado iniciando por espaço ou LF seguido de `=`, `+`, `-` ou `@`; a proteção verifica somente o primeiro caractere.
- **Causa:** normalização incompleta de conteúdo antes do detector de fórmula.
- **Risco:** tratamento inseguro por certos consumidores de planilhas. Não foi executada planilha para confirmar execução de fórmula.
- **Solução recomendada:** ampliar o escape conforme os consumidores suportados e testar arquivos reais em Excel/LibreOffice. Sem alteração nesta rodada de P0/P1; a afirmação ampla de proteção no README foi corrigida.

### AUD-008 — P2 — contraste insuficiente e textos pequenos — pendente

- **Componentes:** tokens, navegação e textos secundários; temas claro e escuro.
- **Reprodução:** abrir dashboard e comparar as cores computadas de texto/fundo. No menu escuro, o item ativo tem aproximadamente 2,10:1; itens inativos no tema claro, 3,66:1. Esses textos de 12 px exigem 4,5:1 no critério WCAG AA de texto normal.
- **Causa:** cores fixas e tokens secundários claros/escuros insuficientes, além de textos auxiliares de 8–10 px.
- **Evidência:** amostra de 128 elementos de texto por tema; 81 no claro e 11 no escuro abaixo do mínimo calculado. Fundos sólidos compostos em sRGB; não é auditoria completa de todos os estados/páginas.
- **Solução recomendada:** ajustar tokens e estados ativos, aumentar legibilidade e conferir teclado, foco, zoom e leitores de tela sem mudar a identidade geral.
- **Documentação:** estados antigos de GitHub/Vercel foram atualizados; o diagnóstico inicial permanece como registro histórico.

## D. Cobertura e qualidade

- **Vitest:** 82 aprovados, zero reprovados, cinco arquivos. Baseline: 65 testes do projeto; adicionados 17 casos de regressão/limites.
- **Playwright:** 52 aprovados, zero reprovados, zero ignorados na execução local final; 26 cenários executados nos projetos desktop/mobile. Baseline original: 12 execuções, das quais quatro falhavam por seletores.
- **Python:** dois aprovados, zero reprovados.
- **Total das suítes finais:** 136 casos aprovados. As 115 verificações adicionais de domínio/fusos da baseline são registradas separadamente, sem inflar a contagem das suítes.
- **Cobertura percentual de código:** não medida.
- **Build:** aprovado; sem novos avisos de código próprio. As anotações removidas pelo Rollup pertencem ao Zod.
- **Segurança:** validação do agregado, vínculos, IDs, datas e dinheiro exercitados; payload XSS ficou como texto; zero dependência vulnerável conhecida em `npm audit`. Não há autenticação/banco remoto ou chaves de API exigidas. Não foi implementada criptografia de armazenamento local.

## E. Correções realizadas

| Arquivos                                                                                                  | Alteração / motivo                                                                                                                   |
| --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `src/repositories/localRepository.js`                                                                     | Aba editora, operações serializadas, detecção de registro antigo, erros seguros e retorno normalizado do registro salvo              |
| `src/context/FinanceProvider.jsx`, `src/components/Editors.jsx`                                           | Registro esperado em editar/excluir; resultado assíncrono de outro modo não substitui o atual                                        |
| `src/pages/Budgets.jsx`                                                                                   | Separar registro original de valores calculados para edição/exclusão com verificação de conflito                                     |
| `src/styles/components.css`                                                                               | Conter o rótulo oculto e recuperar os cliques no celular                                                                             |
| `package-lock.json`, `vite.config.js`                                                                     | Instalação reproduzível e descoberta restrita de testes                                                                              |
| `src/tests/concurrency.test.js`, `provider.test.jsx`, `finance.test.js`, `repository.test.js`, `setup.js` | 17 novos casos: conflitos, concorrência, falta de API, troca assíncrona de modo, IDs duplicados, inexistentes, virada de ano e datas |
| `e2e/audit.spec.js`, `concurrency.spec.js`, `finance.spec.js`, `playwright.config.js`                     | 40 execuções adicionais desktop/mobile e seletores robustos; Chromium do sistema opcional; dois workers                              |
| `vercel.json`                                                                                             | Bloquear deploy automático da branch de auditoria                                                                                    |
| `README.md`, `docs/`                                                                                      | Diagnóstico antes das alterações, evidências, política de edição, resultados e estados de publicação atuais                          |

Branch para revisão: https://github.com/Tsilveira-dev/saldolab/tree/fix/auditoria-saldolab. Nenhum dado financeiro foi migrado, nenhuma chave foi apagada e não foi adicionado banco remoto. A aplicação publicada permanece com a baseline.

## F. Cinco melhorias prioritárias

1. **Revisar e liberar as correções de integridade**, com backup conferido, fechamento das abas antigas e validação posterior à publicação aprovada. Até lá, não aprovar a baseline para dados financeiros importantes.
2. **Exigir CI aprovado para integrar mudanças**, incluindo concorrência, perda de atualização, CRUD móvel e recuperação. Ampliar a matriz para Firefox/WebKit e aparelhos reais.
3. **Fortalecer exportação e recuperação**, tratando AUD-007, validando CSV em planilhas e oferecendo lembretes/testes de restauração de backup e limites de cota.
4. **Revisar acessibilidade e feedback**, corrigindo contraste/legibilidade, rótulos e estados de foco; tornar a condição de aba somente leitura visível antes de preencher um formulário.
5. **Planejar persistência remota com o responsável**, escolhendo provedor e autenticação antes de implementar. Exigir autorização por usuário, transações, restrições financeiras, migrações testadas, trilha de auditoria e importação explícita do JSON local.
