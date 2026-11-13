# SaldoLab — controle de conclusão por etapa (v1.0)

Atualizado em 2026-11-13. Fonte de verdade: PR #3 `feat/neon-backend-foundation`, `docs/lancamento-v1.md` e checks do **HEAD atual**. Um teste antigo não aprova código posterior.

**Regra do projeto:** só marcar uma etapa CONCLUÍDA quando existir (a) correção no SHA atual, (b) testes automatizados PASS, (c) evidência manual/QA quando aplicável e (d) nenhuma pendência bloqueante para a etapa. FAIL/BLOCKED impedem avançar para Production.

| Etapa                                          | Objetivo e critério de saída                                                                                                                                   | Estado atual                                                                                                                                    |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| **E0. Inventário e modos**                     | Documentar `demo`, `personal`, `cloud`, persistência real e escopo de usuário                                                                                  | **PASS de arquitetura**: local é por navegador/origem, não por login; cloud é por identidade Neon.                                              |
| **E1. Cadastro e confirmação em modos locais** | Criar, editar, excluir transação nos modos demo/personal, confirmar no armazenamento e em reload; mensagens distintas para criar/editar; sem falsa confirmação | **EM VALIDAÇÃO**: commit de feedback específico e testes E2E novos devem passar CI no SHA atual; aceite manual no celular ainda falta.          |
| **E2. Formulário mobile sem conta/categoria**  | Conta e categoria criadas inline, selecionadas automaticamente, rascunho preservado, transação só concluída após salvar, sem overflow/tela inacessível         | **PASS automatizado no head anterior**; repetir smoke no head atual e obter aceite no celular físico.                                           |
| **E3. Isolamento de usuários na nuvem**        | Conta A não vê dados B, nem em logout/login na mesma aba, em outra aba e após resposta HTTP atrasada; API exige JWT + sessão ativa                             | **PASS automatizado no head anterior**; testes reais em Preview QA. Não confundir dado local (compartilhado pelo navegador) com login na nuvem. |
| **E4. Integridade financeira**                 | CRUD de quatro entidades, centavos, saldo, transferências, mês, categoria, revisão 409, backup JSON, restauração em QA isolado                                 | **PASS automatizado no head anterior**; conferir CI completo do head atual.                                                                     |
| **E5. QA final e aceite**                      | SHA e Preview exatos; conta verificada OTP, cloud no QA correto, CRUD + reload, exportação e celular físico com prova de execução; nenhum segredo no relatório | **PENDENTE aceite manual mobile/QA**. Preview alias de branch pode apontar a development; não serve automaticamente como QA release.            |
| **E6. Preparação Production**                  | SMTP e Auth de Neon main, migrações 0001+0002, role mínima, env Vercel Production, backup externo/PITR, alertas, privacidade e rollback; aprovação explícita   | **BLOQUEADO por autorização e operação**; não fazer merge/deploy antecipadamente.                                                               |
| **E7. Lançamento e operação**                  | Smoke em domínio definitivo após deploy, backup restaurável, monitoramento e rollback prontos; decisão GO do titular                                           | **NÃO INICIADA**.                                                                                                                               |

## Ponto importante: dados locais não pertencem a contas Neon

`localStorage` de **Modo Pessoal** e **Demonstração** usa as chaves `saldolab:v1:personal` e `saldolab:v1:demo` por **navegador e domínio**. Qualquer pessoa que use o mesmo perfil de navegador pode visualizar esses dados locais, mesmo após sair do Neon Auth. Isso é comportamento arquitetural do modo local, não vazamento do isolamento cloud; se a expectativa é privacidade por usuário, escolher **Modo nuvem** em dispositivo compartilhado, sair da sessão e usar perfis privados separados. Não anunciar isolamento de login para os modos locais.

## Evidências mínimas por teste manual

Registrar somente: data, navegador/dispositivo, origem do Preview, modo mostrado, SHA do deployment, operação, valor fictício, resultado PASS/FAIL e screenshot sem segredo. Não divulgar e-mail de teste, senha, código OTP, URL de reset ou token.

1. Pessoal vazio: selecionar `personal`; ativar edição; iniciar transação; criar conta/categoria inline quando ausentes; **somente após Adicionar registro** ver toast **Transação cadastrada com sucesso** e um registro; atualizar e confirmar permanência.
2. Demonstração: selecionar `demo`, ativar edição se necessário; criar uma nova transação fictícia; validar nova linha, cálculo, toast e reload; garantir que `personal` está intacto.
3. Nuvem QA: entrar com e-mail verificado; confirmar `Modo nuvem`/selo `Neon PostgreSQL`; repetir CRUD/reload em conta de teste própria; verificar SQL em QA pela identidade correspondente. Nunca usar o saldo do desenvolvimento como comprovação de QA.
4. Sessão: sair A, entrar B; B não pode ver dados de A. Ao alternar explicitamente para `personal`, entender que o conteúdo local do navegador não acompanha o login (é intencional).
5. Edição: editar o registro, receber **atualizado com sucesso**, conferir novo valor, depois excluir com confirmação. Não tratar cadastro de conta/categoria como cadastro de transação.
6. Mobile: viewport real no celular, teclado aberto, seletor de conta, categoria e botões acessíveis, sem perder campos nem exceder altura da tela.

## Decisões de passagem

- **E1 → E2:** CI do último SHA + criação real em ambos os modos locais confirmada.
- **E2 → E3:** fluxo zero-state conta/categoria mobile confirmado.
- **E3 → E4:** Auth/sessão A↔B e autorização server-side comprovados.
- **E4 → E5:** cálculos, concorrência e backup/restauração em QA PASS.
- **E5 → E6:** aceite do titular em QA correto e relatório sem bloqueios de código.
- **E6 → E7:** autorização explícita para mudanças Production, infraestrutura conferida e rollback operacional.
- **GO definitivo:** aceite do titular + smoke pós-deploy + observabilidade e capacidade de restaurar backups verificadas.

## Próxima ação

Aguardar o GitHub Actions do HEAD com alteração de mensagens de cadastro/edição e os dois novos testes locais; corrigir qualquer falha. Depois fazer o aceite manual no celular (E1, E2 e E5). Não declarar v1.0 lançada somente pelos testes locais.
