# SaldoLab v1.0 — lançar e manter sem Codex

Este guia destina-se ao titular para **uso pessoal controlado**, não à abertura de um serviço público. O repositório, o banco, a Vercel e as caixas de e-mail continuam administráveis pelas respectivas interfaces e pelo VS Code, sem uma assinatura do Codex. O estado e a decisão atual estão em [lancamento-v1.md](lancamento-v1.md); a descrição do [PR #3](https://github.com/Tsilveira-dev/saldolab/pull/3) identifica o SHA, o Preview e o CI finais.

**Esta entrega não fez merge nem configurou Production.** Os passos de preparação local são executáveis agora. Os passos de escrita em Production/main abaixo são um plano para você executar somente depois de decidir e registrar a autorização de lançamento. Não copie dados, usuários, senhas ou sessões de QA/development para Production.

## 1. Guardar o acesso independente

- Confirmar acesso com sua conta ao [GitHub](https://github.com/Tsilveira-dev/saldolab), [projeto Vercel](https://vercel.com/fair-play7/saldolab) e [Console Neon](https://console.neon.tech). Projeto Neon: `soft-term-72911921`. Manter MFA e meios de recuperação dessas contas; não depender do login do ChatGPT.
- Guardar em gerenciador de senhas os acessos de administração, SMTP e banco. Manter uma cópia privada de recuperação fora do computador e do projeto. Não publicar segredos em issue, PR, screenshot, terminal compartilhado ou arquivos versionados.
- Instalar VS Code, Git, Node 24 LTS e npm. Python 3.10+, Docker e OpenSSL 1.1+ são necessários para as verificações indicadas; `openssl version` deve funcionar para o emissor HTTPS temporário dos testes PostgreSQL. Os comandos de ambiente mostrados neste guia usam Bash; no Windows, usar Git Bash/WSL com esses requisitos disponíveis.

## 2. Conferir o código e os checks, sem alterar main

No terminal do VS Code:

```bash
git clone https://github.com/Tsilveira-dev/saldolab.git
cd saldolab
git switch feat/neon-backend-foundation
git pull --ff-only origin feat/neon-backend-foundation
git status --short --branch
git rev-parse HEAD
npm ci
npm run check
npx playwright install chromium
npm run test:e2e
python3 -m unittest discover -s scripts -p 'test_*.py'
npm audit
```

Se a pasta já existir, abri-la em vez de clonar por cima. Se houver alterações locais, preservá-las e revisar antes de atualizar. Não usar `reset --hard`, force push ou `npm audit fix --force` para fazer verificações passarem.

Para PostgreSQL real, iniciar **somente um banco descartável local** em um terminal, conferindo antes se a porta 55433 está livre:

```bash
docker run --rm --name saldolab-v1-check \
  --publish 127.0.0.1:55433:5432 \
  --env POSTGRES_DB=saldolab_integration \
  --env POSTGRES_HOST_AUTH_METHOD=trust postgres:17-alpine
```

Em outro terminal, na pasta do projeto:

```bash
SALDOLAB_TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:55433/saldolab_integration npm run test:integration
```

Ao terminar, `docker stop saldolab-v1-check` remove apenas esse banco fictício, pois foi criado com `--rm`. Nunca use uma conexão de development/Production nessa suíte. O teste de role mínima usa a administração **do banco descartável**, não credenciais Neon.

No GitHub, abrir PR #3 → **Checks** e conferir `check`, `api-integration` e `cloud-auth-smoke` no **mesmo SHA** exibido no terminal. Os três devem estar concluídos com sucesso; um run antigo não aprova o novo commit. Com GitHub CLI autenticada, a consulta equivalente é:

```bash
gh pr checks 3 --repo Tsilveira-dev/saldolab
gh pr view 3 --repo Tsilveira-dev/saldolab --json headRefOid,isDraft,mergeStateStatus
```

`npm run dev` serve os modos locais. A API `/api/finance` exige Vercel Functions; não é servida por Vite sozinho. Para desenvolvimento completo, seguir [instalação](instalacao.md).

## 3. Concluir o aceite no Preview QA correto

1. Abrir a **URL exata do QA final na descrição do PR**, fazer o SSO da Vercel se solicitado e acessar **Minha nuvem**. O SSO da Vercel e o login do SaldoLab são acessos diferentes.
2. Confirmar que a publicação pertence ao SHA aprovado e ao QA `br-gentle-water-bc8ceb2q`. O alias automático da branch pode usar development: não o substituir pela URL QA sem conferir o ambiente. Não executar testes automáticos de escrita no alias de development.
3. Usar o e-mail de teste sob seu controle. Se ainda não estiver verificado, escolher **Verificar meu e-mail**, solicitar o código, ler na sua inbox e clicar em **Confirmar e-mail**. Esperar **E-mail confirmado. Entre com sua senha.** Não enviar o código a terceiros. Depois entrar com a senha do **mesmo QA**.
4. Login/cadastro selecionam o modo nuvem. Conferir o selo **Neon PostgreSQL**; no celular, o cabeçalho reduzido pode ocultar esse selo: conferir **Modo nuvem** no seletor e o aviso de edição no banco de dados. Se já estava autenticado e escolheu outro modo, usar **Abrir finanças na nuvem**. O selo **Armazenamento local** identifica um espaço independente do e-mail, restrito ao navegador/origem; não comprova gravação no banco. Sair da conta agora mantém a nuvem sem sessão, sem retornar automaticamente aos dados locais.
5. Em **Transações → Nova transação**, preencher descrição fictícia, R$ 10,00 e a data do mês atual. Se não houver contas, usar **Nome da nova conta**, saldo inicial R$ 1.000,00 e **Criar conta e selecionar**. Se não houver categoria do tipo escolhido, preencher **Nome da nova categoria → Criar categoria de despesa**. Conferir a seleção automática e a preservação de descrição/valor; concluir o registro.
6. No Dashboard, conferir saldo R$ 990,00. Editar a despesa para R$ 20,00: saldo R$ 980,00. Atualizar a página e sair/entrar novamente: a despesa e o saldo devem permanecer. Excluir **somente a transação fictícia recém-criada**: saldo volta a R$ 1.000,00. Para receita, usar uma categoria de receita; transferências exigem duas contas e não usam categoria.
7. Exportar **Configurações → Exportar backup JSON**. Conferir o arquivo e guardar privadamente. Testar também no celular, incluindo abrir e concluir o formulário. Não clicar em limpeza/restauração local esperando que isso administre o banco remoto.
8. Em outro perfil de navegador, testar **Esqueci minha senha**, ler o e-mail e escolher uma senha exclusiva de teste. Entrar novamente. O reset deve encerrar as sessões anteriores; a aplicação não deve aceitar novas operações dessas sessões.
9. Registrar no PR data, URL/SHA, navegador/celular e PASS/FAIL de cada passo, sem dados pessoais, senhas, códigos ou links recebidos. O aceite do titular é independente das fixtures automatizadas.

O recebimento e a confirmação OTP real são feitos por você. Testes automatizados que preparam e-mails fictícios como verificados por SQL **não substituem esse passo**. Se o e-mail não chegar, conferir spam, ambiente, configuração SMTP e rate limit. Não desabilitar a verificação para contornar a falha.

Para conferir troca de identidade, sair da conta A e cadastrar/entrar em B na mesma aba: B não deve mostrar registros de A ou do modo local. Ao voltar a A, seus dados devem continuar preservados. Não usar limpeza de armazenamento nem exclusão de registros como solução de troca de login. O mesmo conteúdo local continua disponível apenas quando você escolher explicitamente o modo pessoal; ele não é dividido por e-mail.

## 4. Entender o encerramento das sessões

A API desta revisão exige **JWT assinado + identificador opaco de sessão ativa do mesmo usuário**. A sessão é conferida no banco em cada operação, sem cache positivo. Tratar ambos como credenciais: não registrar o header `X-SaldoLab-Session-Id` nem `Authorization`.

- **Sair da conta** encerra a sessão atual; outros dispositivos continuam conectados.
- **Sair de todos os dispositivos** encerra todas as sessões. Reset de senha deve ter `revoke_sessions_on_password_reset=true` no ambiente.
- Mudança de senha com `revokeOtherSessions=true` encerra os outros dispositivos e, no QA ensaiado, rotaciona a sessão atual. O dispositivo recebe uma nova sessão, mas seus JWT/sessão anteriores também são recusados. Se a interface ainda estiver com dados em cache, atualizar a página ou entrar novamente.
- O JWT do Neon permanece criptograficamente válido por 900s (+ tolerância de 10s), mas sozinho não autoriza a API nova. O SDK pode produzir JWTs idênticos em sessões emitidas no mesmo segundo; não usar o JWT como identificador único de sessão.
- A recusa vale para **novas requisições após a revogação persistir**. Não cancela transações já autorizadas em andamento, apaga downloads nem revoga o JWT em outros serviços/deployments antigos que só verifiquem assinatura.

Production precisa ter exclusivamente o código novo e credenciais próprias. Não promover builds antigos para contornar falhas; eles podem reintroduzir autorização apenas por JWT. Detalhes e evidências em [recuperação](recuperacao.md).

## 5. Preparar Production — depois da sua autorização

Abrir [migracao-production.md](migracao-production.md) e executar sua sequência integral; não fazer merge como primeiro passo. Alvos futuros: Neon `main` = `br-patient-forest-bcfzjc39`, banco `saldolab`; Vercel `fair-play7/saldolab`. **Parar se IDs, schema ou dados divergirem.** Não usar uma cópia de QA/development como produção.

### Neon e migrações

1. Na Console Neon, selecionar a branch main correta. Confirmar a situação inicial, o plano, a janela de recuperação disponível e quem administrará backups. Não alterar faturamento como etapa automática.
2. Habilitar Neon Auth **dessa main** após autorização. Guardar suas URLs Base/JWKS. Configurar domínio/origens exatos de Production, localhost desabilitado, verificação obrigatória por OTP e sem login automático após verificar. Configurar reset para revogar sessões.
3. Configurar SMTP próprio: host, porta, TLS, usuário e senha do provedor, remetente/domínio validado, SPF/DKIM/DMARC conforme o provedor. Não colar esses valores no PR. Compartilhado Neon em QA não constitui configuração Production. Não comprar domínio/serviço nem mudar o plano sem decisão própria.
4. Revisar os checksums dos arquivos na versão aprovada:

   ```bash
   sha256sum db/migrations/0001_initial_finance_schema.sql db/migrations/0002_active_session_authorization.sql db/operations/runtime-grants.sql
   ```

   Os valores de referência estão no plano de migração. Alteração inesperada exige nova revisão.

5. Pela SQL Editor autenticada do Neon **no destino autorizado**, ou `psql` com conexão administrativa **direta** protegida, aplicar os arquivos `0001` e `0002` em ordem, dentro de `BEGIN`/`COMMIT`, interrompendo e fazendo `ROLLBACK` em qualquer erro. `0002` depende de `neon_auth.session` no mesmo banco; não copiar esse schema do QA. Não executar a migração pela aplicação ou pelo job de Preview.
6. Criar `saldolab_runtime` sem superuser, createdb, createrole, replication, bypassrls nem memberships administrativas. Exemplo de criação **futura**, pela administração autorizada:

   ```sql
   CREATE ROLE saldolab_runtime LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE
     NOREPLICATION NOBYPASSRLS NOINHERIT;
   ```

   Definir a senha por canal seguro; em `psql`, `\password saldolab_runtime` solicita sem colocá-la no comando. `NOINHERIT` sozinho não impede `SET ROLE`: conferir memberships. Não assumir que toda role criada pela UI Neon já é restrita. Se o provedor não permitir a criação/configuração esperada, parar e resolver com seu suporte, sem usar owner no aplicativo.

7. Aplicar [runtime-grants.sql](../db/operations/runtime-grants.sql). A role recebe CRUD em quatro tabelas e EXECUTE na função booleana de sessão, sem SELECT direto em Auth. A função usa SQL fixo, `SECURITY DEFINER`, `search_path=pg_catalog` e sem EXECUTE para PUBLIC. A role de runtime não pode ser dona dessa função ou criar objetos. Conferir os privilégios com [verify-runtime.sql](../db/operations/verify-runtime.sql) conectado **como runtime**.

### Vercel e primeira publicação

1. Em projeto **saldolab → Settings → Environment Variables**, selecionar **Production**, não Preview/Development. Configurar somente os valores de Production:

   | Nome                 | Valor a obter                                                        |
   | -------------------- | -------------------------------------------------------------------- |
   | `DATABASE_URL`       | Pooler da main, banco saldolab, role restrita, `sslmode=verify-full` |
   | `NEON_AUTH_BASE_URL` | Base URL pública do Auth da main                                     |
   | `NEON_AUTH_JWKS_URL` | A mesma Base URL + `/.well-known/jwks.json`                          |
   | `VITE_NEON_AUTH_URL` | A mesma Base URL; único valor público compilado no frontend          |

2. Não colocar owner, senha, SMTP ou OIDC em variáveis `VITE_`. Não copiar `.env` de QA. Preservar o SSO e não ampliar Trusted Sources para liberar Production como atalho.
3. Antes do merge, conferir backups, SMTP, role, migrações, origem Auth, ausência de dados de teste e todos os gates. Registrar sua decisão GO no PR; só então tirar de Draft, revisar a alteração e autorizar o merge pela interface do GitHub.
4. O merge em main pode disparar a Vercel automaticamente. Acompanhar **Deployments**, conferir commit e alvo Production, build aprovado e configuração nova. Fazer **build próprio de Production**: não usar Promote no Preview QA, cuja URL Auth foi compilada para QA.
5. Executar o smoke manual do item 3 com registros novos fictícios e repetir verificação/reset/inbox no remetente de Production. Conferir também a recusa das sessões antigas, erros de API, logs e celular. `/api/health` 200 sozinho não prova banco nem autorização.
6. Só começar finanças pessoais reais após o smoke e a decisão GO. Após o cadastro do titular, fechar inscrições (`disable_sign_up=true`) se essa for a política do piloto. Não abrir cadastro público nesta v1 pessoal.

## 6. Rotina sem assistência

| Frequência                                       | Ação e evidência                                                                                                                                                    |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Após alterações importantes e antes de atualizar | Exportar JSON do modo nuvem, guardar criptografado fora do projeto e conferir data/tamanho                                                                          |
| A cada uso                                       | Confirmar selo Neon PostgreSQL, mês correto e saldo; em 409, atualizar dados e revisar a diferença antes de tentar novamente                                        |
| Semanal                                          | Vercel Runtime Logs do deployment ativo: investigar 5xx, falhas de banco e sessão; conferir uso/limites e e-mails do Neon/Vercel, sem mudar billing automaticamente |
| Antes de cada mudança de código                  | Branch própria, revisão do diff, `npm ci`, checks, banco isolado e Preview QA; nunca usar dados reais nos testes                                                    |
| Conforme política aprovada                       | Backup externo PostgreSQL e retenção; conferir sucesso, checksum e acesso à cópia independente                                                                      |
| Mensal e antes de mudanças de recuperação        | Ensaio de restauração em branch isolada; medir perda/janela real e documentar resultado                                                                             |

Proposta inicial: backup diário, 30 dias de retenção, RPO 24h e RTO 60min. São **objetivos a contratar/configurar/medir**, não garantias implementadas. A branch de recuperação no mesmo projeto não protege contra perda da conta/projeto. Não afirmar PITR histórico ou backup externo como PASS antes de ensaiar.

Monitoramento: Vercel → deployment ativo → Runtime Logs, filtrar `api/finance`, status e intervalo; Neon → branch correta → Monitoring/compute/conexões e janela de restore. Ativar alertas disponíveis sem custos adicionais aprovados; se não houver alertas automáticos no plano, registrar a revisão manual e quem a fará. Sanitizar logs antes de compartilhar. Erro 401 do SaldoLab exige novo login; 401/403 de SSO é proteção Vercel; 409 é conflito que exige revisão; 5xx requer investigar, não repetir gravações às cegas.

## 7. Recuperar dados ou acesso

- **Senha:** usar a recuperação pela inbox. Conta Vercel/GitHub/Neon é independente da senha SaldoLab. Em suspeita de vazamento, reset e logout global; verificar sessões e também deployments antigos.
- **Backup JSON:** `npm run backup:restore:qa -- caminho/backup.json` faz somente dry-run, sem banco. O arquivo deve ser privado. Aplicação exige ambiente isolado explicitamente marcado, identidade alvo vazia e variáveis privadas; seguir [backups.md](backups.md). A ferramenta bloqueia a main/development conhecidos e não tem sobrescrita. Não remover seus guardas para restaurar em Production.
- **Falha de atualização:** seguir [rollback.md](rollback.md); escolher somente uma versão cloud com a checagem ativa de sessão, ou conter e corrigir à frente. Não fazer downgrade para a antiga API que aceita apenas JWT.
- **Perda/corrupção:** preservar a origem e conter escritas mediante autorização; criar uma branch de recuperação do backup/ponto aprovado, conferir valores e operações posteriores, reconciliar Auth e revogar sessões restauradas. Não restaurar por cima nem descartar dados posteriores sem sua decisão. Troca de banco/Auth em Production exige novo plano aprovado e, se a URL Auth mudar, novo build.

Uma emergência pode exigir um administrador PostgreSQL ou suporte Neon/Vercel, mas não requer o Codex. Fornecer IDs, horários, SHA e mensagens sanitizadas; nunca senhas ou backups completos. O [plano de rollback](rollback.md) e os backups privados devem estar acessíveis antes do incidente.

## 8. Checklist para decidir publicar

- [ ] Mesmo SHA revisado, três jobs de CI aprovados e Preview QA comprovadamente isolado.
- [ ] Aceite do titular no QA final: OTP/inbox, login/reset, cadastro rápido, CRUD, reload, novo login, exportação e celular.
- [ ] Autorização registrada para Neon main, SMTP/role/variáveis Production, merge e primeira publicação.
- [ ] Migrações `0001` e `0002` conferidas/aplicadas somente na mudança autorizada; runtime com privilégios mínimos e função de sessão conferida.
- [ ] Auth e SMTP de Production exclusivos; origens corretas, localhost desabilitado, reset revoga sessões, inscrição pessoal restrita.
- [ ] Backups independentes, retenção, alertas e responsável definidos, restauração ensaiada e acesso de recuperação disponível.
- [ ] Novo build Production com URLs próprias; nenhum dado/identidade de QA/development copiado.
- [ ] Smoke do deployment Production aprovado antes dos dados reais; rollback preserva a proteção nova de sessão.

Qualquer item aplicável pendente mantém **NO-GO para uso financeiro real**. O responsável pode revisar o código enquanto conclui essas etapas; passar nos testes de QA não executa nem autoriza a implantação.
