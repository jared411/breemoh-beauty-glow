-- Bremoh Beauty Glow: run this whole file in Supabase > SQL Editor

create extension if not exists "pgcrypto";

-- Tables ---------------------------------------------------------------
create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  price numeric(10,2) not null default 0,
  duration_minutes int not null default 60,
  image_url text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  service_id uuid references public.services(id) on delete set null,
  customer_name text not null,
  phone text not null,
  email text,
  booking_date date not null,
  booking_time time not null,
  notes text,
  status text not null default 'pending'
    check (status in ('pending','confirmed','completed','cancelled')),
  created_at timestamptz not null default now()
);

create table if not exists public.gallery (
  id uuid primary key default gen_random_uuid(),
  image_url text not null,
  caption text,
  created_at timestamptz not null default now()
);

create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);

-- Helper ---------------------------------------------------------------
create or replace function public.is_admin()
returns boolean language sql security definer set search_path = public stable as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

-- Row Level Security ---------------------------------------------------
alter table public.services enable row level security;
alter table public.bookings enable row level security;
alter table public.gallery  enable row level security;
alter table public.admins   enable row level security;

-- Services: anyone reads active ones, admin manages all
create policy "public read active services" on public.services
  for select using (active = true or public.is_admin());
create policy "admin manage services" on public.services
  for all using (public.is_admin()) with check (public.is_admin());

-- Bookings: anyone can create (pending only), admin reads/updates/deletes
create policy "public create booking" on public.bookings
  for insert with check (status = 'pending');
create policy "admin read bookings" on public.bookings
  for select using (public.is_admin());
create policy "admin update bookings" on public.bookings
  for update using (public.is_admin()) with check (public.is_admin());
create policy "admin delete bookings" on public.bookings
  for delete using (public.is_admin());

-- Gallery: anyone reads, admin manages
create policy "public read gallery" on public.gallery
  for select using (true);
create policy "admin manage gallery" on public.gallery
  for all using (public.is_admin()) with check (public.is_admin());

-- Admins: a user can only see their own row
create policy "read own admin row" on public.admins
  for select using (user_id = auth.uid());

-- Storage bucket for images -------------------------------------------
insert into storage.buckets (id, name, public)
values ('beauty-images', 'beauty-images', true)
on conflict (id) do nothing;

create policy "public read images" on storage.objects
  for select using (bucket_id = 'beauty-images');
create policy "admin upload images" on storage.objects
  for insert with check (bucket_id = 'beauty-images' and public.is_admin());
create policy "admin update images" on storage.objects
  for update using (bucket_id = 'beauty-images' and public.is_admin());
create policy "admin delete images" on storage.objects
  for delete using (bucket_id = 'beauty-images' and public.is_admin());

-- Sample services (edit or delete later from the admin dashboard) -------
insert into public.services (name, description, price, duration_minutes) values
  ('Signature Glow Facial', 'Deep cleanse, exfoliation, massage and hydrating mask for radiant skin.', 3500, 60),
  ('Makeup Application', 'Full-face makeup for weddings, events and photoshoots.', 5000, 75),
  ('Manicure & Pedicure', 'Relaxing nail care with polish of your choice.', 2500, 90),
  ('Braids & Styling', 'Professional hair braiding and styling.', 4000, 180);

-- AFTER you create your admin account (Authentication > Users),
-- run this with your own email to make yourself the admin:
-- insert into public.admins (user_id)
--   select id from auth.users where email = 'YOUR_EMAIL_HERE';
