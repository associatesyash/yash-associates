-- Run this once in Supabase SQL Editor after schema.sql.
-- It upgrades an existing YASH ASSOCIATES database for authenticated sync.

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
    execute format('alter table public.%I add column if not exists owner_id uuid references auth.users(id)', table_name);
    execute format('create index if not exists %I on public.%I (owner_id)', table_name || '_owner_idx', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_owner_select', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_owner_insert', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_owner_update', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_owner_delete', table_name);
    execute format('create policy %I on public.%I for select to authenticated using (owner_id = auth.uid())', table_name || '_owner_select', table_name);
    execute format('create policy %I on public.%I for insert to authenticated with check (owner_id = auth.uid())', table_name || '_owner_insert', table_name);
    execute format('create policy %I on public.%I for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid())', table_name || '_owner_update', table_name);
    execute format('create policy %I on public.%I for delete to authenticated using (owner_id = auth.uid())', table_name || '_owner_delete', table_name);
    execute format('alter table public.%I enable row level security', table_name);
  end loop;
end $$;

-- Product codes may repeat across size/color variants. The local app identifies
-- a variant by its full product attributes, not by code alone.
alter table public.products drop constraint if exists products_code_key;
drop index if exists public.products_code_key;
create index if not exists products_code_idx on public.products (code);

alter table public.purchase_items add column if not exists mrp numeric(14,2) not null default 0;
alter table public.purchase_items add column if not exists purchase_rate numeric(14,2) not null default 0;
alter table public.purchase_items add column if not exists sale_rate numeric(14,2) not null default 0;
