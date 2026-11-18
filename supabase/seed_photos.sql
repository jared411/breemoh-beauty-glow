-- Bremoh Beauty Glow: add photos to services and the gallery.
-- Run AFTER schema.sql and schema_v2.sql, and AFTER the photos are on GitHub
-- (the folder assets/photos). Safe to run more than once.

-- 1. Put photos on the services you already have
update public.services set image_url = 'assets/photos/glam-portrait.jpg'      where name = 'Signature Glow Facial';
update public.services set image_url = 'assets/photos/makeup-application.jpg' where name = 'Makeup Application';
update public.services set image_url = 'assets/photos/nails-manicure.jpg'     where name = 'Manicure & Pedicure';
update public.services set image_url = 'assets/photos/makeup-artist.jpg'      where name = 'Braids & Styling';

-- 2. New service categories (edit prices from the admin dashboard any time)
insert into public.services (name, description, price, duration_minutes, image_url)
select 'Bridal Makeup', 'Flawless, long-lasting makeup for your big day, including a trial on request.', 8000, 120, 'assets/photos/bridal-makeup.jpg'
where not exists (select 1 from public.services where name = 'Bridal Makeup');

insert into public.services (name, description, price, duration_minutes, image_url)
select 'Lash Extensions', 'Full, fluffy lashes that last, shaped to suit your eyes.', 3000, 90, 'assets/photos/lashes.jpg'
where not exists (select 1 from public.services where name = 'Lash Extensions');

insert into public.services (name, description, price, duration_minutes, image_url)
select 'Gel Nails & Nail Art', 'Gel and acrylic nails with custom colours, shapes and art.', 3500, 90, 'assets/photos/nail-art.jpg'
where not exists (select 1 from public.services where name = 'Gel Nails & Nail Art');

insert into public.services (name, description, price, duration_minutes, image_url)
select 'Luxury Pedicure', 'Soak, scrub, massage and polish for soft, pretty feet.', 2000, 60, 'assets/photos/pedicure.jpg'
where not exists (select 1 from public.services where name = 'Luxury Pedicure');

-- 3. Gallery
insert into public.gallery (image_url, caption)
select v.url, v.cap
from (values
  ('assets/photos/bridal-makeup.jpg',      'Bridal makeup'),
  ('assets/photos/nail-art.jpg',           'Gel nails and nail art'),
  ('assets/photos/makeup-application.jpg', 'Makeup in progress'),
  ('assets/photos/lashes.jpg',             'Lash extensions'),
  ('assets/photos/nails-manicure.jpg',     'Classic manicure'),
  ('assets/photos/pedicure.jpg',           'Luxury pedicure'),
  ('assets/photos/glam-portrait.jpg',      'Glam makeup and styling'),
  ('assets/photos/makeup-artist.jpg',      'Our makeup artist')
) as v(url, cap)
where not exists (select 1 from public.gallery g where g.image_url = v.url);
