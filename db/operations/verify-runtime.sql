-- SOMENTE LEITURA. Conectar como a role de runtime do alvo autorizado.
-- Não imprime credenciais, sessões, dados financeiros ou informações de usuários.
SELECT current_user AS runtime_role, current_database() AS database_name;

SELECT rolsuper, rolcreatedb, rolcreaterole, rolreplication, rolbypassrls
FROM pg_roles WHERE rolname = current_user;
-- Todos devem ser false. Nenhuma membership administrativa pode existir:
SELECT parent.rolname AS member_of
FROM pg_auth_members AS m
JOIN pg_roles AS parent ON parent.oid = m.roleid
JOIN pg_roles AS child ON child.oid = m.member
WHERE child.rolname = current_user;

SELECT
  has_schema_privilege(current_user, 'public', 'CREATE') AS can_create_public,
  has_schema_privilege(current_user, 'neon_auth', 'USAGE') AS can_use_auth_schema,
  has_function_privilege(current_user, 'public.saldolab_session_active(text,uuid)', 'EXECUTE') AS can_check_session;
-- false, false, true. Se função/schema estiver ausente, parar.

SELECT c.relname AS auth_table, has_table_privilege(current_user, c.oid, 'SELECT') AS can_read
FROM pg_class AS c JOIN pg_namespace AS n ON n.oid = c.relnamespace
WHERE n.nspname = 'neon_auth' AND c.relname IN ('session', 'account');
-- Duas linhas, ambas false. Ausência de tabela também impede continuar.

SELECT name AS entity,
  has_table_privilege(current_user, 'public.' || name, 'SELECT') AS can_select,
  has_table_privilege(current_user, 'public.' || name, 'INSERT') AS can_insert,
  has_table_privilege(current_user, 'public.' || name, 'UPDATE') AS can_update,
  has_table_privilege(current_user, 'public.' || name, 'DELETE') AS can_delete
FROM (VALUES ('accounts'), ('categories'), ('transactions'), ('budgets')) AS entities(name);
-- Quatro linhas; todas as quatro permissões true. A API também deve passar no smoke CRUD.

SELECT p.prosecdef AS security_definer, p.proconfig AS function_settings,
  pg_get_userbyid(p.proowner) AS function_owner,
  EXISTS (
    SELECT 1 FROM aclexplode(p.proacl) AS acl
    WHERE acl.grantee = 0 AND acl.privilege_type = 'EXECUTE'
  ) AS public_execute
FROM pg_proc AS p
WHERE p.oid = 'public.saldolab_session_active(text,uuid)'::regprocedure;
-- true; search_path=pg_catalog; owner administrativo distinto do runtime; false.
