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

Repositório pretendido: `Tsilveira-dev/saldolab`, público, para portfólio. O status e a URL serão registrados após a tentativa de publicação. A conexão Git deve ser verificada para confirmar deploys automáticos após novos commits.

Depois da publicação, verificar HTTP das rotas diretas e executar o workflow de qualidade informando a URL publicada. O build é estático: os dados financeiros continuam no localStorage de cada navegador e não são enviados à Vercel.
