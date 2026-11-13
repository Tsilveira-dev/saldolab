-- SaldoLab / schema inicial v1 (somente ambientes de desenvolvimento até revisão)
-- Aplique com conexão direta e transação. Requer autorização no backend para toda leitura e escrita.
-- IDs varchar(120) preservam compatibilidade com backup JSON v1. Nunca publicar DATABASE_URL no Vite.
CREATE TABLE IF NOT EXISTS public.accounts (
  id varchar(120) NOT NULL,
  user_id text NOT NULL,
  name varchar(100) NOT NULL CHECK (char_length(btrim(name)) >= 2),
  type text NOT NULL CHECK (type IN ('checking','digital','savings','cash')),
  initial_balance_cents bigint NOT NULL CHECK (initial_balance_cents BETWEEN -100000000000 AND 100000000000),
  color varchar(7) NOT NULL CHECK (color ~ '^#[[:xdigit:]]{6}$'),
  icon text NOT NULL,
  created_at date NOT NULL,
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  PRIMARY KEY (id),
  UNIQUE (user_id,id)
);

CREATE TABLE IF NOT EXISTS public.categories (
  id varchar(120) NOT NULL,
  user_id text NOT NULL,
  name varchar(100) NOT NULL CHECK (char_length(btrim(name)) >= 2),
  type text NOT NULL CHECK (type IN ('income','expense')),
  color varchar(7) NOT NULL CHECK (color ~ '^#[[:xdigit:]]{6}$'),
  icon text NOT NULL,
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  PRIMARY KEY (id),
  UNIQUE (user_id,id)
);

CREATE TABLE IF NOT EXISTS public.transactions (
  id varchar(120) NOT NULL PRIMARY KEY,
  user_id text NOT NULL,
  description varchar(100) NOT NULL CHECK (char_length(btrim(description)) >= 2),
  type text NOT NULL CHECK (type IN ('income','expense','transfer')),
  amount_cents bigint NOT NULL CHECK (amount_cents BETWEEN 1 AND 100000000000),
  category_id varchar(120),
  account_id varchar(120) NOT NULL,
  destination_account_id varchar(120),
  date date NOT NULL,
  status text NOT NULL CHECK (status IN ('confirmed','pending')),
  notes varchar(1000) NOT NULL DEFAULT '',
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id,id),
  CONSTRAINT fk_transaction_account FOREIGN KEY (user_id,account_id) REFERENCES public.accounts(user_id,id) ON DELETE RESTRICT,
  CONSTRAINT fk_transaction_destination FOREIGN KEY (user_id,destination_account_id) REFERENCES public.accounts(user_id,id) ON DELETE RESTRICT,
  CONSTRAINT fk_transaction_category FOREIGN KEY (user_id,category_id) REFERENCES public.categories(user_id,id) ON DELETE RESTRICT,
  CONSTRAINT tx_type_rules CHECK (
   (type = 'transfer' AND category_id IS NULL AND destination_account_id IS NOT NULL AND destination_account_id <> account_id)
   OR (type IN ('income','expense') AND category_id IS NOT NULL AND destination_account_id IS NULL)
  )
);

CREATE TABLE IF NOT EXISTS public.budgets (
  id varchar(120) NOT NULL PRIMARY KEY,
  user_id text NOT NULL,
  category_id varchar(120) NOT NULL,
  month char(7) NOT NULL CHECK (month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  limit_cents bigint NOT NULL CHECK (limit_cents BETWEEN 1 AND 100000000000),
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  UNIQUE (user_id,id),
  UNIQUE (user_id,category_id,month),
  CONSTRAINT fk_budget_category FOREIGN KEY (user_id,category_id) REFERENCES public.categories(user_id,id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_accounts_user ON public.accounts(user_id);

CREATE INDEX IF NOT EXISTS idx_categories_user_type ON public.categories(user_id,type);

CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON public.transactions(user_id,date DESC);

CREATE INDEX IF NOT EXISTS idx_transactions_user_account ON public.transactions(user_id,account_id);

CREATE INDEX IF NOT EXISTS idx_transactions_user_category ON public.transactions(user_id,category_id);

CREATE INDEX IF NOT EXISTS idx_budgets_user_month ON public.budgets(user_id,month);
