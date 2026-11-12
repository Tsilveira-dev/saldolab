# Publicação e estado observado

> Histórico da entrega local e do PR #1. Para a versão com nuvem no PR #3, usar [plano Production](migracao-production.md), [relatório v1.0](lancamento-v1.md) e [rollback](rollback.md). Os parágrafos históricos abaixo não significam que a versão atual dispense Auth ou variáveis privadas.

## Estado da auditoria

- Repositório existente: https://github.com/Tsilveira-dev/saldolab.
- `main` confirmada no GitHub em `99ae1684380674a15c81817642612d416da262e1` antes das correções.
- Aplicação pública acessada: https://saldolab.vercel.app.
- Os sete assets JS/CSS publicados coincidiram byte a byte com o build da baseline local. A API Vercel retornou 404 ao consultar o projeto na equipe FAIR PLAY; o commit do deployment não foi confirmado por metadados.
- Correções somente em `fix/auditoria-saldolab`. Nenhum merge ou deploy foi realizado na auditoria.
- `git.deploymentEnabled` em `vercel.json` desabilita o deploy automático dessa branch.

O diagnóstico e as limitações de acesso estão no [relatório inicial](auditoria-inicial.md); resultados e correções estão no [relatório final](auditoria-final.md).

## Configuração existente

- Framework: Vite; Node 24.x.
- Instalação: `npm ci`.
- Build: `npm run build`; saída: `dist`.
- Rewrite de SPA e headers: `vercel.json`.
- Variáveis secretas: nenhuma necessária nesta versão.
- Dados financeiros: localStorage do navegador; não são enviados à Vercel.

## Histórico

As primeiras tentativas de envio ao GitHub e de criação do projeto Vercel retornaram 403. O envio de `main` foi posteriormente concluído. A URL Vercel acima foi encontrada funcionando e validada por esta auditoria. O bloqueio inicial não descreve o estado atual do repositório ou da URL.

A prévia privada anterior em https://saldolab-financas.boundlessonyx2.chatgpt.site e seus downloads são uma entrega histórica. Não foram atualizados nesta auditoria.

## Liberação futura

O responsável deve revisar a branch e os resultados antes de autorizar merge e deploy. Quando essa liberação for autorizada, todas as abas antigas precisam ser fechadas/recarregadas antes de editar: versões anteriores não respeitam os novos bloqueios. Exportar e conferir um backup antes da atualização.

Após uma publicação aprovada, repetir os testes na URL final e em navegadores/aparelhos reais. Uma execução local aprovada não comprova que as correções já estão publicadas.
