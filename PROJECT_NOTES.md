# Bremoh Beauty Glow: project notes

A running log of what has been built and set up. Never put passwords or secret keys here.

## Links
- Live site: https://jared411.github.io/breemoh-beauty-glow/
- Admin: https://jared411.github.io/breemoh-beauty-glow/admin.html
- Shop: https://jared411.github.io/breemoh-beauty-glow/shop.html
- Repo: https://github.com/jared411/breemoh-beauty-glow
- Supabase project: njknqytgefgmgjljlgwe (keys are in js/config.js)

## Contact details on the site
- Phone and WhatsApp: +254 740 494 230
- Email: breemohbeautyglow@gmail.com
- Currency: KES

## Admin login
- Current admin: bizyharmes@gmail.com (to be replaced)
- Planned new admin: breemohbeautyglow@gmail.com. Steps are in the chat (create user, add to `admins`, test, then remove the old admin row).

## What is built
- **Homepage (`index.html`):** the brand hero design as the banner with clickable logo, menu, WhatsApp and "Book your appointment" button. Services list, Our Work gallery (8 photos), booking form, contact section. Mobile bottom bar.
- **Shop (`shop.html`):** products, cart (saved on the device), checkout. Prices and stock are checked on the server.
- **Admin (`admin.html`):** sign in, then manage bookings (confirm, complete, cancel, delete), services (price, photo, visibility), products and orders, and gallery uploads.
- **Theme:** dark plum background, lilac buttons, gold details, taken from the banner.
- **Database:** Supabase tables for services, bookings, gallery, products, orders and admins, plus a photo storage bucket. Files are in `supabase/`.
- **Keep-alive:** GitHub Action (`.github/workflows/keepalive.yml`) pings Supabase every 3 days so the free project does not pause.

## Setup steps completed
1. Created the Supabase project and ran `supabase/schema.sql`, then `supabase/schema_v2.sql`.
2. Ran `supabase/seed_photos.sql` (photos linked to services, four new services added).
3. Granted the site permission to read services, products and gallery, and to place bookings. Admin has full access (SQL in chat).
4. Turned off public signups.
5. Turned on GitHub Pages (branch `main`, root folder).
6. Set the Supabase URL and publishable key in `js/config.js`.

## Not yet done
- Email and SMS alerts (Resend, Africa's Talking). Optional. Supabase Edge Function file is not in the repo any more, so it would need rebuilding.
- Replace the admin login with breemohbeautyglow@gmail.com and remove the old one.
- Confirm a test booking goes through.
- The About section (the banner menu links About to Contact).
- The Instagram icon on the banner is not linked (no handle yet).
- M-Pesa checkout (needs Safaricom Daraja account). Payment is currently by agreement with the customer.
- Real photos to replace the sample ones.
- Prices for the four new services were guesses. Confirm them in the admin.

## Things we already fixed
- The services page showed "Could not load services": fixed by granting table access in Supabase.
- The gallery now shows the photos directly, so it doesn't depend on the database.
- The first Cloudflare version was reverted, so the site runs on Supabase again.
