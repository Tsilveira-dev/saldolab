# Verificação da entrega

Este arquivo será atualizado com os resultados efetivamente executados antes da entrega. A existência de uma suíte não significa que ela passou.

## Escopo dos testes

- Vitest: valores monetários, saldos, transferências, pendências, filtros, orçamentos, base zero, datas e recorrências.
- Repositório: CRUD das quatro entidades, persistência, vínculos, compatibilidade, backup, separação de modos, corrupção e cota indisponível.
- React Testing Library: formulários reais, criação, edição, exclusão com confirmação, indicadores, filtros e alternância de modos.
- Playwright: rotas diretas, CRUD persistente, proteção de conta, backup, tema, viewport móvel e renderização dos gráficos.
- Python unittest: semente reproduzível, valores positivos, unicidade e mudança de ano.

## Limitação do ambiente de desenvolvimento

A ferramenta `cua_repl.js` não foi oferecida nesta sessão gerenciada. As orientações de preview do ambiente não permitem improvisar controle de navegador nesse caso. A verificação de navegador será tentada no workflow GitHub Actions, com artefatos de execução. Até haver um resultado executado, a suíte Playwright deve ser considerada pendente.
