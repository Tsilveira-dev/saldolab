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

- **GitHub:** o responsável criou `Tsilveira-dev/saldolab`, público e inicialmente vazio. A existência, o nome e a permissão administrativa da conta foram confirmados. O envio de `main` foi tentado por Git, incluindo a configuração explícita do helper autenticado do GitHub CLI, mas retornou HTTP 403. A criação do README pela conexão nativa também foi recusada com `Resource not accessible by integration`. Nenhum arquivo foi gravado no GitHub; o histórico está preservado localmente.
- **Vercel:** criar o projeto `saldolab` na equipe FAIR PLAY retornou **HTTP 403**, “You don't have permission to create the project.” Nenhum projeto ou deployment foi criado. Não havia CLI Vercel instalada nem credencial CLI disponível para a alternativa indicada pelo serviço. Não foi presumido que reconectar a conta resolveria o bloqueio.

**Não há URL Vercel nesta entrega.** Projetos externos existentes não foram modificados.

## Prévia privada alternativa

A aplicação foi publicada com sucesso por **Sites**, mantendo o acesso privado do proprietário:

- Aplicação: https://saldolab-financas.boundlessonyx2.chatgpt.site
- Entrega com ZIP e Git bundle: https://saldolab-financas.boundlessonyx2.chatgpt.site/entrega/index.html
- Configuração dessa prévia: `.openai/hosting.json`, independente de `vercel.json`.
- O sucesso da publicação foi confirmado pela ferramenta de hospedagem; os fluxos no navegador continuam pendentes da suíte Playwright.

Essa prévia permite avaliar a aplicação enquanto os acessos GitHub/Vercel são resolvidos. Ela não altera a arquitetura local nem adiciona autenticação ou banco à aplicação. A hospedagem privada controla o acesso à prévia.

## Ação humana necessária

1. No GitHub, incluir o repositório existente `saldolab` no acesso autorizado da integração ChatGPT/Codex e aceitar as permissões de escrita solicitadas. A permissão administrativa da conta não substitui as permissões da credencial da integração. O envio inclui um workflow em `.github/workflows`, que também precisa ser permitido.
2. Após liberar o acesso, enviar o histórico com `git push -u origin main`. O remoto `origin` já aponta para `https://github.com/Tsilveira-dev/saldolab.git`. Se estiver usando o ZIP sem histórico Git, inicializar um novo repositório, adicionar os arquivos e criar o primeiro commit antes de configurar o remoto.
3. Na Vercel, concluir a autorização de acesso à equipe FAIR PLAY pelo link temporário fornecido na conversa. A ferramenta de autorização solicitou explicitamente essa ação humana. Depois, repetir a criação do projeto e a importação GitHub; se a gravação continuar negada, revisar as permissões de criação de projetos da integração/equipe. O link não é persistido no código porque é de uso único e expira em 10 minutos.
4. Executar o workflow de qualidade; para verificar o ambiente publicado, informar sua URL em **Run workflow → base_url**. Conferir os resultados desktop/mobile e as capturas antes de considerar a validação hospedada concluída.

Não é necessário fornecer tokens em chat. Nenhuma autenticação ou chave de banco foi criada na aplicação.

Depois da publicação, verificar HTTP das rotas diretas e executar o workflow de qualidade informando a URL publicada. O build é estático: os dados financeiros continuam no localStorage de cada navegador e não são enviados à Vercel.
