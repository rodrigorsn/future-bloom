CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE public.transaction_type AS ENUM ('income', 'expense');
CREATE TYPE public.payment_method AS ENUM ('pix', 'boleto', 'credit_card', 'debit_card', 'cash', 'transfer', 'other');
CREATE TYPE public.transaction_status AS ENUM ('paid', 'pending');
CREATE TYPE public.transaction_origin AS ENUM ('manual', 'import');

CREATE TABLE public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL CHECK (btrim(name) <> ''),
  icon text NOT NULL DEFAULT '📦',
  color text NOT NULL DEFAULT '#f59e0b',
  type public.transaction_type NOT NULL DEFAULT 'expense',
  monthly_limit numeric(12,2) CHECK (monthly_limit IS NULL OR monthly_limit >= 0),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  UNIQUE (user_id, name, type)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories TO authenticated;
GRANT ALL ON public.categories TO service_role;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  category_id uuid NOT NULL REFERENCES public.categories(id) ON DELETE RESTRICT,
  name text NOT NULL CHECK (btrim(name) <> ''),
  color text NOT NULL DEFAULT '#f59e0b',
  icon text NOT NULL DEFAULT '📦',
  monthly_limit numeric(12,2) CHECK (monthly_limit IS NULL OR monthly_limit >= 0),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  UNIQUE (user_id, category_id, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.items TO authenticated;
GRANT ALL ON public.items TO service_role;
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL CHECK (btrim(name) <> ''),
  type text NOT NULL DEFAULT 'checking' CHECK (type IN ('checking', 'savings', 'wallet', 'credit', 'investment')),
  color text NOT NULL DEFAULT '#3b82f6',
  initial_balance numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.accounts TO authenticated;
GRANT ALL ON public.accounts TO service_role;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL,
  category_id uuid NOT NULL REFERENCES public.categories(id) ON DELETE RESTRICT,
  item_id uuid REFERENCES public.items(id) ON DELETE RESTRICT,
  type public.transaction_type NOT NULL,
  description text NOT NULL CHECK (btrim(description) <> ''),
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  date date NOT NULL DEFAULT current_date,
  payment_method public.payment_method NOT NULL DEFAULT 'pix',
  status public.transaction_status NOT NULL DEFAULT 'paid',
  due_date date,
  paid_at timestamptz,
  installment_group_id uuid,
  installment_number integer CHECK (installment_number IS NULL OR installment_number > 0),
  installment_total integer CHECK (installment_total IS NULL OR installment_total > 0),
  recurrence_group_id uuid,
  origin public.transaction_origin NOT NULL DEFAULT 'manual',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT expense_requires_item CHECK (type <> 'expense' OR item_id IS NOT NULL),
  CONSTRAINT valid_installment CHECK (
    (installment_group_id IS NULL AND installment_number IS NULL AND installment_total IS NULL)
    OR
    (installment_group_id IS NOT NULL AND installment_number IS NOT NULL AND installment_total IS NOT NULL AND installment_number <= installment_total)
  )
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transactions TO authenticated;
GRANT ALL ON public.transactions TO service_role;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.transaction_subitems (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  description text NOT NULL CHECK (btrim(description) <> ''),
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transaction_subitems TO authenticated;
GRANT ALL ON public.transaction_subitems TO service_role;
ALTER TABLE public.transaction_subitems ENABLE ROW LEVEL SECURITY;

CREATE INDEX categories_user_idx ON public.categories (user_id);
CREATE INDEX items_user_category_idx ON public.items (user_id, category_id);
CREATE INDEX transactions_user_date_idx ON public.transactions (user_id, date DESC);
CREATE INDEX transactions_user_due_date_idx ON public.transactions (user_id, due_date) WHERE status = 'pending';
CREATE INDEX transactions_item_idx ON public.transactions (item_id);
CREATE INDEX transaction_subitems_transaction_idx ON public.transaction_subitems (transaction_id);

CREATE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER categories_set_updated_at BEFORE UPDATE ON public.categories FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER items_set_updated_at BEFORE UPDATE ON public.items FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER accounts_set_updated_at BEFORE UPDATE ON public.accounts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER transactions_set_updated_at BEFORE UPDATE ON public.transactions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER transaction_subitems_set_updated_at BEFORE UPDATE ON public.transaction_subitems FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE FUNCTION public.validate_item_category()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.categories c
    WHERE c.id = NEW.category_id AND c.user_id = NEW.user_id
  ) THEN
    RAISE EXCEPTION 'A categoria deve pertencer ao usuário do item';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER items_validate_category BEFORE INSERT OR UPDATE ON public.items FOR EACH ROW EXECUTE FUNCTION public.validate_item_category();

CREATE FUNCTION public.validate_transaction_relations()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.categories c
    WHERE c.id = NEW.category_id AND c.user_id = NEW.user_id
  ) THEN
    RAISE EXCEPTION 'A categoria deve pertencer ao usuário da transação';
  END IF;
  IF NEW.item_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.items i
    WHERE i.id = NEW.item_id AND i.category_id = NEW.category_id AND i.user_id = NEW.user_id
  ) THEN
    RAISE EXCEPTION 'O item deve pertencer à categoria e ao usuário da transação';
  END IF;
  IF NEW.account_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.accounts a
    WHERE a.id = NEW.account_id AND a.user_id = NEW.user_id
  ) THEN
    RAISE EXCEPTION 'A conta deve pertencer ao usuário da transação';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER transactions_validate_relations BEFORE INSERT OR UPDATE ON public.transactions FOR EACH ROW EXECUTE FUNCTION public.validate_transaction_relations();

CREATE POLICY "categories_select_own" ON public.categories FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "categories_insert_own" ON public.categories FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "categories_update_own" ON public.categories FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "categories_delete_own" ON public.categories FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE POLICY "items_select_own" ON public.items FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "items_insert_own" ON public.items FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "items_update_own" ON public.items FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "items_delete_own" ON public.items FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE POLICY "accounts_select_own" ON public.accounts FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "accounts_insert_own" ON public.accounts FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "accounts_update_own" ON public.accounts FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "accounts_delete_own" ON public.accounts FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE POLICY "transactions_select_own" ON public.transactions FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "transactions_insert_own" ON public.transactions FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "transactions_update_own" ON public.transactions FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "transactions_delete_own" ON public.transactions FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE POLICY "transaction_subitems_select_own" ON public.transaction_subitems FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.transactions t WHERE t.id = transaction_id AND t.user_id = auth.uid())
);
CREATE POLICY "transaction_subitems_insert_own" ON public.transaction_subitems FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.transactions t WHERE t.id = transaction_id AND t.user_id = auth.uid())
);
CREATE POLICY "transaction_subitems_update_own" ON public.transaction_subitems FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.transactions t WHERE t.id = transaction_id AND t.user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.transactions t WHERE t.id = transaction_id AND t.user_id = auth.uid()));
CREATE POLICY "transaction_subitems_delete_own" ON public.transaction_subitems FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.transactions t WHERE t.id = transaction_id AND t.user_id = auth.uid())
);

CREATE FUNCTION public.create_suggested_categories_and_items()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  changed_categories integer := 0;
  changed_items integer := 0;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Autenticação obrigatória';
  END IF;

  INSERT INTO public.categories (user_id, name, icon, color, type)
  VALUES
    (current_user_id, 'Alimentação', '🍽️', '#ef4444', 'expense'),
    (current_user_id, 'Transporte', '🚗', '#f97316', 'expense'),
    (current_user_id, 'Moradia', '🏠', '#eab308', 'expense'),
    (current_user_id, 'Saúde', '💊', '#22c55e', 'expense'),
    (current_user_id, 'Lazer', '🎮', '#8b5cf6', 'expense'),
    (current_user_id, 'Salário', '💰', '#10b981', 'income'),
    (current_user_id, 'Outras receitas', '📈', '#0ea5e9', 'income')
  ON CONFLICT (user_id, name, type) DO UPDATE
    SET active = true, deleted_at = null, updated_at = now();
  GET DIAGNOSTICS changed_categories = ROW_COUNT;

  INSERT INTO public.items (user_id, category_id, name, icon, color)
  SELECT current_user_id, c.id, suggested.name, suggested.icon, suggested.color
  FROM (VALUES
    ('Alimentação', 'Mercado', '🛒', '#dc2626'),
    ('Alimentação', 'Restaurante', '🍽️', '#ef4444'),
    ('Alimentação', 'Delivery', '🛵', '#f43f5e'),
    ('Transporte', 'Combustível', '⛽', '#ea580c'),
    ('Transporte', 'Aplicativos', '🚕', '#f97316'),
    ('Transporte', 'Transporte público', '🚌', '#fb923c'),
    ('Moradia', 'Aluguel', '🔑', '#ca8a04'),
    ('Moradia', 'Energia', '💡', '#eab308'),
    ('Moradia', 'Internet', '📶', '#facc15'),
    ('Saúde', 'Farmácia', '💊', '#16a34a'),
    ('Saúde', 'Consultas', '🩺', '#22c55e'),
    ('Lazer', 'Passeios', '🎟️', '#7c3aed'),
    ('Lazer', 'Assinaturas', '📺', '#8b5cf6')
  ) AS suggested(category_name, name, icon, color)
  JOIN public.categories c
    ON c.user_id = current_user_id
   AND c.name = suggested.category_name
   AND c.type = 'expense'
  ON CONFLICT (user_id, category_id, name) DO UPDATE
    SET active = true, deleted_at = null, updated_at = now();
  GET DIAGNOSTICS changed_items = ROW_COUNT;

  RETURN jsonb_build_object('categories', changed_categories, 'items', changed_items);
END;
$$;
REVOKE ALL ON FUNCTION public.create_suggested_categories_and_items() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_suggested_categories_and_items() TO authenticated;