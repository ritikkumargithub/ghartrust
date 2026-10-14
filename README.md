# GharTrust MVP (React + Vite + Supabase)

## 1. Database
1. Create a Supabase project.
2. SQL Editor -> paste `supabase/schema.sql` -> Run.
3. Authentication -> Providers: Email on. For quick testing, turn off "Confirm email".
4. Project Settings -> API: copy the Project URL and anon/publishable key.

## 2. Run locally
    cp .env.example .env      # fill in the two values
    npm install
    npm run dev

## 3. Deploy on Vercel
1. Push this folder to a GitHub repo.
2. Vercel -> Add New Project -> import the repo (Framework: Vite).
3. Add environment variables VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.
4. Deploy. Then in Supabase -> Authentication -> URL Configuration, set Site URL to your Vercel URL.

## What works
Landlord sign-up/login, create request, WhatsApp/copy link, tenant consent + document upload (no login),
landlord report view with signed document links, consent withdrawal.

## Not included yet
Automated PAN / DigiLocker / face match / EPFO / bank-statement checks. After submission the five checks are created as
"pending". Update them in the Supabase table editor (table `checks`) for manual review, then later connect a
verification provider through Supabase Edge Functions. Payments, e-sign agreements and police verification are also not included.

## Emailing the tenant link
The Dashboard "Email" button calls the Supabase Edge Function `send-tenant-email` (Resend). Set these secrets in
Supabase -> Edge Functions -> Secrets: `RESEND_API_KEY`, `FROM_EMAIL` (e.g. `GharTrust <noreply@yourdomain.com>`),
and optionally `SITE_URL` (your Vercel URL). Without them the button falls back to opening your own email app.

## Demo flows (test mode)
- **Payment:** landlord pays ₹299 per verification in a simulated checkout (UPI / card / net banking). No real money. The tenant link only works after payment. Replace `mock_pay` + `PayModal` with a real gateway (e.g. Razorpay) later.
- **PAN + DigiLocker:** tenant enters PAN and goes through a simulated DigiLocker sign-in. Only the last 4 Aadhaar digits are stored, never the full number.
- **Police verification:** collected as address + city; status is tracked as a check.
- **Admin panel (/admin):** make yourself admin once in the Supabase SQL editor:
      insert into public.admins (user_id) select id from auth.users where email = 'YOUR-EMAIL';
  Then open **Admin panel** from the dashboard to review tenants, open documents, and set each check to passed / failed / needs review.
- The database is already migrated in your Supabase project; `supabase/schema.sql` is only the original base schema.
