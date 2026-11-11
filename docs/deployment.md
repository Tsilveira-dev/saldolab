# Publicação

## Configuração

- Plataforma: Vercel.
- Equipe disponível: FAIR PLAY (`fair-play7`).
- Projeto pretendido: `saldolab`, novo, sem alterar projetos existentes.
- Framework: Vite.
- Node: 24.x.
- Instalação: `npm ci`.
- Build: `npm run build`.
- Diretório de saída: `dist`.
- Rotas: rewrite de SPA definido em `vercel.json`.
- Variáveis secretas: nenhuma.

## Resultado da tentativa

Em 11 de novembro de 2026, ambas as publicações foram tentadas com os acessos disponíveis:

- **GitHub:** `gh repo create Tsilveira-dev/saldolab --public` foi recusado com `Resource not accessible by integration (createRepository)`. A leitura posterior confirmou que o repositório não existe. O código foi organizado em commits locais; não houve push.
- **Vercel:** criar o projeto `saldolab` na equipe FAIR PLAY retornou **HTTP 403**, “You don't have permission to create the project.” Nenhum projeto ou deployment foi criado. Não havia CLI Vercel instalada nem credencial CLI disponível para a alternativa indicada pelo serviço. Não foi presumido que reconectar a conta resolveria o bloqueio.

**Não há URL publicada nesta entrega.** Projetos externos existentes não foram modificados.

## Ação humana necessária

1. Criar um repositório vazio `Tsilveira-dev/saldolab` no GitHub, sem README gerado, e conceder à conexão acesso de escrita a ele. O acesso para criar repositórios é diferente do acesso para escrever em um repositório existente.
2. Na pasta do projeto, executar `git push -u origin main` após configurar o remoto para esse repositório. Se estiver usando o ZIP sem histórico Git, inicializar um novo repositório, adicionar os arquivos e criar o primeiro commit antes de configurar o remoto.
3. Na Vercel, um membro com permissão suficiente na equipe FAIR PLAY deve criar/importar o projeto ou ajustar o acesso de criação de projetos da conexão. Importar o repositório com as configurações acima.
4. Executar o workflow de qualidade; para verificar o ambiente publicado, informar sua URL em **Run workflow → base_url**. Conferir os resultados desktop/mobile e as capturas antes de considerar a validação hospedada concluída.

Não é necessário fornecer tokens em chat. Nenhuma autenticação ou chave de banco foi criada na aplicação.

Depois da publicação, verificar HTTP das rotas diretas e executar o workflow de qualidade informando a URL publicada. O build é estático: os dados financeiros continuam no localStorage de cada navegador e não são enviados à Vercel.
