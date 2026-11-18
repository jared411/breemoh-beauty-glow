# Bremoh Beauty Glow Website

Appointment booking and online shop that runs entirely on **Cloudflare** (free plan, no database pausing, no card needed for what's used here) and deploys automatically from this GitHub repo.

## What's in here
- `public/`: the website (`index.html` booking site, `shop.html` shop, `admin.html` owner dashboard, `css`, `js`, `assets`)
- `functions/`: the backend (Cloudflare Pages Functions): bookings, orders, image storage, admin login, email/SMS alerts
- `d1/schema.sql`: database tables and sample data
- `public/js/config.js`: your public contact details and currency

## Setup (about 15 minutes, once)

### 1. Create the Cloudflare site
1. Sign up free at dash.cloudflare.com.
2. **Workers & Pages > Create > Pages > Connect to Git**, pick this repository.
3. Build settings: framework **None**, build command **empty**, build output directory **`public`**. Save and deploy.
4. Your site appears at `https://<project-name>.pages.dev`.

### 2. Create the database
1. **Storage & Databases > D1 > Create database**, name it `bremoh-db`.
2. Open the database's **Console** tab, paste all of `d1/schema.sql`, and run it.
   (If the console complains about running many statements at once, run the file with `npx wrangler d1 execute bremoh-db --remote --file=d1/schema.sql` instead.)

### 3. Connect the database and set the secrets
In your Pages project, open **Settings**:
1. **Bindings > Add > D1 database**: variable name must be exactly `DB`, choose `bremoh-db`.
2. **Variables and Secrets**: add these as **secrets**:
   - `ADMIN_PASSWORD`: the password you'll use to log in to the admin (make it long)
   - `SESSION_SECRET`: any random string of 32+ characters
3. Go to **Deployments** and redeploy the latest one so the settings take effect.
4. Open `https://<project-name>.pages.dev/admin.html` and log in.

### 4. Your details
Edit `public/js/config.js` (WhatsApp number, phone, email, currency) and commit. The site redeploys by itself.

### 5. Email and SMS alerts (optional)
You get an email and SMS for each new booking/order. Customers get a confirmation email (if they gave one) and an SMS when you confirm or cancel. Add any of these as secrets in the same place as above; whatever you skip is simply turned off:

| Secret | What it is |
| --- | --- |
| `OWNER_EMAIL` | where you receive alerts |
| `OWNER_PHONE` | your number for SMS alerts, e.g. `+254700000000` |
| `RESEND_API_KEY` | from resend.com (email) |
| `FROM_EMAIL` | e.g. `Bremoh Beauty Glow <hello@yourdomain.com>` (needs a domain verified in Resend) |
| `AT_USERNAME`, `AT_API_KEY` | from africastalking.com (SMS) |
| `AT_SENDER` | optional SMS sender name |

Until you verify a domain, Resend only delivers to your own address, so customer emails won't arrive yet.

## Day to day
- Manage bookings, services, products, orders and photos from `/admin.html`.
- Photos are shrunk in your browser and stored in the database, so use a few good photos rather than hundreds.
- Cancelling an order puts its stock back.
- Deleting or editing the website's files on GitHub redeploys the site automatically.

## Notes
- Payment is not online yet. You contact each customer to confirm payment and delivery. M-Pesa checkout can be added later.
- Security: admin login is a single owner password with a signed, HttpOnly session cookie; login attempts and public forms are rate limited; prices and stock are always calculated on the server.
- Cloudflare's free limits and dashboard labels can change. Check cloudflare.com/plans and the D1 pricing page if your shop grows.

## Moving away from Supabase
This version no longer uses Supabase. You can delete the Supabase project, and turn off GitHub Pages in this repo's settings if you enabled it.
