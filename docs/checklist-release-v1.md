# SaldoLab v1.0 — checklist de liberação

Estado: **NO-GO / produção bloqueada**. Revisão em 14/11/2026. Este documento é um checklist, não uma autorização para executar alterações em Production.

## Pronto e demonstrado na branch de desenvolvimento

- [x] Fluxo pessoal sem demonstração como primeira experiência, saldo inicial vazio e edição local automática protegida por Web Locks.
- [x] Testes de navegador desktop/mobile emulado, integração da API, autenticação simulada e regressão de exportação JSON passaram na execução [#158](https://github.com/Tsilveira-dev/saldolab/actions/runs/43550701787).
- [x] Ensaio isolado de restauração financeira documentado em [backups.md](backups.md), sem alteração de dados reais.

**Atenção:** o resultado de CI #158 é específico daquele commit. Qualquer mudança posterior exige conferir os checks do HEAD atual. Testes emulados e ambiente QA não comprovam operação segura em Production.

## Impedimentos obrigatórios antes de publicar

- [ ] **Celular físico:** testar cadastro/login, abertura e fechamento do menu, formulário de conta/transação, digitação de valores, reload e fluxo de duas abas. Registrar modelo, navegador, data e resultado, sem expor dados privados.
- [ ] **Ícone móvel externo:** identificar por inspeção do site real o elemento que abre o GitHub. Verificar se pertence à aplicação, ao navegador, a uma extensão ou à Vercel Toolbar antes de remover qualquer recurso. Confirmar ausência no ambiente destinado ao público.
- [ ] **Backup independente:** definir local privado e criptografado fora do mesmo projeto/conta Neon, responsável pela operação, frequência, prazo de retenção, alertas e procedimentos de acesso. Confirmar execução automática, integridade e recuperação de uma cópia em ambiente isolado. Ver [backups.md](backups.md).
- [ ] **Neon Production:** habilitar Auth somente no destino correto, configurar políticas e e-mail de verificação, aplicar migrações com conferência de checksum e definir role de runtime de privilégios mínimos. Não reutilizar banco, contas ou URL de QA. Ver [migracao-production.md](migracao-production.md).
- [ ] **Vercel Production:** conferir projeto, domínio, quatro variáveis corretas do destino, proteção de Preview e build dedicado para Production. Não promover artefatos preparados com Auth de QA.
- [ ] **Sessões e dados:** comprovar logout, revogação das sessões anteriores, isolamento entre usuários A/B, rejeição de token inválido e ausência de exposição de dados locais para outra identidade.
- [ ] **Recuperação:** demonstrar backup externo restaurável, controle de gravações em incidente, procedimento de rollback seguro e meios de recuperação do acesso. Ver [rollback.md](rollback.md).
- [ ] **Aceite final:** congelar SHA, conferir três jobs verdes nesse SHA, revisar PR #3 e PR #4, executar testes de fumaça do ambiente publicado com dados fictícios e registrar autorização explícita de liberação.

## Critério de decisão

**GO** somente com todos os requisitos críticos comprovados e documentados. Até lá, manter os PRs em rascunho, a produção atual intacta e o uso com dados financeiros reais bloqueado.

Não enviar senhas, tokens, cópias de dados financeiros ou connection strings ao GitHub, a imagens de teste ou a conversas públicas.
