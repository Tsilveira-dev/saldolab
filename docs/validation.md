# Verificação do MVP

O estado atual está no [relatório final A–F](auditoria-final.md), com evidências de comandos, testes, falhas reproduzidas e correções. O [diagnóstico inicial](auditoria-inicial.md) foi registrado antes das alterações de código.

## Como repetir

```bash
npm ci
npm run lint
npm run format:check
npm run test
npm run build
npm run test:e2e
python3 -m unittest discover -s scripts -p 'test_*.py'
npm audit
```

Instale o navegador antes da sequência com `npx playwright install chromium`, quando necessário. Neste sandbox foi usado o Chromium do sistema, com `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium`, e o cache npm ficou em `work/npm-cache` via `npm_config_cache`, pois o cache padrão não era gravável.

Vitest usa jsdom e substitui apenas os gráficos nos testes de integração da aplicação. Playwright valida SVG, tooltips, operações reais, desktop e emulação móvel em perfis isolados, com dados fictícios. A prova de concorrência também importa o módulo real pelo servidor Vite local. Os demais fluxos usam o build de produção.

Os testes em https://saldolab.vercel.app avaliaram a baseline publicada. O certificado da inspeção HTTPS do ambiente não foi aceito diretamente pelo Chromium. Recursos reais foram entregues ao navegador pelo cliente HTTP Playwright com proxy/CA confiáveis e validação TLS ativa. Essa validação não substitui o teste de TLS direto em outro ambiente.

As limitações anteriores de execução de navegador foram superadas para esta auditoria por Playwright/Chromium. A suíte já foi executada; não deve mais ser descrita como simplesmente pendente.

## Limites

- Percentual de cobertura de código não medido.
- Emulação móvel não substitui Safari/iOS e Android reais.
- A revisão de contraste é uma amostra computada do dashboard, sem certificação WCAG completa.
- Não foi executado Excel ou LibreOffice para validar fórmulas no CSV.
- Nenhum dado financeiro real ou perfil do usuário foi utilizado.
- Sem merge, deploy, alteração de outros repositórios ou migração de dados.
