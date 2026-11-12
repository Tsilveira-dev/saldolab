# SaldoLab — diagnóstico inicial do MVP

Data: 11/11/2026, America/Sao_Paulo. Baseline: `main`, commit `99ae1684380674a15c81817642612d416da262e1`.

Este relatório foi produzido antes de qualquer alteração no código da aplicação. A inspeção incluiu arquivos versionados, histórico, README, documentação, dependências instaladas, formulários/CRUD, repositórios, cálculos, gráficos e testes. Todos os dados utilizados são fictícios, em contextos Chromium isolados. Nenhum armazenamento do navegador do usuário foi acessado.

## A. Resumo executivo

**MVP reprovado para uso financeiro confiável na baseline.** Há perda de lançamentos em gravações concorrentes entre abas e sobrescrita de edições por formulários desatualizados. O CRUD de transações também fica inacessível em celular com registros na tabela.

As operações sequenciais em desktop, os saldos em centavos, as transferências, pendências, orçamentos, filtros, backup/importação, recuperação de corrupção e proteção de vínculos funcionaram nos cenários executados. `npm audit` não apontou vulnerabilidades conhecidas. Isso não elimina as falhas de integridade encontradas.

## B. Resultados executados antes das correções

| Comando / teste                                   | Resultado                | Evidência e limite                                                                                                |
| ------------------------------------------------- | ------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| `npm ci`                                          | Reprovado                | `EUSAGE`: faltam entradas `ajv@6.15.0` e `json-schema-traverse@0.4.1` no lockfile                                 |
| `npm run lint`                                    | Aprovado                 | Código de saída 0                                                                                                 |
| `npm run format:check`                            | Aprovado                 | Código de saída 0                                                                                                 |
| `npm run test`                                    | Reprovado / interrompido | Descobriu testes de dependências em `work/vercel-cli/node_modules`; execução interrompida, sem total final válido |
| `npm run test -- src/tests`                       | Aprovado                 | 65 testes, 3 arquivos; executados com as dependências existentes, pois a instalação limpa falhou                  |
| `npm run build`                                   | Aprovado                 | Build de produção completo; avisos de anotações de comentários da dependência Zod                                 |
| `npm run test:e2e`                                | Não executou os fluxos   | Os 12 casos falharam ao iniciar: navegador esperado pelo Playwright ausente no cache                              |
| E2E original com Chromium instalado               | Reprovado                | 8 aprovados e 4 reprovados; reproduziu o resultado do CI por seletores exatos de rótulos de `select`              |
| Auditoria funcional local, desktop/mobile         | Reprovado                | 23/26 aprovados; 3 falhas reais de edição de transação no celular                                                 |
| Complemento funcional local                       | Aprovado                 | 4/4: filtros, datas, relatórios, CSV, valores inválidos e transferência inválida                                  |
| Auditoria funcional da URL publicada              | Reprovado                | 22/26 aprovados; 3 falhas reais de edição móvel e 1 falha do encerramento do transporte de QA                     |
| Complemento publicado e rechecagem da recuperação | Aprovado                 | 6/6, após aguardar as rotas de rede em andamento no encerramento do teste                                         |
| Cálculos e validações em cinco fusos              | Aprovado                 | 115 verificações; UTC, São Paulo, Nova York, Tóquio e Kiritimati                                                  |
| Concorrência: três abas, 60 criações              | Reprovado                | As 60 operações retornaram sucesso, mas apenas 20 foram preservadas: 40 registros fictícios perdidos              |
| Edição com formulário antigo em outra aba         | Reprovado                | Valor salvo de 250.000 centavos voltou para 100.000 centavos sem alerta                                           |
| `npm audit --json`                                | Aprovado                 | 0 vulnerabilidades conhecidas, 347 dependências contabilizadas                                                    |
| Comparação dos assets publicados                  | Aprovado                 | Os 7 arquivos JS/CSS publicados são idênticos, byte a byte, ao build local                                        |

O CI anterior do GitHub Actions também registrou 8/12 E2E aprovados e 4 falhas: https://github.com/Tsilveira-dev/saldolab/actions/runs/43128788325.

Os testes adicionais cobriram receita de R$ 2.500,00, edição para R$ 3.000,00, exclusão, despesa de R$ 750,00, contas, categorias em uso, orçamento excedido, backup real baixado, importação com confirmação, erro de cota, bloqueio de armazenamento e conteúdo HTML exibido como texto.

## C. Problemas identificados

### AUD-001 — P0 — perda de registros entre abas

- **Componente:** `src/repositories/localRepository.js`.
- **Reprodução:** iniciar três abas isoladas da mesma origem, com 3.000 registros fictícios; cada aba cria mais 20 registros simultaneamente.
- **Resultado:** contagem esperada 3.060; observada 3.020. As operações retornaram sucesso. O saldo correspondente ficou 40 centavos abaixo do esperado.
- **Causa:** leitura, alteração e gravação do agregado sem exclusão mútua entre abas. `setItem` é atômico, mas a sequência inteira não é.
- **Solução:** serializar operações por modo/origem com Web Locks. Em navegador sem suporte, preservar leitura/exportação dos dados existentes e impedir escrita sem garantia de exclusão mútua.
- **Evidência:** [concurrency-before.json](audit-evidence/concurrency-before.json).

### AUD-002 — P0 — formulário desatualizado desfaz alteração já salva

- **Componente:** repositório, provider e formulário de edição.
- **Reprodução:** abrir a mesma receita em duas abas; na primeira, mudar o valor para R$ 2.500,00; na segunda, alterar somente a descrição e salvar o formulário ainda contendo R$ 1.000,00.
- **Resultado:** o valor volta para R$ 1.000,00, sem aviso. Não depende de submissões no mesmo instante.
- **Causa:** atualização aceita o registro completo sem verificar se a versão apresentada no formulário ainda corresponde à versão persistida.
- **Solução:** verificar o registro esperado dentro do mesmo bloqueio da escrita; rejeitar atualização e exclusão desatualizadas com mensagem clara.
- **Evidência:** [stale-edit-before.json](audit-evidence/stale-edit-before.json).

### AUD-003 — P1 — edição de transações inacessível no celular

- **Componente:** `TransactionTable.jsx` e CSS da tabela.
- **Reprodução:** viewport de 390 × 844, com emulação móvel, abrir Transações com uma linha e tentar clicar em Editar.
- **Resultado:** a largura visual é 390 px, mas a largura de overflow do documento chega a 614 px; o navegador desloca o viewport e o clique atinge outros elementos.
- **Causa:** o `span.visually-hidden` do cabeçalho Ações é posicionado absolutamente sem um ancestral posicionado dentro da tabela; escapa da contenção horizontal.
- **Solução:** estabelecer contenção de posicionamento no cabeçalho. A hipótese foi confirmada por CSS temporário apenas no perfil de teste: a largura voltou a 390 px e o modal abriu.
- **Evidências:** [geometria](audit-evidence/mobile-before.json) e [captura](audit-evidence/mobile-before.png).
- **Lacuna do teste antigo:** comparar `scrollWidth` a `innerWidth` não detecta esse caso, pois ambos crescem. Comparar ao `clientWidth`/viewport configurado e testar tabela com dados.

### AUD-004 — P1 — instalação limpa não reproduzível

- **Componente:** `package-lock.json`.
- **Reprodução:** executar `npm ci` com Node 24.22.1 / npm 11.9.0.
- **Causa:** resolução inconsistente de dependências transitivas AJV no lockfile.
- **Solução:** reconciliar o lockfile sem atualizar versões principais nem executar `npm audit fix --force`; validar novamente por instalação limpa.

### AUD-005 — P1 — descoberta de testes fora do projeto

- **Componente:** `vite.config.js`.
- **Reprodução:** manter ferramentas temporárias ignoradas em `work/` e executar `npm run test`.
- **Causa:** configuração substitui os padrões de exclusão por `node_modules/**`, que não protege dependências aninhadas em `work/`.
- **Solução:** restringir a descoberta aos testes do projeto e excluir explicitamente diretórios aninhados de dependências e arquivos temporários.

### AUD-006 — P2 — rótulos de selects e testes E2E frágeis

Os rótulos implícitos contêm também o texto das opções. Os seletores exatos `getByLabel('Categoria', { exact: true })` e `getByLabel('Modo de uso', { exact: true })` não encontram os controles em Chromium real, embora os testes jsdom passem. Ajustar os testes para controles semânticos estáveis; recomendar rótulos explícitos em uma revisão de acessibilidade.

### AUD-007 — P2 — proteção CSV incompleta para espaços/quebras iniciais

`services/files.js` trata caracteres de fórmula no primeiro caractere, mas observações e IDs importados podem começar por espaços ou LF antes de `=`, `+`, `-` ou `@`. Não foi executado um motor de planilha e não se afirma execução de fórmula nesta auditoria. Recomenda-se ampliar a normalização/escape e validar nos consumidores suportados.

### AUD-008 — P2/P3 — acessibilidade e documentação

Há textos pequenos e contrastes de texto secundário que precisam de revisão específica WCAG. README e documentação ainda descrevem o GitHub como não enviado e a Vercel como não publicada, apesar dos estados agora observados. A revisão visual geral não faz parte das correções críticas.

## D. Limites e qualidade da evidência

- Cobertura percentual de código não foi medida; quantidade de testes não equivale a cobertura completa.
- Browser utilizado: Chromium 156.0.8078.79. A emulação móvel não substitui testes em aparelho real/Safari.
- Foram capturadas telas em 1440 × 900, 1366 × 768, 768 × 1024, 390 × 844 e 360 × 740, incluindo tema escuro e modais.
- O Chromium não confiou diretamente no certificado da inspeção HTTPS do ambiente. Para a URL publicada, o navegador recebeu recursos reais por `route.fulfill` a partir do cliente HTTP Playwright com o proxy e a CA configurados. A verificação TLS permaneceu ativa; não foram usados `ignoreHTTPSErrors` nem flags para ignorar certificados.
- Esse transporte de QA valida os recursos publicados e os fluxos da aplicação; não aprova a conexão TLS direta do Chromium. O transporte foi aguardado no teardown após uma falha de favicon em andamento.
- A API Vercel retornou 404 para o projeto na equipe anteriormente conhecida; o commit de deploy não pôde ser confirmado por metadados. A equivalência de aplicação foi comprovada pelos sete hashes/bytes JS/CSS.

## E. Plano de correções autorizado

As correções P0/P1 serão feitas somente em `fix/auditoria-saldolab`, acompanhadas de testes de regressão. O código de `main` e a aplicação publicada permanecerão sem alterações. Os seletores e a infraestrutura de testes serão ajustados para tornar a validação reproduzível.

## F. Cinco prioridades posteriores

1. Revisar e aprovar as correções de concorrência antes de usar o MVP com dados financeiros importantes.
2. Tornar o CI uma barreira efetiva de qualidade, com testes móveis e financeiros reais.
3. Ampliar acessibilidade, legibilidade e testes em dispositivos/navegadores reais.
4. Fortalecer exportações e o ciclo de recuperação de dados, documentando limites do navegador.
5. Somente após a escolha do responsável, planejar API/banco com autorização por usuário, migração e controle de concorrência no servidor.
