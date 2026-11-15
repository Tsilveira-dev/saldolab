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

Na rodada final, o JSON exportado pelo Preview de código `ca9e3cc` foi restaurado novamente nessa branch isolada, para **outra identidade fictícia nova e vazia**. Contagens e valores coincidiram; os hashes dos registros financeiros anteriores não mudaram, e a repetição continuou bloqueada. Fase lógica: 982ms, novamente sem significado de SLA. Os seis testes de restauração do PostgreSQL 17 também passaram na suíte final. Nenhum destino Production ou usuário existente foi sobrescrito. Instruções de operação independente no [guia sem Codex](guia-lancamento-sem-codex.md).

## Backup PostgreSQL para Production — plano

Antes da ativação, aprovar retenção/RPO/RTO e confirmar a janela real de histórico/PITR do plano Neon. Proposta para o piloto: JSON após alterações relevantes, backup PostgreSQL diário e antes de mudança, cópia criptografada fora do projeto com retenção de 30 dias, ensaio mensal; objetivos propostos RPO 24h e RTO 60min. Capacidade, agenda, armazenamento e alertas ainda precisam ser autorizados e configurados.

Usar `pg_dump`/`pg_restore` compatíveis com PostgreSQL 17 e conexão direta protegida; nunca colocar a senha na linha publicada. Conferir checksum e restauração em uma branch nova. Um clone Neon no mesmo projeto comprova recuperação por snapshot, mas não é uma cópia independente contra perda do projeto/conta. Este ensaio não comprovou PITR histórico nem restore de um dump externo.

Backups físicos/PITR podem incluir `neon_auth`, credenciais e sessões. Restaurar o banco inteiro pode reverter uma troca de senha. Não ativar a cópia sem reconciliar a identidade atual, revogar sessões restauradas e revisar origens/JWKS. A restauração lógica acima transfere somente finanças para uma identidade existente e não copia Auth. Nenhum backup ou identidade de development será migrado automaticamente.

## Ferramenta local de backup PostgreSQL cifrado — preparada, não agendada

A ferramenta `npm run backup:postgres` cria um arquivo PostgreSQL custom format protegido com **AES-256-GCM**, salt aleatório e derivação da chave com scrypt. Os bytes de `pg_dump` são criptografados durante a leitura, sem gerar dump em texto claro no disco. A ferramenta não substitui nem sobrescreve arquivos existentes; verifica o arquivo resultante por descriptografia e `pg_restore --list`, sem restaurar dados.

**Requisitos no computador administrativo:** Node.js, `pg_dump` e `pg_restore` compatíveis com a versão do servidor, conexão **direta** (não pooler) com TLS, diretório de saída fora do repositório, senha de criptografia de pelo menos 20 caracteres e espaço suficiente. A senha e a URL do banco devem ser configuradas no ambiente seguro da máquina, nunca copiadas para scripts, Git, conversas, logs ou argumentos da linha de comando.

Variáveis obrigatórias:

- `SALDOLAB_BACKUP_DATABASE_URL`: URL PostgreSQL direta da branch autorizada, com usuário que possa ler todos os schemas necessários.
- `SALDOLAB_BACKUP_PASSPHRASE`: segredo de criptografia guardado em local distinto do próprio backup. **Perder essa senha impede a recuperação.**

Após preparar as variáveis pelo gerenciador de segredos local, os comandos são:

```bash
npm run backup:postgres -- create /caminho/privado/fora-do-projeto/saldolab-AAAA-MM-DD.saldolab.enc
npm run backup:postgres -- verify /caminho/privado/fora-do-projeto/saldolab-AAAA-MM-DD.saldolab.enc
```

A etapa `verify` somente autentica o arquivo criptografado e pede ao PostgreSQL que liste sua estrutura; **não comprova restauração funcional**. O formato inclui os schemas do banco, potencialmente incluindo contas e sessões do Auth; não publicar nem compartilhar o arquivo. A ferramenta não implementa envio externo, armazenamento remoto, execução diária, retenção, alertas nem recuperação automática.

**Antes de considerar a produção protegida:** autorizar e configurar uma cópia criptografada em armazenamento externo independente, com agendamento, retenção, testes de restauração em um banco isolado, proteção de acesso e monitoramento. Não executar restauração do banco completo em `main`, nem considerar os seis horários de recuperação do Neon como cópia independente.

## Destino Google Drive — conta validada com teste de leitura e gravação

**A conta Google efetivamente autorizada no rclone usa a pasta `SaldoLab-Backups` na raiz do Drive pessoal.** Em 15/11/2026, o titular executou `rclone copyto` para enviar `teste-conexao.txt`, confirmou o arquivo na interface do Drive da mesma conta e recuperou o conteúdo correto com `rclone cat`. Esses testes comprovam conectividade e leitura/escrita de **arquivo fictício**, não backup de PostgreSQL nem restauração.

A pasta original **`SaldoLab — backups criptografados`** foi criada em uma **outra conta Google**, portanto seu ID `1waXRcUZg4hl5ESv1vWI_mrSMTm3gozuT` resultou em 404 ao tentar enviar por essa conexão. **NÃO reutilizar esse ID**. O script de upload usa agora `saldolab-drive:SaldoLab-Backups/<nome do backup>` e valida a presença da pasta no Drive autenticado antes de gravar. Sem backup válido, não criar pastas alternativas automaticamente.

### Configuração necessária no computador ou servidor administrativo

1. Instalar Node.js, PostgreSQL Client Utilities compatíveis com servidor (`pg_dump`, `pg_restore`) e `rclone`. No Windows, o rclone pode ser instalado em diretório privado fora do repositório. Se não estiver no PATH, definir `SALDOLAB_RCLONE_BIN` como caminho absoluto de `rclone.exe`.
2. Configurar o remote `saldolab-drive` via OAuth no `rclone config`, usando **somente a conta destinatária validada**. Evitar capturas do resumo da configuração: ele mostra `client_secret`, `access_token` e `refresh_token`.
3. **Segurança pendente:** credenciais e tokens foram expostos em capturas no teste inicial. Revogar os tokens OAuth expostos na conta Google, remover cada segredo exposto do cliente OAuth, criar segredo novo e atualizar a autorização do rclone; comprovar novo acesso sem imprimir credenciais. Não enviar dados financeiros reais antes da rotação completa.
4. Configurar via armazenamento seguro `SALDOLAB_BACKUP_DATABASE_URL` (conexão direta e somente-leitura apropriada), `SALDOLAB_BACKUP_PASSPHRASE` (senha de cifragem longa, separada do Drive), `SALDOLAB_BACKUP_LOCAL_DIR` (diretório privado fora do repositório), e opcionalmente `SALDOLAB_DRIVE_REMOTE` e `SALDOLAB_RCLONE_BIN`. Nunca inserir valores reais em logs/chat/repositório.
5. No computador autorizado, executar `npm run backup:drive` após preparar os pré-requisitos e testar o backup local. O script faz dump criptografado, verifica o formato, envia para pasta existente e compara checksum do arquivo criptografado local e remoto.

### Bloqueios antes de produção

- Ferramenta ainda **não agendada**; não há alertas de falha nem retenção automatizada. Definir equipamento/servidor sempre disponível, responsável, frequência, retenção e alerta.
- O teste de texto simples prova acesso, não prova que a criptografia AES-GCM de arquivo de banco, o upload em tamanho real e a restauração funcionem. Baixar uma cópia criptografada do Drive e **ensaiar restauração em PostgreSQL isolado** sem tocar em `main`.
- Verificar no Google Cloud a situação do OAuth **Testing**: tokens de atualização podem expirar em sete dias, interrompendo backup automatizado; a conta autorizada precisa de política de refresh operacional antes da produção.
- Armazenar segredos e `rclone.conf` em local protegido, definir controles de acesso e não publicar/compartilhar os arquivos. O escopo atual `drive` tem acesso amplo à conta; considerar conta exclusiva e princípio do menor privilégio.
- **Nenhum backup financeiro real foi enviado, nenhum job automático está ativo e nenhuma migração ou deploy Production foi feito.**
