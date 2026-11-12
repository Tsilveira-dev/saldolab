# Privacidade e limites do piloto — preparação v1.0

Este é um registro operacional da versão em preparação. O responsável precisa definir/publicar os dados de contato e a política aplicável antes de cadastro público. Não se declara conformidade legal ou autorização para processar finanças reais apenas por existir este arquivo.

## Dados e destinos

| Modo         | Dados                                                      | Local                                              |
| ------------ | ---------------------------------------------------------- | -------------------------------------------------- |
| Demonstração | Registros fictícios e alterações locais                    | Navegador                                          |
| Pessoal      | Finanças informadas pelo titular                           | Navegador; não sincroniza automaticamente          |
| Nuvem        | Nome/e-mail e estado de autenticação; finanças por usuário | Neon Auth e PostgreSQL do ambiente                 |
| Operação     | Metadados técnicos de requisição/sessão e falhas           | Provedores Neon/Vercel conforme configuração/plano |
| Backup JSON  | Finanças exportadas, sem credenciais                       | Arquivo sob controle do titular                    |

Não há envio automático de backups locais à nuvem. Sair ou trocar de usuário oculta o snapshot anterior da interface. Acesso à API depende de JWT e filtro de usuário; o limite de revogação é descrito em [recuperação](recuperacao.md).

## Acesso e suporte

O piloto proposto é fechado. O responsável deve identificar o controlador/contato de suporte, regras de acesso administrativo, finalidade, retenção e canal para solicitações do titular antes de abrir inscrições. Não publicar o e-mail pessoal usado no ensaio como contato de suporte sem consentimento.

O titular pode consultar, editar, excluir registros individuais e exportar os dados. Exclusão da conta e eliminação completa não têm autosserviço nesta versão. Uma solicitação precisa de verificação de identidade, escopo, confirmação específica e procedimento administrativo revisado que considere referências, Auth, backups e retenções; não improvisar DELETE em Production. Nenhum dado existente foi apagado para preparar este procedimento.

## Backups, logs e segurança operacional

JSON exportado não é criptografado pela aplicação. Não anexar backup real a PR/chat nem armazená-lo em repositório público. Tokens, senhas, connection strings e URLs de recuperação são secretos; restringir acesso e redigir logs antes de compartilhá-los. Confirmar retenção, acesso e redação de parâmetros sensíveis nos provedores antes de uso real.

Definir capacidade e custo dos planos, limite de usuários e suporte do piloto. Se houver uso comercial, confirmar a adequação do plano Vercel; não assumir permissão comercial de um plano Hobby. Não alterar plano ou billing automaticamente. Política pública e expansão multiusuário permanecem condicionadas à revisão do responsável.
