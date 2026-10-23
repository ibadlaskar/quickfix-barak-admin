# QuickFix Barak Admin Panel: Stage 3

Stage 3 adds quotes, cash collection and commission, settlements, reports with CSV export, and an Analytics tab.

## UPGRADING from Stage 2
1. In Netlify open your site, then **Deploys**, and drag in this folder as a new deploy. Keep your 3 environment variables. You do NOT need SETUP_TOKEN.
2. Sign in. The first request upgrades the database by itself and keeps all your data.

## NEW INSTALL
Supabase pooler connection string, Netlify variables (DATABASE_URL, SESSION_SECRET, SETUP_TOKEN), open /setup.html, create tables, create the owner, then delete SETUP_TOKEN.

## How money works
1. **Quote.** On a booking, create a quote (labour, parts, travel, other). Mark it accepted or rejected by the customer before repair starts. Revising replaces the old one and needs fresh approval.
2. **Payment.** After work starts, the technician records what the customer paid in their portal (or you record it on the booking). Fields: labour, parts, discount, total collected, method. A receipt number (QFR-YYMM-00001) is created.
3. **Commission** is worked out from the technician's agreement:
   - *Labour only*: rate % of (labour minus discount).
   - *Labour and parts*: rate % of (labour plus parts minus discount).
   - *Fixed per job*: the rate field is a rupee amount.
   - *Custom rule*: the office enters the commission on the payment.
   You can override the commission when you record a payment yourself.
4. **Ledger.** Every commission, refund reversal and adjustment is a ledger line. Payments and refunds are never edited. Corrections are new lines.
5. **Refunds** (admin only, reason required) reduce the technician's commission in the same proportion.
6. **Settlement.** On a technician's profile or the Settlements page, press **Create settlement** to bundle all unsettled commission. The technician pays you by UPI, bank or cash and presses **I have sent the money** in the portal with the reference. Nothing closes until **you** press **Confirm money received** after seeing it in your account. Part payments are fine; the balance stays outstanding.
7. A technician can never verify their own settlement.

## Analytics tab
Pick Today, 7 / 30 / 90 days, this or last month, this year, or any dates. You get: orders received, completed, cancelled and open; completion rate; cash collected net of refunds; QuickFix commission; technician earnings; average order value; money owed by technicians; ratings and complaints; new and repeat customers; time to assign and complete; orders and money over time; orders by status, service, area, source and weekday; order funnel; technician leaderboard; and cash health.

## Reports (Reports page, with CSV download)
Cash collections, commission earned, outstanding settlements, settlements received, refunds and adjustments, technician performance and jobs completed, technician onboarding and verification, customer complaints, service category performance. Every CSV download is recorded in the activity log. CSVs can contain personal details: keep them private.

## Earlier stages (still included)
Bookings and matching, technician portal at /tech.html, technician onboarding and verification, service categories, audit log.

## Notes
- Times are shown in Indian Standard Time.
- If the API does not work after a drag-and-drop deploy, put the folder in GitHub and import it in Netlify.
- Rebuilding the function (only if you edit src/): `npm install` then `npm run build`.
