-- ============================================================
-- MAPFIN - Schema inicial
-- ============================================================

-- Extensão para gerar UUIDs
create extension if not exists "pgcrypto";

-- ============================================================
-- Tabela: categories
-- Categorias de transação (ex.: Alimentação, Transporte)
-- ============================================================
create table if not exists categories (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users(id) on delete cascade,
  name        text        not null,
  icon        text        not null default '📦',
  color       text        not null default '#f59e0b',
  type        text        not null check (type in ('expense', 'income')) default 'expense',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz, -- soft delete

  unique (user_id, name, type)
);

-- ============================================================
-- Tabela: accounts
-- Contas bancárias / carteiras do usuário
-- ============================================================
create table if not exists accounts (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users(id) on delete cascade,
  name        text        not null,
  type        text        not null default 'checking' check (type in ('checking','savings','wallet','credit','investment')),
  color       text        not null default '#3b82f6',
  initial_balance numeric(12,2) not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

-- ============================================================
-- Tabela: transactions
-- Registros de receitas e despesas
-- ============================================================
create table if not exists transactions (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        not null references auth.users(id) on delete cascade,
  account_id   uuid        references accounts(id) on delete set null,
  category_id  uuid        references categories(id) on delete set null,

  description  text        not null,
  amount       numeric(12,2) not null,  -- positivo para receita, negativo para despesa
  date         date        not null default current_date,
  is_recurrent boolean     not null default false,
  notes        text,

  created_at   timestamptz  not null default now(),
  updated_at   timestamptz  not null default now(),
  deleted_at   timestamptz  -- soft delete
);

-- Índices para performance
create index if not exists idx_transactions_user_date   on transactions(user_id, date DESC);
create index if not exists idx_transactions_user_month   on transactions(user_id, date_trunc('month', date));
create index if not exists idx_categories_user          on categories(user_id);
create index if not exists idx_accounts_user            on accounts(user_id);

-- ============================================================
-- Função: auto-update updated_at
-- ============================================================
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Triggers
drop trigger if exists trg_transactions_updated_at on transactions;
create trigger trg_transactions_updated_at
  before update on transactions
  for each row execute function update_updated_at();

drop trigger if exists trg_categories_updated_at on categories;
create trigger trg_categories_updated_at
  before update on categories
  for each row execute function update_updated_at();

drop trigger if exists trg_accounts_updated_at on accounts;
create trigger trg_accounts_updated_at
  before update on accounts
  for each row execute function update_updated_at();

-- ============================================================
-- RLS - Row Level Security
-- ============================================================
alter table categories   enable row level security;
alter table accounts     enable row level security;
alter table transactions enable row level security;

-- Categories
drop policy if exists "Users can CRUD own categories" on categories;
create policy "Users can CRUD own categories" on categories
  for all using (user_id = auth.uid() and deleted_at is null);

-- Accounts
drop policy if exists "Users can CRUD own accounts" on accounts;
create policy "Users can CRUD own accounts" on accounts
  for all using (user_id = auth.uid() and deleted_at is null);

-- Transactions
drop policy if exists "Users can CRUD own transactions" on transactions;
create policy "Users can CRUD own transactions" on transactions
  for all using (user_id = auth.uid() and deleted_at is null);

-- ============================================================
-- Seed: categorias padrão para novos usuários
-- ============================================================
create or replace function seed_default_categories(new_user_id uuid)
returns void language plpgsql security definer as $$
begin
  insert into categories (user_id, name, icon, color, type) values
    (new_user_id, 'Alimentação',      '🍔', '#ef4444', 'expense'),
    (new_user_id, 'Transporte',       '🚗', '#f97316', 'expense'),
    (new_user_id, 'Moradia',          '🏠', '#eab308', 'expense'),
    (new_user_id, 'Saúde',            '💊', '#22c55e', 'expense'),
    (new_user_id, 'Lazer',            '🎮', '#8b5cf6', 'expense'),
    (new_user_id, 'Educação',         '📚', '#06b6d4', 'expense'),
    (new_user_id, 'Compras',          '🛒', '#ec4899', 'expense'),
    (new_user_id, 'Serviços',         '⚙️',  '#64748b', 'expense'),
    (new_user_id, 'Outros',           '📦', '#f59e0b', 'expense'),
    (new_user_id, 'Salário',          '💰', '#10b981', 'income'),
    (new_user_id, 'Freelance',        '💻', '#3b82f6', 'income'),
    (new_user_id, 'Rendimentos',       '📈', '#8b5cf6', 'income'),
    (new_user_id, 'Presentes',        '🎁', '#ec4899', 'income'),
    (new_user_id, 'Outros Ganhos',    '💵', '#f59e0b', 'income');
end;
$$;

-- Trigger para criar categorias ao criar usuário (via hook auth)
drop trigger if exists trg_on_auth_user_created on auth.users;
create trigger trg_on_auth_user_created
  after insert on auth.users
  for each row execute function seed_default_categories();
