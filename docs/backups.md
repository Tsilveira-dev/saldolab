# Backup e restauração

## JSON do titular

No modo nuvem, **Configurações → Exportar backup JSON** consulta o servidor autenticado e exporta `app: SaldoLab`, `exportedAt` e `data.version: 1`, com contas, categorias, transações e orçamentos. Valores são centavos inteiros e datas são date-only. Revisões de concorrência, user IDs de autenticação, senhas, sessões e tokens ficam fora do arquivo.

O JSON contém dados financeiros em texto legível. Guardá-lo em local privado, preferencialmente criptografado, com cópia independente; não anexar a GitHub/chat. Tema, sessão de login e identidade não são backups financeiros. A importação pela interface da nuvem e a limpeza total remota permanecem desabilitadas.

## Ferramenta administrativa de ensaio

```bash
npm run backup:restore:qa -- caminho/backup.json
```

O padrão é **dry-run**, sem conexão ao banco: valida formato/vínculos/valores e informa contagens e SHA-256, sem imprimir registros. Aplicar exige `--apply` e variáveis privadas `SALDOLAB_RESTORE_DATABASE_URL`, `SALDOLAB_RESTORE_BRANCH_ID`, `SALDOLAB_RESTORE_USER_ID`.

Requisitos obrigatórios:

- Destino isolado com um único marcador `saldolab_qa.environment` correspondente à branch e `purpose = 'isolated restore rehearsal'`.
- Identidade alvo já existente no Auth do destino, explicitamente aprovada para o ensaio.
- As quatro entidades desse usuário devem estar vazias. Não há opção `--force`, substituição ou DELETE.
- Usar uma cópia de QA; a ferramenta não habilita restauração em Production/main.

Todos os INSERTs usam uma transação e as mesmas validações do backend. IDs são regenerados e os vínculos remapeados. O bloqueio das tabelas protege a checagem de destino vazio, com timeout de 5 segundos. Uma falha desfaz a operação inteira; uma segunda tentativa em destino preenchido é recusada. Verificar contagens, saldo, orçamento e conteúdo antes de considerar a recuperação concluída.

## Ensaio realizado

O JSON foi baixado pela UI de um Preview protegido ligado ao QA. A branch `qa-v1-restore-20261112` foi criada a partir de um snapshot do QA de lançamento. A fixture copiada coincidiu com a origem. O JSON foi restaurado para outra identidade fictícia vazia dessa cópia, sem alterar a fixture original.

Resultado: 2 contas, 2 categorias, 4 transações e 1 orçamento, saldo total 275000 centavos, gasto do orçamento 75000 centavos. Novos IDs não colidiram com os originais; repetir a restauração foi bloqueado. A etapa lógica demorou 973 ms neste ensaio, sem incluir provisionamento, revisão ou ativação. Isso não é SLA de RTO. Evidências no [relatório v1](lancamento-v1.md).

## Backup PostgreSQL para Production — plano

Antes da ativação, aprovar retenção/RPO/RTO e confirmar a janela real de histórico/PITR do plano Neon. Proposta para o piloto: JSON após alterações relevantes, backup PostgreSQL diário e antes de mudança, cópia criptografada fora do projeto com retenção de 30 dias, ensaio mensal; objetivos propostos RPO 24h e RTO 60min. Capacidade, agenda, armazenamento e alertas ainda precisam ser autorizados e configurados.

Usar `pg_dump`/`pg_restore` compatíveis com PostgreSQL 17 e conexão direta protegida; nunca colocar a senha na linha publicada. Conferir checksum e restauração em uma branch nova. Um clone Neon no mesmo projeto comprova recuperação por snapshot, mas não é uma cópia independente contra perda do projeto/conta. Este ensaio não comprovou PITR histórico nem restore de um dump externo.

Backups físicos/PITR podem incluir `neon_auth`, credenciais e sessões. Restaurar o banco inteiro pode reverter uma troca de senha. Não ativar a cópia sem reconciliar a identidade atual, revogar sessões restauradas e revisar origens/JWKS. A restauração lógica acima transfere somente finanças para uma identidade existente e não copia Auth. Nenhum backup ou identidade de development será migrado automaticamente.
