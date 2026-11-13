# Rollback da primeira versão com nuvem

Este é um roteiro preparado, não executado em Production. Exige autorização do responsável e registro do incidente, alvo e SHA. Rollback de aplicação e recuperação de dados são decisões separadas.

## Antes de liberar

- Registrar SHA de código, deployment Production, URLs Auth/JWKS, branch do banco, migração e configuração de runtime, sem valores secretos.
- Ter backup conferido, acesso administrativo independente do runtime e responsável por contenção.
- Manter a versão anterior compatível com o schema **e com a checagem ativa de sessão**. A baseline local anterior não possui o fluxo de nuvem; não é fallback equivalente para usuários cloud. Versões cloud anteriores a `ca9e3cc` aceitavam JWT sem checar sessão: não são fallback seguro para esta política.
- Aprovar previamente o procedimento de congelar escritas do runtime e, se necessário, todo o acesso, inclusive de deployments antigos. Não presumir que mudar somente um alias bloqueia clientes apontando para um deployment anterior.

## Falha apenas de aplicação

1. Identificar o deployment/SHA que falhou e obter logs sanitizados, preservando dados.
2. Conter gravações se houver risco de integridade. O responsável de banco pode autorizar a retirada temporária de INSERT/UPDATE/DELETE do runtime, mantendo SELECT para consulta/backup. A aplicação deve retornar erro, nunca sucesso. Não usar a role administrativa como substituta para contornar a contenção.
3. Se existir deployment anterior **cloud compatível com o mesmo Auth, banco e função de sessão**, revisar e autorizar o rollback da aplicação para ele. Não remover `0002`, conceder SELECT em Auth ou reativar JWT sozinho para contornar uma falha. Na primeira publicação cloud, preferir contenção/manutenção e correção à frente; não promover silenciosamente a baseline local.
4. Revalidar login, isolamento, leitura, escrita, centavos e exportação com dados fictícios antes de liberar gravações.

Não há comando de rollback automático nesta entrega. Nenhum alias Production, configuração ou permissão foi alterado para testar este roteiro.

## Corrupção ou perda de dados

1. Congelar as escritas e preservar o banco atual, com horário e evidências.
2. Criar uma nova branch de recuperação a partir de um ponto/backup aprovado; não restaurar por cima da origem.
3. Conferir integridade, contagens, diferenças e operações posteriores ao ponto escolhido. Não descartar gravações posteriores sem decisão do titular/responsável.
4. Reconciliar Auth e revogar sessões restauradas. Não permitir retorno de senha antiga após PITR.
5. Submeter o destino recuperado e o plano de reconciliação a autorização antes de mudar qualquer conexão Production.
6. Fazer novo build se mudar a URL pública Auth. Testar a publicação recuperada e só então autorizar a retomada.

Nunca executar DROP, TRUNCATE, restauração in-place, merge ou troca de conexão Production como ação automática. [Backups e limites do ensaio](backups.md) detalha o que foi comprovado e o que permanece pendente.
