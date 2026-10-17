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

## Test-mode flows
- **Payment:** landlord pays ₹299 per verification in a simulated checkout (UPI / card / net banking). No real money. The tenant link only works after payment. Replace `mock_pay` + `PayModal` with a real gateway (e.g. Razorpay) later.
- **PAN + DigiLocker:** tenant enters PAN and goes through a simulated DigiLocker sign-in. Only the last 4 Aadhaar digits are stored, never the full number.
- **Police verification:** collected as address + city; status is tracked as a check.
- **Admin panel (/admin):** make yourself admin once in the Supabase SQL editor:
      insert into public.admins (user_id) select id from auth.users where email = 'YOUR-EMAIL';
  Then open **Admin panel** from the dashboard to review tenants, open documents, and set each check to passed / failed / needs review.
- The database is already migrated in your Supabase project; `supabase/schema.sql` is only the original base schema.

## HR employment verification
After a tenant submits, the landlord (or admin) opens the request and uses **Employment verification by HR** to send a secure link
(`/hr/<token>`, valid 14 days) to the employer's HR email. HR confirms employment, designation, income, joining date and
employment type, then signs. The employment and income checks move to "needs review" for the admin to finalise.
Emails use the `send-hr-email` Edge Function (same Resend secrets as `send-tenant-email`); without them, copy the link or use the email-app button.

## Email setup (automatic emails)
Emails are sent by three Edge Functions: `send-tenant-email` (after the landlord pays), `notify-hr` (automatically after the tenant submits) and
`send-hr-email` (manual resend from the dashboard). Add these **secrets** in Supabase -> Edge Functions -> Secrets:
- `FROM_EMAIL`  plain sender address, e.g. `noreply@yourdomain.com`
- `FROM_NAME`   optional, default `GharTrust`
- `SITE_URL`    your live app URL, e.g. `https://ghartrust.vercel.app`
- ONE of: `RESEND_API_KEY` (needs a verified domain) or `BREVO_API_KEY` (can use a single verified sender address)

## Verification packages and pricing
Landlords choose a package when creating a request: **Basic** (PAN, Aadhaar via DigiLocker, face match), **Standard** (+ employment, income)
and **Complete** (+ police verification). Packages live in the `plans` table: change `price_paise` (₹199 = 19900), names or
included `checks` in Supabase -> Table Editor -> plans. The tenant flow only asks for the data the chosen package needs, only those checks are created,
and HR emails are sent only for packages that include employment.

## Rental agreement (all packages)
The landlord fills in the agreement details on the request page (Rental agreement card), previews it, and signs electronically. The tenant signs as the
last step of their link, after submitting verification. The text follows the standard residential rental agreement format (`src/agreement.js`).
Signed copies store a SHA-256 fingerprint and can be printed or saved as PDF. Tenants cannot sign before the landlord, and the landlord cannot edit after the tenant signs.
This is an electronic agreement for records. It is not stamped or registered. Check stamp duty and registration rules for your state with a lawyer.
