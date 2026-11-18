-- Bremoh Beauty Glow v2: shop (products + orders). Run AFTER schema.sql.

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  price numeric(10,2) not null check (price >= 0),
  stock int not null default 0 check (stock >= 0),
  image_url text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null,
  phone text not null,
  email text,
  address text not null,
  items jsonb not null,
  total numeric(10,2) not null,
  status text not null default 'new'
    check (status in ('new','confirmed','delivered','cancelled')),
  created_at timestamptz not null default now()
);

alter table public.products enable row level security;
alter table public.orders   enable row level security;

create policy "public read active products" on public.products
  for select using (active = true or public.is_admin());
create policy "admin manage products" on public.products
  for all using (public.is_admin()) with check (public.is_admin());

-- Orders: no public insert policy. Customers place orders ONLY through
-- place_order() below, which calculates prices on the server.
create policy "admin read orders" on public.orders
  for select using (public.is_admin());
create policy "admin update orders" on public.orders
  for update using (public.is_admin()) with check (public.is_admin());
create policy "admin delete orders" on public.orders
  for delete using (public.is_admin());

create or replace function public.place_order(
  p_name text, p_phone text, p_email text, p_address text, p_items jsonb
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  it jsonb;
  prod public.products%rowtype;
  qty int;
  total numeric := 0;
  snapshot jsonb := '[]'::jsonb;
  new_id uuid;
begin
  if coalesce(length(trim(p_name)),0) < 2 or length(p_name) > 80
     or coalesce(length(trim(p_phone)),0) < 7 or length(p_phone) > 20
     or coalesce(length(trim(p_address)),0) < 3 or length(p_address) > 300 then
    raise exception 'Invalid customer details';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0
     or jsonb_array_length(p_items) > 30 then
    raise exception 'Cart is empty or too large';
  end if;

  for it in select * from jsonb_array_elements(p_items) loop
    qty := (it->>'qty')::int;
    if qty is null or qty < 1 or qty > 20 then raise exception 'Invalid quantity'; end if;
    select * into prod from public.products
      where id = (it->>'id')::uuid and active = true for update;
    if not found then raise exception 'Product unavailable'; end if;
    if prod.stock < qty then raise exception 'Not enough stock for %', prod.name; end if;
    update public.products set stock = stock - qty where id = prod.id;
    total := total + prod.price * qty;
    snapshot := snapshot || jsonb_build_object(
      'id', prod.id, 'name', prod.name, 'price', prod.price, 'qty', qty);
  end loop;

  insert into public.orders (customer_name, phone, email, address, items, total)
  values (trim(p_name), trim(p_phone), nullif(trim(coalesce(p_email,'')),''), trim(p_address), snapshot, total)
  returning id into new_id;

  return new_id;
end $$;

grant execute on function public.place_order(text,text,text,text,jsonb) to anon, authenticated;

insert into public.products (name, description, price, stock) values
  ('Glow Vitamin C Serum', 'Brightening serum for an even, radiant complexion.', 1800, 25),
  ('Shea Body Butter', 'Rich, nourishing body butter with natural shea.', 1200, 40),
  ('Hydrating Lip Gloss', 'Non-sticky shine with all-day moisture.', 650, 60);
