# Bremoh Beauty Glow Website

Appointment booking and online shop. Static frontend hosted free on **GitHub Pages**, backend on **Supabase** (database, admin login, image storage, email/SMS notifications).

## Files
- `index.html`: public site (services, gallery, booking form, contact)
- `shop.html`: product shop with cart and checkout
- `admin.html`: owner dashboard (bookings, services, gallery, products, orders)
- `js/config.js`: your Supabase keys and contact details
- `assets/logo.svg`, `assets/favicon.svg`: brand logo and browser icon (replace with your own if you have one)
- `supabase/schema.sql`: bookings, services, gallery, admins, security rules, storage
- `supabase/schema_v2.sql`: products and orders (run after `schema.sql`)
- `supabase/functions/notify/index.ts`: email + SMS notifications

## Setup

### 1. Supabase database
1. Create a project at supabase.com.
2. **SQL Editor**: run all of `supabase/schema.sql`, then all of `supabase/schema_v2.sql`.
3. **Authentication > Users > Add user**: create your admin email and password (tick "Auto confirm").
4. In the SQL Editor run (with your email):
   ```sql
   insert into public.admins (user_id)
   select id from auth.users where email = 'YOUR_EMAIL_HERE';
   ```
5. **Authentication > Providers > Email**: turn **off** "Allow new users to sign up".
6. **Project Settings > API**: copy the **Project URL** and **anon public** key.

### 2. Configure the site
Edit `js/config.js`: paste the URL and anon key, then set your WhatsApp number, phone and email.

### 3. GitHub Pages
1. Create a repository (e.g. `bremoh-beauty-glow`) and upload all files, keeping the folders.
2. **Settings > Pages**: deploy from branch `main`, folder `/ (root)`.
3. Live at `https://YOUR-USER.github.io/bremoh-beauty-glow/`. Admin is at `/admin.html`, shop at `/shop.html`.
4. In Supabase **Authentication > URL Configuration**, set Site URL to that address.

### 4. Email and SMS notifications (optional)
You get an email and SMS for every new booking or order. Customers get a confirmation email (if they gave one) and an SMS when you confirm or cancel a booking.

1. Accounts: **Resend** (resend.com, email) and **Africa's Talking** (africastalking.com, SMS). Either one is optional; skip the secrets for any you don't use.
2. Install the Supabase CLI, then from the project folder:
   ```bash
   supabase login
   supabase link --project-ref YOUR-PROJECT-ID
   supabase secrets set WEBHOOK_SECRET=make-up-a-long-random-string \
     OWNER_EMAIL=you@example.com OWNER_PHONE=+254700000000 \
     RESEND_API_KEY=... FROM_EMAIL="Bremoh Beauty Glow <hello@yourdomain.com>" \
     AT_USERNAME=... AT_API_KEY=... AT_SENDER=
   supabase functions deploy notify --no-verify-jwt
   ```
3. In Supabase **Database > Webhooks**, create two webhooks that call the function:
   - `bookings` table, events **Insert** and **Update**
   - `orders` table, events **Insert** and **Update**

   For each: type **Supabase Edge Functions**, function `notify`, and add the HTTP header `x-webhook-secret` with the same value as `WEBHOOK_SECRET`.
4. Resend only sends from `onboarding@resend.dev` to your own address until you verify a domain. Customer emails need a verified domain.

## Keeping Supabase from pausing (automatic)
Supabase free projects pause when idle. The file `.github/workflows/keepalive.yml` makes a tiny request to your project every 3 days, so you don't have to do anything. It reads the URL and anon key from `js/config.js`, so there is nothing extra to set up: fill in `config.js` and it works.
- Check it under the repo's **Actions** tab (you can also tap **Run workflow** to test it). A red failure means the project needs attention, and GitHub will email you.
- GitHub may switch scheduled jobs off after about 60 days with no repo activity. If so, open the Actions tab and re-enable it.
- It's a good idea to export your bookings and orders occasionally as a backup.

## Shop notes
- Prices and stock are checked on the server when an order is placed, so customers can't change prices from the browser.
- Payment is not online. You contact the customer to confirm payment (M-Pesa, cash on delivery, etc.) and delivery. Online M-Pesa checkout can be added later.

## Security notes
- The anon key is meant to be public. Row Level Security means visitors can only read services, products and gallery, create *pending* bookings, and place orders through the server function. Only the admin can read bookings and orders.
- Never put the `service_role` key in any file in this project.

## Customizing
- Colors: variables at the top of `css/style.css`.
- Currency: `CURRENCY` in `js/config.js`.
- Logo: replace `assets/logo.svg` and `assets/favicon.svg`.
- Services, products, prices and photos: manage from `admin.html`, no code needed.
