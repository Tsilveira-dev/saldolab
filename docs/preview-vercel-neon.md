# SaldoLab — Validação segura do preview Vercel + Neon

Estado: **pendente de acesso da conexão Vercel ao projeto saldolab**. Não é um roteiro de produção.

## Identificação validada

- URL do usuário: https://vercel.com/fair-play7/saldolab/2AW7mCUorWQF4oQBUidAThX8FHW5
- Time exibido no endereço: `fair-play7`.
- Repositório: `Tsilveira-dev/saldolab`; branch de trabalho: `feat/neon-backend-foundation`; PR #3.
- A conexão atual à Vercel lista a equipe FAIR PLAY, mas lista somente `fairplay-teste`; chamadas ao projeto `saldolab` e à identificação do deployment retornaram 404. **Não provisionar projeto duplicado.**
- CI GitHub Actions do PR #3 passou em 2026-11-12 para o commit `132845f2`; testes com banco remoto e deploy preview permanecem pendentes.

## Recuperar acesso à Vercel

Conferir na integração conectada da Vercel se a seleção de projetos inclui explicitamente `saldolab`. O fato de autorizar a equipe não comprova acesso a todos os projetos. Quando a integração puder ler o projeto correto, obter o **ID real do projeto** e confirmar seu Git remoto `Tsilveira-dev/saldolab` e branch de produção `main`.

## Preparar o ambiente isolado

1. Nunca colocar segredos no GitHub, no React ou em variáveis `VITE_*` (exceto URL pública do Neon Auth).
2. Usar **somente** a branch Neon `development` (projeto `soft-term-72911921`, branch `br-wandering-mouse-bc0u10oc`).
3. Criar variáveis de preview da Vercel restritas à branch Git `feat/neon-backend-foundation`:
   - `DATABASE_URL`: connection string **pooled** de development, no servidor e protegida;
   - `NEON_AUTH_BASE_URL`: URL do Managed Better Auth de development, no servidor;
   - `NEON_AUTH_JWKS_URL`: URL JWKS do mesmo Auth, no servidor;
   - `VITE_NEON_AUTH_URL`: URL pública do mesmo Auth, utilizada apenas pelo navegador.
4. Revisar domínio/trusted origin **exato** do preview em Neon Auth. Evitar habilitar domínios genéricos e evitar apontar preview para banco main.
5. Confirmar que o `vercel.json` mantém as rotas `/api/*` fora do rewrite SPA e que o projeto da Vercel permite Vercel Functions para Vite.
6. Ativar deployment para a feature branch **apenas após** verificar Git, branch e escopo das variáveis; usar Preview (nunca Production). Verificar GitHub CI no commit exato antes do deploy.

## Testes para aprovação do preview

- `GET /api/health` responde 200 sem dados financeiros e sem credenciais.
- `GET /api/finance` sem token retorna 401, nunca dados.
- Criar usuário fictício A, cadastrar conta/categoria/transação/orçamento fictícios; confirmar dashboard após atualizar/reabrir página.
- Criar usuário fictício B; tentar acessar/editar/excluir IDs de A e validar isolamento (404/403).
- Editar o mesmo registro em duas sessões e verificar o conflito 409; nenhuma alteração deve ser perdida silenciosamente.
- Confirmar compatibilidade de números em centavos, datas e transferências.
- Validar login, logout, sessão expirada, falhas de rede, responsividade e restauração segura do modo local.
- Confirmar que importação JSON na nuvem continua **desabilitada** até possuir prévia e confirmação transacional.
- Confirmar que nenhuma mudança de main/Production ou migration do banco main ocorreu.

### Bloqueios conhecidos

- A Vercel acessível pela integração ainda não lista `saldolab`.
- O PR #3 ainda não possui teste E2E real do Neon Auth + Vercel.
- Não mesclar/publicar sem fechar esses bloqueios e nova revisão de segurança.
