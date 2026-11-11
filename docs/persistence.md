# Persistência e preparação para banco remoto

## Contrato do repositório

`createLocalRepository({ mode, storage?, seed? })` devolve um objeto com os seguintes métodos. Todos retornam `Promise`; erros rejeitam a promessa.

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
