# SaldoLab

**Suas finanças em perspectiva.** Uma aplicação de gestão financeira pessoal com React, construída para demonstrar CRUD completo, regras de negócio testadas e uma interface de produto.

> Os dados ficam somente no navegador. Esta versão não possui autenticação, banco remoto ou sincronização. Exporte backups regularmente. O modo demonstração usa exclusivamente registros fictícios.

**Prévia privada publicada com Sites:** https://saldolab-financas.boundlessonyx2.chatgpt.site

**Código e histórico para download:** abra https://saldolab-financas.boundlessonyx2.chatgpt.site/entrega/index.html. O ZIP contém o projeto sem dependências; o Git bundle preserva os commits. A publicação Vercel continua pendente dos acessos descritos abaixo.

## Executar

Requisitos: **Node.js 24 LTS**, npm e, para os scripts opcionais, Python 3.10 ou superior. Nenhuma variável de ambiente ou chave de API é necessária.

```bash
# Extraia o ZIP entregue e abra a pasta do projeto:
cd saldolab
npm ci
npm run dev
```

Abra a URL exibida pelo Vite, normalmente `http://localhost:5173`. Para servir o build de produção:

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
- CSV com separador `;`, UTF-8 com BOM, valores em reais e proteção contra fórmulas em planilhas.
- Backup JSON versionado, validação de vínculos e confirmação antes de importar.
- Modo demonstração com seis meses de histórico e restauração; modo pessoal inicialmente vazio.
- Preferências de modo e tema persistentes, navegação móvel, foco visível, formulários rotulados e modais acessíveis.
- Recuperação de conteúdo corrompido sem sobrescrita automática.

## Stack

React 19, Vite 7, JavaScript ES6+, Bootstrap 5 customizado, Lucide, React Router, Recharts, React Hook Form, Zod e date-fns. Qualidade com ESLint, Prettier, Vitest, React Testing Library e Playwright. Automação em Python sem dependências externas. Fonte Manrope servida localmente, com licença OFL incluída.

## Fluxo de uso

1. Explore a demonstração e seus gráficos.
2. Selecione **Modo pessoal** no cabeçalho ou em Configurações.
3. Cadastre contas e categorias antes das primeiras receitas ou despesas.
4. Registre transações e defina orçamentos para o mês selecionado.
5. Consulte Relatórios e exporte CSV ou backup JSON.

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
  pages/           sete páginas do produto e recuperação de armazenamento
  repositories/    persistência local e preferências
  services/        demonstração e exportação de arquivos
  styles/          temas, layout, componentes e responsividade
  tests/           regras, repositório e integração React
e2e/               fluxos de navegador desktop e mobile
scripts/           geração CSV e testes Python
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

A suíte usa Chromium em desktop e em viewport móvel. O servidor de preview é iniciado automaticamente. Para testar uma publicação já acessível, use `BASE_URL=https://seu-dominio.vercel.app npm run test:e2e`. Cada teste tem contexto de navegador isolado. O workflow GitHub Actions executa as verificações e publica relatórios de navegador como artefatos; também permite informar uma URL via **Run workflow**.

Os testes cobrem criação de receita e despesa, edição, confirmação de exclusão, indicadores, transferências, pendências, filtros, orçamentos, moeda, base zero, vínculos, modos e backup. Os testes React substituem apenas os componentes de gráficos, porque jsdom não tem layout SVG real; a renderização dos gráficos é verificada pela suíte de navegador.

Resultados e limitações da entrega: [docs/validation.md](docs/validation.md).

## Python

```bash
python3 scripts/generate_demo_data.py --seed 42 --months 6 --end-month 2026-11 --output work/demo.csv
```

Mesma semente e mês final produzem o mesmo CSV. O arquivo contém centavos inteiros, datas ISO e dados inteiramente fictícios. O script serve de base para automações futuras; não é um backend nem um importador CSV. A demonstração da aplicação é gerada em JavaScript, sem necessidade de Python no navegador.

## Persistência e evolução

Chaves locais: `saldolab:v1:demo`, `saldolab:v1:personal` e `saldolab:preferences:v1`. Os componentes não acessam `localStorage`. Os repositórios expõem operações assíncronas e validam o agregado antes da gravação. Um formato desconhecido exige recuperação explícita, sem migração destrutiva automática.

Veja [Arquitetura](docs/architecture.md) e [Contrato do repositório e migração futura](docs/persistence.md). A integração com PostgreSQL, autenticação, API REST e autorização por usuário fica para uma fase posterior, após a escolha do responsável. Filtros no frontend nunca serão usados como proteção de acesso.

## Publicação

Preparado para Vercel: preset **Vite**, instalação `npm ci`, build `npm run build` e saída `dist`. As rotas da SPA usam rewrite para `index.html`; os assets são servidos diretamente. Não há segredos a configurar.

Repositório preparado para `https://github.com/Tsilveira-dev/saldolab`, ainda **não criado**: a conexão recusou a criação. O histórico está disponível no repositório local e no Git bundle que acompanha a entrega.

Vercel **não publicada**: a plataforma recusou a criação do projeto com HTTP 403. A prévia privada acima foi disponibilizada por Sites. Veja as ações humanas exatas em [docs/deployment.md](docs/deployment.md).

## Capturas de tela

As capturas `dashboard.png` em desktop e mobile são geradas na suíte Playwright e podem ser obtidas no artefato `browser-verification` do GitHub Actions. O diretório [docs/screenshots](docs/screenshots/README.md) está reservado para as imagens selecionadas para o portfólio.

## Roadmap

- [x] CRUD e persistência local versionada.
- [x] Dashboard, filtros, relatórios, temas e backup.
- [x] Testes de domínio, repositório, integração e suíte de navegador.
- [ ] Selecionar banco e estratégia de autenticação com o responsável.
- [ ] API com autorização por usuário, migrações e auditoria.
- [ ] Importação de extratos CSV com prévia e reconciliação.
- [ ] Conciliação, regras de recorrência explícitas e testes de acessibilidade ampliados.

Licença do projeto: [MIT](LICENSE). Fontes e bibliotecas mantêm suas respectivas licenças.
