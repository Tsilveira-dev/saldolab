-- PLANO, NÃO EXECUTADO EM PRODUCTION.
-- Requer autorização e role saldolab_runtime previamente criada por canal seguro.
-- Verificar ausência de memberships/privilégios administrativos; não usar owner.
-- Executar somente após a migração inicial e confirmação de banco/branch.
GRANT CONNECT ON DATABASE saldolab TO saldolab_runtime;
GRANT USAGE ON SCHEMA public TO saldolab_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.accounts, public.categories, public.transactions, public.budgets
  TO saldolab_runtime;
-- Não conceder CREATE, privilégios em neon_auth, ALL TABLES ou default privileges amplos.
