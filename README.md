# SaldoLab

**Suas finanças em perspectiva.** Gestão financeira pessoal com React, modos locais e acesso opcional à nuvem com Neon Auth e PostgreSQL.

> A versão 1.0 está em preparação no PR #3 e permanece **NO-GO para dados financeiros reais** até concluir o [aceite de lançamento](docs/lancamento-v1.md). Demonstração e modo pessoal ficam no navegador; o modo nuvem guarda registros por usuário no PostgreSQL. Não há sincronização automática entre esses modos.

**Prévia privada publicada com Sites:** https://saldolab-financas.boundlessonyx2.chatgpt.site

**Código e histórico atuais:** https://github.com/Tsilveira-dev/saldolab. O ZIP e o Git bundle da prévia Sites são uma entrega anterior e não incluem as correções desta auditoria.

**Production existente:** https://saldolab.vercel.app. Ela não foi atualizada nesta preparação. A fundação da nuvem está em `feat/neon-backend-foundation`, [PR #3](https://github.com/Tsilveira-dev/saldolab/pull/3), mantido em draft. Evidências publicadas e gates estão no [relatório v1.0](docs/lancamento-v1.md).

**Administrar sem Codex:** o [guia de lançamento e manutenção](docs/guia-lancamento-sem-codex.md) reúne instalação, checks, aceite, Neon Auth/SMTP, migrações, role mínima, configuração Vercel, backups, monitoramento e rollback para uso pessoal controlado.

## Executar

Requisitos: **Node.js 24 LTS**, npm e, para scripts opcionais, Python 3.10+. Os modos locais dispensam configuração. O modo nuvem exige Auth e API próprios do ambiente; siga [instalação](docs/instalacao.md), sem usar credenciais de Production em testes.

```bash
git clone https://github.com/Tsilveira-dev/saldolab.git
cd saldolab
npm ci
npm run dev
```

Abra a URL exibida pelo Vite, normalmente `http://localhost:5173`.

Para revisar esta versão antes do merge, execute `git switch feat/neon-backend-foundation` na cópia clonada. O Vite sozinho serve a interface; não hospeda as Vercel Functions de `/api`.

Para servir o build de produção:

```bash
npm run build
npm run preview
```

## Funcionalidades

- Dashboard com saldo atual, receitas, despesas, resultado, comparação mensal, orçamentos e pendências.
- CRUD de receitas, despesas e transferências; busca, ordenação, paginação e filtros combinados.
- Contas com saldo inicial e saldo calculado, incluindo transferências de entrada e saída.
- Categorias com tipo, nome, cor e ícone personalizáveis.
- Orçamentos por categoria e mês, alertas de consumo e proteção contra duplicidade.
- Relatórios com intervalo de datas, distribuição de gastos, evolução e recorrências identificadas em pelo menos três meses.
- CSV com separador `;`, UTF-8 com BOM e valores em reais, com proteção contra fórmulas inclusive após prefixos invisíveis. As correções revisadas do PR #2 foram portadas explicitamente para esta branch.
- Backup JSON versionado, validação de vínculos e confirmação antes de importar nos modos locais; na nuvem, exportação e recuperação administrativa isolada.
- Modo demonstração com seis meses de histórico e restauração; modo pessoal inicialmente vazio.
- Preferências de modo e tema persistentes, navegação móvel, foco visível, formulários rotulados e modais acessíveis.
- Recuperação de conteúdo corrompido sem sobrescrita automática.
- Nuvem opcional: cadastro/login, confirmação de e-mail por código, recuperação de senha e encerramento individual/global. A API exige JWT e sessão ativa conferida no banco; [política e limites de revogação](docs/recuperacao.md).
- Cadastro rápido de conta e categoria no formulário de transação quando faltarem vínculos, com seleção automática e preservação dos campos preenchidos.
- CRUD remoto por usuário, revisões de edição (409), backup JSON exportável e procedimento administrativo de restauração ensaiado exclusivamente em QA.

## Stack

React 19, Vite 7, JavaScript ES6+, Bootstrap 5 customizado, Lucide, React Router, Recharts, React Hook Form, Zod e date-fns. Qualidade com ESLint, Prettier, Vitest, React Testing Library e Playwright. Automação em Python sem dependências externas. Fonte Manrope servida localmente, com licença OFL incluída.

## Fluxo de uso

1. Explore a demonstração e seus gráficos.
2. Selecione **Modo pessoal** no cabeçalho ou em Configurações.
3. Clique em **Ativar edição**; a página recarrega com os dados atuais.
4. Cadastre contas e categorias, ou use o cadastro rápido oferecido na primeira transação.
5. Registre transações e defina orçamentos para o mês selecionado.
6. Consulte Relatórios e exporte CSV ou backup JSON.
7. No modo local, use **Encerrar edição** para liberar outra aba. Na nuvem, edições simultâneas são verificadas pelo servidor.

Para a nuvem, abra **Minha nuvem**, confirme seu e-mail quando solicitado e entre. Login/cadastro selecionam o espaço da nuvem; sair mantém esse espaço sem sessão, sem voltar automaticamente para os dados locais. Se você já está autenticado e escolheu outro modo, use **Abrir finanças na nuvem**. **Esqueci minha senha** envia um link; **Verificar meu e-mail** permite solicitar outro código. Use somente o ambiente informado pelo responsável: identidades e senhas de QA, development e Production são independentes. Veja [recuperação e sessões](docs/recuperacao.md).

O modo pessoal local pertence ao navegador/origem, independentemente do e-mail. Trocar de login não apaga nem transfere esses dados. Uma nova identidade na nuvem começa com seus próprios registros vazios; entrar novamente na identidade anterior recupera somente os registros dela.

Nos modos locais, as páginas abrem em **Somente leitura**. Consultar não bloqueia outras abas; **Ativar edição** reserva uma editora por modo. A nuvem exige sessão válida, oculta dados de identidades anteriores e recusa gravações indisponíveis. Use navegador atualizado em HTTPS ou localhost.

O CRUD valida a operação inteira antes de gravar. Exclusões exigem confirmação. Contas com movimentações e categorias vinculadas a transações ou orçamentos são protegidas. Alterações incompatíveis no tipo de uma categoria também são recusadas.

## Gráficos e regras financeiras

O gráfico de barras compara receitas e despesas confirmadas nos últimos seis meses. A opção **Evolução** troca para linhas e inclui o resultado. A rosca mostra a distribuição de despesas por categoria. Barras de progresso mostram consumo e limite de cada orçamento.

Todos os valores são calculados a partir dos registros e armazenados em **centavos inteiros**. Transferências não contam como receita ou despesa; pendentes não alteram o saldo disponível. O saldo atual usa todo o histórico; indicadores mensais respeitam o mês selecionado. Na página de orçamentos, o filtro de conta restringe os gastos, enquanto os limites continuam globais por categoria. Recorrências são observações do histórico, não previsões.

## Estrutura

```text
src/
  app/             roteamento, layout e limite de erro
  components/      gráficos, tabelas, formulários, modais e elementos visuais
  context/         estado da aplicação e operações assíncronas
  domain/          cálculos puros e esquemas de validação
  pages/           páginas financeiras, acesso, verificação e recuperação
  repositories/    persistência local/remota, preferências e backup v1
  services/        demonstração e exportação de arquivos
  styles/          temas, layout, componentes e responsividade
  tests/           regras, repositório e integração React
e2e/               fluxos de navegador desktop e mobile
scripts/           geração CSV e testes Python
api/               Vercel Functions, JWT, autorização e transações SQL
db/                migração inicial e operações planejadas
tests/             integrações PostgreSQL, Neon e aceite publicado em QA
docs/              arquitetura, contrato de dados e publicação
public/fonts/      fontes locais e licença
```

## Verificações

```bash
npm run lint          # ESLint, sem avisos
npm run format:check  # formatação
npm run test          # Vitest + React Testing Library
npm run check         # lint + formatação + testes + build
python3 -m unittest discover -s scripts -p 'test_*.py'
```

Para testar no navegador local:

```bash
npm run build
npx playwright install chromium
npm run test:e2e
```

A suíte usa Chromium em desktop e viewport móvel e inicia servidores locais automaticamente. Com Chromium do sistema, use `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e`. Não aponte testes de escrita a Production/development. O aceite de uma publicação isolada usa `npm run test:release`, com os guardas e variáveis descritos em [instalação](docs/instalacao.md). O CI publica relatórios como artefatos.

Os testes cobrem criação de receita e despesa, edição, confirmação de exclusão, indicadores, transferências, pendências, filtros, orçamentos, moeda, base zero, vínculos, modos e backup. Os testes React substituem apenas os componentes de gráficos, porque jsdom não tem layout SVG real; a renderização dos gráficos é verificada pela suíte de navegador.

Resultados anteriores: [auditoria do backend](docs/auditoria-backend-neon.md). Aceite atual: [lançamento v1.0](docs/lancamento-v1.md).

## Python

```bash
python3 scripts/generate_demo_data.py --seed 42 --months 6 --end-month 2026-11 --output work/demo.csv
```

Mesma semente e mês final produzem o mesmo CSV. O arquivo contém centavos inteiros, datas ISO e dados inteiramente fictícios. O script serve de base para automações futuras; não é um backend nem um importador CSV. A demonstração da aplicação é gerada em JavaScript, sem necessidade de Python no navegador.

## Persistência e evolução

Chaves locais: `saldolab:v1:demo`, `saldolab:v1:personal` e `saldolab:preferences:v1`. Os componentes não acessam `localStorage`. Os repositórios expõem operações assíncronas e validam o agregado antes da gravação. Um formato desconhecido exige recuperação explícita, sem migração destrutiva automática.

O PR #3 acrescenta Neon Auth, API autenticada e PostgreSQL por usuário, preservando os modos locais. Veja [Arquitetura](docs/architecture.md), [Contrato do repositório](docs/persistence.md) e [auditoria do backend](docs/auditoria-backend-neon.md). O servidor verifica JWT, sessão ativa e autorização por usuário; filtros do frontend não protegem acesso. As migrações `0001` e `0002` devem estar aplicadas no ambiente cloud antes do código novo; não há fallback para JWT sozinho.

## Publicação

Preparado para Vercel: preset **Vite**, instalação `npm ci`, build `npm run build` e saída `dist`. As rotas da SPA usam rewrite para `index.html`, preservando `/api/*`. Os modos locais não exigem variáveis. O modo nuvem usa as quatro variáveis de [.env.example](.env.example), com `DATABASE_URL` exclusiva do servidor e escopo do Preview conforme [documentação Neon](docs/preview-vercel-neon.md). A publicação em Production depende de autorização separada.

Repositório publicado: https://github.com/Tsilveira-dev/saldolab. O código de `main` foi confirmado no GitHub; as correções de auditoria ficam em uma branch separada, sem merge automático.

A baseline está publicada em https://saldolab.vercel.app. A branch de auditoria bloqueia seu próprio deploy automático e não altera a versão publicada. O histórico de publicação está em [docs/deployment.md](docs/deployment.md).

O PR #3 gera Previews. O merge em `main` pode disparar Production automaticamente: **não fazer merge antes de autorizar e preparar a infraestrutura**. Veja [migração e configuração Production](docs/migracao-production.md), [backups](docs/backups.md), [rollback](docs/rollback.md) e [privacidade](docs/privacidade.md).

## Capturas de tela

As capturas `dashboard.png` em desktop e mobile são geradas na suíte Playwright e podem ser obtidas no artefato `browser-verification` do GitHub Actions. O diretório [docs/screenshots](docs/screenshots/README.md) está reservado para as imagens selecionadas para o portfólio.

## Roadmap

- [x] CRUD e persistência local versionada.
- [x] Dashboard, filtros, relatórios, temas e backup.
- [x] Testes de domínio, repositório, integração e suíte de navegador.
- [x] Neon PostgreSQL e Managed Neon Auth em QA/development.
- [x] API com autorização por usuário, migração inicial e testes integrados.
- [ ] Infraestrutura Production autorizada, SMTP próprio, aceite e lançamento v1.0.
- [ ] Importação de extratos CSV com prévia e reconciliação.
- [ ] Conciliação, regras de recorrência explícitas e testes de acessibilidade ampliados.

Licença do projeto: [MIT](LICENSE). Fontes e bibliotecas mantêm suas respectivas licenças.
