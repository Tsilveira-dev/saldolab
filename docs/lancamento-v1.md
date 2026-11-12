# SaldoLab v1.0 — prontidão para lançamento

Data: 12/11/2026, America/Sao_Paulo. Repositório `Tsilveira-dev/saldolab`, exclusivamente `feat/neon-backend-foundation`, PR #3 em draft. Critérios originados na [checklist da conversa do PR](https://github.com/Tsilveira-dev/saldolab/pull/3#issuecomment-6833605286).

**Recomendação: NO-GO para ativar a nuvem em Production ou inserir finanças reais.** Os avanços abaixo foram demonstrados em Preview protegido e QA isolado. Production continua sem configuração de nuvem e depende de autorização própria. O plano está preparado para revisão, sem merge ou migração da Neon main.

## Critérios de aceite

| Gate                             | Resultado                                                 | Evidência e pendência                                                                                                                                                                                                                            |
| -------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| G1 — Preview publicado protegido | **PASS no QA ensaiado**                                   | OIDC local autenticou saúde 200, página 200 e API sem JWT 401; cinco cenários publicados com API/Auth/Neon reais, incluindo o bloqueio de categorias relatado pelo titular. Head e Preview finais são registrados na descrição do PR após o CI   |
| G2 — entrega e titularidade      | **PASS entrega / BLOCKED conclusão do titular**           | Usuário confirmou recebimento na caixa de entrada. Relatou verificação/reset/login, mas a consulta do novo QA ainda encontrou `emailVerified=false`; confirmação adicional solicitada. Não considerar esse relato isolado como conclusão técnica |
| G2 — política Production         | **PASS plano / BLOCKED ativação**                         | Verificação obrigatória, OTP, sem login automático após confirmar; piloto fechado e SMTP próprio planejados. SMTP compartilhado de QA não configura Production                                                                                   |
| G3 — revogação                   | **PASS mecanismos suportados / BLOCKED decisão residual** | Logout global: zero sessões e segundo dispositivo sem sessão. Troca de senha revoga outros; reset revoga todas. JWT anterior ainda retorna 200 até expirar; janela 900s + 10s requer aceite explícito ou mecanismo adicional                     |
| G4 — infraestrutura Production   | **PASS plano / BLOCKED execução**                         | Neon main continua sem tabelas financeiras/Auth; Vercel tem zero variáveis Production. Role mínima, sequência, validações e pontos de parada preparados, sem execução                                                                            |
| G5 — backup/recuperação          | **PASS ensaio / BLOCKED operação Production**             | Exportação pela UI publicada, snapshot em nova branch e restauração JSON real sem sobrescrever dados. Backup externo/PITR histórico/agendamento/retensão operacionais ainda precisam ser configurados e aceitos                                  |
| G6 — rollback e PR #2            | **PASS preparação**                                       | Roteiro separa aplicação, banco e Auth. Quatro arquivos do PR #2 revisados e portados em commit próprio; PR #2 não foi merged nem alterado                                                                                                       |
| G7 — instalação/privacidade      | **PASS documentação / BLOCKED abertura pública**          | README e instalação corrigidos; recuperação, privacidade e limites escritos. Contato, retenção, operação e eventual adequação comercial do plano precisam de decisão do responsável                                                              |
| G8 — aceite do titular           | **BLOCKED após correção do bloqueio relatado**            | Titular relatou que contas funcionavam, mas transações não tinham categorias. Correção passou em desktop/mobile, inclusive no Preview. A confirmação do titular após a correção e do modo nuvem ainda está pendente                              |

Não há falha de persistência conhecida nos cenários concluídos. Os estados BLOCKED não são convertidos em PASS por testes com mocks ou por funcionamento da versão local.

## Preview e preservação

- Preview inicial de lançamento: `https://saldolab-q1v154x7r-fair-play7.vercel.app`, código `1828db8`.
- Preview com correção de categorias: `https://saldolab-1iwv53x4y-fair-play7.vercel.app`, código `438e7a5`. Ambos são Previews protegidos, ligados ao **novo QA**, não a development.
- Neon de lançamento: `qa-v1-release-20261112`, `br-gentle-water-bc8ceb2q`, criado da main vazia. Auth e fixtures são próprios desse ambiente.
- Recuperação: `qa-v1-restore-20261112`, `br-cold-base-bc3peopn`, snapshot do QA de lançamento. Nenhuma troca de conexão de origem.
- Production permaneceu no deployment `dpl_2AW7mCUorWQF4oQBUidAThX8FHW5`; variáveis Production e configuração SSO permaneceram iguais.
- A CLI autenticada confirmou o projeto/equipe corretos. O acesso utilizou OIDC restrito à origem do Preview, com TLS validada. A credencial temporária criada pela tentativa de `vercel curl` foi revogada; nenhum SSO foi desativado.
- Consultas somente leitura reconfirmaram development com 1 usuário, 1 conta e saldo inicial agregado de 100000 centavos, sem categorias/transações/orçamentos. Neon main tinha zero tabelas em `public`/`neon_auth`.

Dados locais pertencem à origem do navegador. Uma nova URL de Preview não transporta o localStorage da anterior. Para verificar a nuvem, entrar em **Minha nuvem → Abrir finanças na nuvem** e conferir o selo **Neon PostgreSQL**. Nenhum backup local é enviado automaticamente.

## Correções desta preparação

1. Confirmação de e-mail por OTP na interface, com erros neutros, senha/código fora de logs e cooldown de reenvio. O novo QA exige titularidade antes de emitir sessão. Login sem verificação foi recusado com 403 `EMAIL_NOT_VERIFIED`, sem JWT.
2. Logout global implementado com `revokeSessions`; reset no QA usa `revoke_sessions_on_password_reset=true`. Mudança de senha, reset e segunda sessão foram exercitados no serviço publicado.
3. Exportação v1 reutiliza validação comum; ferramenta de restauração tem dry-run padrão, marcador QA, destino vazio, verificação de identidade, IDs remapeados e uma transação. Main/development conhecidos são recusados explicitamente. Não há DELETE ou opção de sobrescrita.
4. Correções do PR #2 avaliadas antes do porte: proteção CSV contra prefixos invisíveis e contraste. Candidato passou em nove entradas hostis; contraste de texto secundário medido em 6,09:1 claro e 8,80:1 escuro. Porte rastreável em `dffa6c5`, origem `b637c8586b5dc1022488bb742ce76f444efb17f4`.
5. **Bloqueio relatado em transações:** quando não havia categoria do tipo selecionado, o formulário exigia seleção sem oferecer saída direta. Agora permite criar a categoria no próprio lançamento, seleciona-a e mantém descrição/valor. O salvamento aguarda uma categoria válida; receitas/despesas continuam com vínculos obrigatórios. Transferências continuam sem categoria. Os atalhos das seções Receitas/Despesas preselecionam o tipo correto.
6. Publicação exclui artefatos privados/testes via `.vercelignore`, preservando exclusões anteriores. O modelo de conexão passou a `sslmode=verify-full`; o QA corrigido usa essa opção para explicitar validação TLS e evitar o aviso de futura mudança de semântica de `require` no driver.

## Testes novos e limites de evidência

| Verificação                                     | Resultado                                                                                                                                                  |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Interface OTP: sucesso, falha segura e reenvio  | 3 testes unitários PASS; respostas simuladas, não prova de inbox                                                                                           |
| CSV portado do PR #2                            | 11 verificações filtradas PASS; restante do arquivo não repetido manualmente                                                                               |
| Restauração em PostgreSQL 17 real               | 6 testes PASS: vínculos/centavos/IDs, destino preenchido, branch errada/protegida, formato/identidade inválidos e concorrência                             |
| Categorias dentro do lançamento em modos locais | 4 Playwright PASS: receita/despesa em desktop/mobile; rascunho preservado, edição 10→20 e exclusão                                                         |
| QA publicado                                    | 5 testes PASS: cadastro exige confirmação, logout global, senha/reset/segunda sessão, exportação e criação/edição/exclusão guiadas em 1440/390 px          |
| Snapshot e restauração no Neon                  | PASS: 2 contas, 2 categorias, 4 transações e 1 orçamento; saldo 275000 centavos; orçamento gasto 75000; IDs novos, origem preservada e repetição bloqueada |

A suíte publicada prepara suas identidades **fictícias** com e-mail verificado no SQL do QA para testar sessões e finanças. Não se considera essa preparação prova da verificação do titular. Uma tentativa de automatizar OTP pelo banco encontrou o código protegido pelo provedor e não foi usada como aprovação. O gate de inbox/titularidade permanece separado.

O primeiro teste publicado precisou corrigir um seletor ambíguo de “Adicionar conta” na tela vazia. Isso foi uma falha do teste, não aprovação nem defeito de persistência. O bloqueio de categorias informado pelo titular foi uma falha de fluxo e recebeu correção e teste específico.

A auditoria anterior (121 unitários, 16 integrações PostgreSQL, 12 Neon, 74 Playwright + 6 condicionais, 3 smoke e 2 Python) permanece preservada em [auditoria-backend-neon.md](auditoria-backend-neon.md). Nesta etapa foram executados testes novos/afetados; o CI realiza regressões nos commits atualizados. Dependências do aplicativo e lockfile não mudaram; a auditoria anterior do mesmo lockfile reportou zero vulnerabilidades.

## Observabilidade e recuperação

As respostas HTTP foram observadas no ambiente publicado e as gravações conferidas em SQL de QA. A consulta inicial de runtime encontrou um aviso TLS do driver enviado a stderr e classificado como error pela plataforma, não uma falha SQL/HTTP. A configuração QA seguinte foi ajustada para `verify-full`. Logs brutos ficaram privados; não foram publicados headers, tokens, URLs de recuperação ou e-mails.

O ensaio lógico de restauração demorou 973 ms, excluindo provisionamento/revisão/ativação. Não é SLA. Não foi executado PITR histórico nem dump externo. Backup físico pode restaurar credenciais/sessões antigas; o [procedimento](backups.md) exige reconciliação de Auth antes de ativar uma cópia.

Documentação de operação: [instalação](instalacao.md), [recuperação](recuperacao.md), [backups](backups.md), [plano Production](migracao-production.md), [rollback](rollback.md) e [privacidade](privacidade.md).

## Evidências e decisão

Evidências sanitizadas em [audit-evidence/v1-launch](audit-evidence/v1-launch): testes publicados, HTTP autenticado, comparação de Production/SSO, restauração e avaliação do PR #2. O head final, seu CI e a publicação correspondente são registrados na [descrição do PR #3](https://github.com/Tsilveira-dev/saldolab/pull/3) após as verificações finais, mantendo este relatório rastreável aos ensaios descritos.

- [x] Código e testes novos preparados exclusivamente na branch #3; nenhuma alteração da main Git.
- [x] Preview protegido acessado sem desativar SSO.
- [x] Mecanismos suportados de revogação e recuperação administrativa ensaiados em QA.
- [x] Defeito de categoria corrigido com prova desktop/mobile publicada.
- [x] Plano de migração/configuração/rollback preparado, sem executá-lo em Production.
- [ ] Corroborar confirmação do e-mail e aceite do titular no QA correto, após a correção.
- [ ] Aceitar a janela residual JWT ou implementar/revalidar revogação adicional.
- [ ] Autorizar e executar separadamente infraestrutura Production, SMTP, role mínima, backup/alertas/privacidade e smoke da publicação autorizada.
- [ ] Emitir GO apenas quando os gates aplicáveis estiverem concluídos; manter draft até lá.

**NO-GO atual não impede revisar os commits e o plano. Ele impede tratar os ensaios QA como autorização para merge, Production ou finanças reais.**
