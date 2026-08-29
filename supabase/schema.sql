-- YASH ASSOCIATES cloud schema
-- Run in Supabase SQL Editor after creating the project.
-- This schema is intentionally separate from the local Dexie database.

create extension if not exists pgcrypto;

create table if not exists public.parties (
  id text primary key,
  name text not null,
  mobile text not null default '',
  address text not null default '',
  city text not null default '',
  opening_balance numeric(14,2) not null default 0,
  credit_limit numeric(14,2) not null default 0,
  notes text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.products (
  id text primary key,
  code text not null,
  category text not null,
  brand text not null,
  design text not null default '',
  size text not null default '',
  color text not null default '',
  unit text not null default 'Piece',
  purchase_rate numeric(14,2) not null default 0,
  wholesale_rate numeric(14,2) not null default 0,
  mrp numeric(14,2) not null default 0,
  opening_stock numeric(14,3) not null default 0,
  min_stock numeric(14,3) not null default 0,
  description text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.suppliers (
  id text primary key,
  name text not null,
  mobile text not null default '',
  address text not null default '',
  city text not null default '',
  gst_number text not null default '',
  opening_balance numeric(14,2) not null default 0,
  credit_terms text not null default '',
  notes text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.categories (
  id text primary key,
  name text not null,
  type text not null check (type in ('product', 'expense')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (name, type)
);

create table if not exists public.brands (
  id text primary key,
  name text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.invoices (
  id text primary key,
  invoice_no text not null unique,
  date timestamptz not null,
  party_id text not null references public.parties(id),
  party_name text not null,
  subtotal numeric(14,2) not null default 0,
  discount_amount numeric(14,2) not null default 0,
  bill_discount_rate numeric(8,3),
  extra_discount_amount numeric(14,2) not null default 0,
  tax_amount numeric(14,2) not null default 0,
  round_off numeric(14,2) not null default 0,
  grand_total numeric(14,2) not null default 0,
  payment_received numeric(14,2) not null default 0,
  outstanding numeric(14,2) not null default 0,
  status text not null check (status in ('Paid', 'Partial', 'Due')),
  notes text not null default '',
  salesperson text,
  payment_mode text not null default '',
  payment_ref text not null default '',
  cancelled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.invoice_items (
  id text primary key,
  invoice_id text not null references public.invoices(id) on delete cascade,
  product_id text not null references public.products(id),
  product_code text not null,
  product_desc text not null,
  category text not null,
  brand text not null,
  size text not null default '',
  color text not null default '',
  unit text not null default 'Piece',
  qty numeric(14,3) not null check (qty > 0),
  rate numeric(14,2) not null default 0,
  discount numeric(14,2) not null default 0,
  discount_rate numeric(8,3),
  amount numeric(14,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payments (
  id text primary key,
  receipt_no text not null unique,
  date timestamptz not null,
  party_id text not null references public.parties(id),
  party_name text not null,
  amount numeric(14,2) not null check (amount > 0),
  mode text not null default 'Cash',
  reference text not null default '',
  notes text not null default '',
  invoice_id text references public.invoices(id),
  invoice_no text,
  is_advance boolean not null default false,
  cancelled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payment_allocations (
  id text primary key,
  payment_id text not null references public.payments(id) on delete cascade,
  invoice_id text not null references public.invoices(id),
  invoice_no text not null,
  amount numeric(14,2) not null check (amount > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.purchases (
  id text primary key,
  bill_no text not null unique,
  date timestamptz not null,
  supplier_id text not null references public.suppliers(id),
  supplier_name text not null,
  subtotal numeric(14,2) not null default 0,
  discount_amount numeric(14,2) not null default 0,
  bill_discount_rate numeric(8,3),
  tax_amount numeric(14,2) not null default 0,
  round_off numeric(14,2) not null default 0,
  grand_total numeric(14,2) not null default 0,
  payment_made numeric(14,2) not null default 0,
  outstanding numeric(14,2) not null default 0,
  status text not null check (status in ('Paid', 'Partial', 'Due')),
  notes text not null default '',
  supplier_invoice_no text,
  supplier_invoice_date timestamptz,
  purchase_type text,
  purchase_from text,
  payment_terms text,
  due_date timestamptz,
  payment_mode text not null default '',
  payment_ref text not null default '',
  cancelled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.purchase_items (
  id text primary key,
  purchase_id text not null references public.purchases(id) on delete cascade,
  product_id text not null references public.products(id),
  product_code text not null,
  product_desc text not null,
  category text not null,
  brand text not null,
  size text not null default '',
  color text not null default '',
  unit text not null default 'Piece',
  qty numeric(14,3) not null check (qty > 0),
  rate numeric(14,2) not null default 0,
  mrp numeric(14,2) not null default 0,
  purchase_rate numeric(14,2) not null default 0,
  sale_rate numeric(14,2) not null default 0,
  discount numeric(14,2) not null default 0,
  discount_rate numeric(8,3),
  extra_discount_rate numeric(8,3),
  extra_discount numeric(14,2),
  gst_rate numeric(8,3),
  gst_amount numeric(14,2),
  amount numeric(14,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.supplier_payments (
  id text primary key,
  receipt_no text not null unique,
  date timestamptz not null,
  supplier_id text not null references public.suppliers(id),
  supplier_name text not null,
  amount numeric(14,2) not null check (amount > 0),
  mode text not null default 'Cash',
  reference text not null default '',
  notes text not null default '',
  purchase_id text references public.purchases(id),
  purchase_no text,
  cancelled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.returns (
  id text primary key,
  return_no text not null unique,
  date timestamptz not null,
  type text not null check (type in ('SalesReturn', 'PurchaseReturn')),
  ref_invoice_id text references public.invoices(id),
  ref_invoice_no text,
  ref_purchase_id text references public.purchases(id),
  ref_purchase_no text,
  party_id text references public.parties(id),
  party_name text not null default '',
  supplier_id text references public.suppliers(id),
  supplier_name text not null default '',
  amount numeric(14,2) not null default 0,
  reason text not null default '',
  notes text not null default '',
  cancelled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.return_items (
  id text primary key,
  return_id text not null references public.returns(id) on delete cascade,
  product_id text not null references public.products(id),
  product_code text not null,
  product_desc text not null,
  qty numeric(14,3) not null check (qty > 0),
  rate numeric(14,2) not null default 0,
  amount numeric(14,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.stock_movements (
  id text primary key,
  date timestamptz not null,
  product_id text not null references public.products(id),
  product_code text not null,
  product_desc text not null,
  type text not null check (type in ('OpeningStock', 'Purchase', 'Sale', 'SalesReturn', 'PurchaseReturn', 'Damage', 'ManualAdjustment', 'Correction')),
  qty_in numeric(14,3) not null default 0,
  qty_out numeric(14,3) not null default 0,
  balance numeric(14,3) not null default 0,
  reference text not null default '',
  ref_id text,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.expenses (
  id text primary key,
  expense_no text not null unique,
  date timestamptz not null,
  category text not null,
  amount numeric(14,2) not null check (amount > 0),
  mode text not null default 'Cash',
  description text not null default '',
  notes text not null default '',
  cancelled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.settings (
  id text primary key,
  key text not null unique,
  value jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id text primary key,
  action text not null,
  entity text not null,
  entity_id text not null,
  description text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists invoices_party_date_idx on public.invoices (party_id, date desc);
create index if not exists invoice_items_invoice_idx on public.invoice_items (invoice_id);
create index if not exists payments_party_date_idx on public.payments (party_id, date desc);
create index if not exists purchases_supplier_date_idx on public.purchases (supplier_id, date desc);
create index if not exists stock_movements_product_date_idx on public.stock_movements (product_id, date desc);
create index if not exists audit_logs_created_idx on public.audit_logs (created_at desc);

-- The current application has no authentication. Keep cloud tables private until
-- authenticated users and tenant/business ownership columns are implemented.
alter table public.parties enable row level security;
alter table public.products enable row level security;
alter table public.suppliers enable row level security;
alter table public.categories enable row level security;
alter table public.brands enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;
alter table public.payments enable row level security;
alter table public.payment_allocations enable row level security;
alter table public.purchases enable row level security;
alter table public.purchase_items enable row level security;
alter table public.supplier_payments enable row level security;
alter table public.returns enable row level security;
alter table public.return_items enable row level security;
alter table public.stock_movements enable row level security;
alter table public.expenses enable row level security;
alter table public.settings enable row level security;
alter table public.audit_logs enable row level security;

-- Ownership migration for authenticated cloud sync. Run this block after the
-- base schema if the tables already exist in your project.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'parties', 'products', 'suppliers', 'categories', 'brands', 'invoices',
    'invoice_items', 'payments', 'payment_allocations', 'purchases',
    'purchase_items', 'supplier_payments', 'returns', 'return_items',
    'stock_movements', 'expenses', 'settings', 'audit_logs'
  ] loop
    execute format('alter table public.%I add column if not exists owner_id uuid references auth.users(id) default auth.uid()', table_name);
    execute format('alter table public.%I alter column owner_id set default auth.uid()', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_owner_select', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_owner_insert', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_owner_update', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_owner_delete', table_name);
    execute format('create policy %I on public.%I for select to authenticated using (owner_id = auth.uid())', table_name || '_owner_select', table_name);
    execute format('create policy %I on public.%I for insert to authenticated with check (owner_id = auth.uid())', table_name || '_owner_insert', table_name);
    execute format('create policy %I on public.%I for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid())', table_name || '_owner_update', table_name);
    execute format('create policy %I on public.%I for delete to authenticated using (owner_id = auth.uid())', table_name || '_owner_delete', table_name);
  end loop;
end $$;

-- Existing rows created before authentication have a NULL owner and cannot be
-- updated through RLS. Run this once after replacing the UUID with the account
-- that should own the existing business data.
-- do $$
-- declare
--   legacy_owner_id uuid := 'YOUR_AUTH_USER_UUID';
--   table_name text;
-- begin
--   foreach table_name in array array[
--     'parties', 'products', 'suppliers', 'categories', 'brands', 'invoices',
--     'invoice_items', 'payments', 'payment_allocations', 'purchases',
--     'purchase_items', 'supplier_payments', 'returns', 'return_items',
--     'stock_movements', 'expenses', 'settings', 'audit_logs'
--   ] loop
--     execute format('update public.%I set owner_id = $1 where owner_id is null', table_name)
--       using legacy_owner_id;
--   end loop;
-- end $$;
