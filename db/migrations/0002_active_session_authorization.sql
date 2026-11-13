-- Requer Neon Auth habilitado neste mesmo banco, ou o schema de Auth de teste.
-- Aplicar em transação por role administrativa; nunca pela role de runtime.
-- Só retorna existência de sessão, sem expor tokens, IPs, e-mails ou senhas.
CREATE OR REPLACE FUNCTION public.saldolab_session_active(p_user_id text, p_session_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM neon_auth.session AS s
    WHERE s.id = p_session_id
      AND s."userId"::text = p_user_id
      AND s."expiresAt" > CURRENT_TIMESTAMP
  );
$$;

REVOKE ALL ON FUNCTION public.saldolab_session_active(text, uuid) FROM PUBLIC;
-- Conceder EXECUTE somente à role de runtime, conforme db/operations/runtime-grants.sql.
