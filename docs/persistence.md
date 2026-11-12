# Persistência e preparação para banco remoto

> O contrato local abaixo está preservado. O PR #3 implementa o repositório remoto e exportação cloud; a restauração administrativa isolada está documentada em [backups](backups.md). Importação pela interface da nuvem continua bloqueada.

## Contrato do repositório

`createLocalRepository({ mode, storage?, seed?, lockManager? })` devolve um objeto com os seguintes métodos. `lockManager` usa `navigator.locks` por padrão e pode ser injetado nos testes. Todos retornam `Promise`; erros rejeitam a promessa.

| Método                       | Resultado                                            |
| ---------------------------- | ---------------------------------------------------- |
| `snapshot()`                 | Agregado validado, independente do objeto armazenado |
| `list(entity)`               | Lista de registros                                   |
| `getById(entity, id)`        | Registro ou `null`                                   |
| `create(entity, values)`     | Registro criado com ID único                         |
| `update(entity, id, values)` | Registro atualizado, preservando o ID                |
| `remove(entity, id)`         | Exclusão protegida por integridade                   |
| `exportBackup()`             | Texto JSON com metadados e agregado                  |
| `importBackup(text)`         | Validação e substituição integral do modo ativo      |
| `reset()`                    | Demonstração original ou conjunto pessoal vazio      |

Entidades: `accounts`, `categories`, `transactions`, `budgets`. O provider é o ponto de composição: substitua a criação do repositório ali por uma implementação HTTP. Evite tornar cada componente responsável por clientes, URLs ou credenciais.

Atualizações e exclusões aceitam opcionalmente `{ expected: registroOriginal }` como último argumento. A UI sempre envia o registro apresentado ao usuário; se ele mudou, a operação é rejeitada. Criação/edição retornam a versão normalizada que foi efetivamente persistida.

As leituras são puras: não inicializam a base no localStorage e não reservam edição. Na ausência de conteúdo, devolvem uma demonstração em memória ou um conjunto pessoal vazio. Dados existentes ou corrompidos nunca são substituídos automaticamente.

Antes de escrever, chamar `startEditing()` em um documento que ainda não leu a base. Retorna `true` se a reserva foi concedida, `false` se indisponível. `getEditingAccess()` fornece `{ canWrite, supported, reason }`; `subscribeEditing(listener)` acompanha mudanças e devolve uma função para cancelar a assinatura. `stopEditing()` libera a reserva e impede reativação no mesmo documento. Cada método CRUD continua assíncrono, mas exige uma reserva válida e confirma a gravação por leitura do JSON antes de resolver.

Na UI, **Ativar edição** grava somente uma intenção de navegação em sessionStorage e recarrega a página, preservando mês e filtro de conta. O novo documento tenta reservar edição antes de ler. Essa intenção não é compartilhada como mecanismo de exclusão mútua e não concede permissão em visitas normais ou retorno pelo histórico. A API Web Locks continua sendo a autoridade local da reserva.

Uma única aba edita cada modo. Outras abas preservam consulta, CSV e backup, com ações financeiras de escrita desabilitadas. **Encerrar edição**, fechar/sair do documento e trocar de modo liberam a reserva. Uma atualização tenta retomar somente a editora anterior. Voltar por BFCache atualiza os dados e mantém a sessão antiga em consulta. Para assumir edição em outra aba ou numa sessão retomada, usar **Ativar edição**, com nova recarga.

Sem Web Locks/contexto seguro, consulta e exportação continuam possíveis e toda escrita é recusada. O formato JSON v1 e as chaves financeiras permanecem compatíveis; não foi adicionado banco remoto, versão de dados ou outro armazenamento financeiro.

## Formato v1

```json
{
  "app": "SaldoLab",
  "exportedAt": "2026-11-11T12:00:00.000Z",
  "data": {
    "version": 1,
    "accounts": [],
    "categories": [],
    "transactions": [],
    "budgets": []
  }
}
```

Os esquemas Zod são a referência dos campos. IDs são strings únicas por entidade, centavos são inteiros e datas não contêm fuso. O backup aceita até 20 MB e impõe limites de tamanho por coleção. A importação verifica tipos, IDs duplicados, vínculos, categorias compatíveis e orçamentos duplicados antes de qualquer gravação. Um backup não é um CSV; não há importador de extratos nesta fase.

## Evolução segura para PostgreSQL e API

1. Escolher provedor e autenticação com o responsável, sem migrar automaticamente os dados locais.
2. Implementar tabelas `accounts`, `categories`, `transactions`, `budgets` com chaves estrangeiras, restrições para valores/tipos e chave única `(user_id, category_id, month)` nos orçamentos.
3. Adicionar `user_id` e validar titularidade em cada operação no servidor ou no banco. Uma transferência não pode cruzar contas de usuários diferentes. O usuário é obtido da sessão autenticada, jamais aceito livremente do corpo da requisição.
4. Implementar endpoints REST e um repositório HTTP com o mesmo contrato. Os saldos e as regras de autorização precisam ser validados no servidor; filtros no frontend servem apenas à apresentação.
5. Executar mutações relacionadas em transações do banco. Adotar versionamento otimista/ETag para evitar perda de atualização concorrente, paginação no servidor e índices por usuário/data/conta/categoria.
6. Criar migrações versionadas, políticas de autorização, trilha de auditoria e testes de isolamento entre usuários.
7. Oferecer importação explícita do JSON v1 com prévia, validação e migração transacional. Preservar o backup original e permitir verificação antes de apagar dados locais.

Uma futura versão do formato deve ter função de migração explícita e testada. Uma versão desconhecida permanece intacta até o usuário recuperar/exportar os dados. Não tratar apagar a chave e gerar outra como migração.
