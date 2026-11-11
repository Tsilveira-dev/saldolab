# Verificação da entrega

Verificações executadas em 11 de novembro de 2026:

| Verificação              | Resultado                                                       |
| ------------------------ | --------------------------------------------------------------- |
| `npm run lint`           | Passou, sem avisos                                              |
| `npm run format:check`   | Passou                                                          |
| `npm run test`           | 65 testes passaram em 3 arquivos                                |
| `npm run build`          | Passou; build estático gerado em `dist/`                        |
| `npm run check`          | Passou (lint, formatação, testes e build)                       |
| Python `unittest`        | 2 testes passaram                                               |
| Gerador Python           | CSV de 54 transações gerado com seed 42, seis meses até 2026-11 |
| Navegador desktop/mobile | Pendente de execução; suíte configurada                         |
| CRUD em versão publicada | Pendente; publicação bloqueada por permissões externas          |

O Rollup removeu duas anotações de comentários de uma dependência Zod. O build terminou com sucesso. Os chunks JavaScript ficaram abaixo do aviso de 500 kB. Não há dependência de banco remoto.

## Escopo dos testes

- Vitest: valores monetários, saldos, transferências, pendências, filtros, orçamentos, base zero, datas e recorrências.
- Repositório: CRUD das quatro entidades, persistência, vínculos, compatibilidade, backup, separação de modos, corrupção e cota indisponível.
- React Testing Library: formulários reais, criação, edição, exclusão com confirmação, indicadores, filtros e alternância de modos.
- Playwright: rotas diretas, CRUD persistente, proteção de conta, backup, tema, viewport móvel e renderização dos gráficos.
- Python unittest: semente reproduzível, valores positivos, unicidade e mudança de ano.

## Limitação do ambiente de desenvolvimento

A ferramenta `cua_repl.js` não foi oferecida nesta sessão gerenciada. A orientação de [Sites SKILL.md](skill://plugin_connector_1p_689987207de08191979cf68eca2941c6/sites/SKILL.md) determina: “If `cua_repl.js` is unavailable, skip browser QA”. Não foi iniciado um servidor de preview alternativo. A alternativa preparada é o workflow GitHub Actions, com artefatos de execução, mas a conexão atual também não permite criar o repositório. A suíte Playwright deve ser considerada pendente até sua execução local ou em CI.

As validações de layout móvel e renderização real dos gráficos não foram declaradas aprovadas apenas com base nos testes jsdom.
