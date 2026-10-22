# QuickFix Barak Admin Panel: Stage 2

Adds bookings, technician matching and assignment, a technician portal, and the new service list on top of Stage 1.

## UPGRADING from Stage 1 (you already have it running)
1. In Netlify open your site, then **Deploys**, and drag in this unzipped folder (or the ZIP) as a new deploy. Keep your 3 environment variables as they are. You do NOT need SETUP_TOKEN again.
2. Open your admin site and sign in. The first request upgrades the database by itself, safely, without losing data:
   - adds the new columns and tables,
   - changes the service list to the 6 services below (old names are renamed or retired, never deleted, so existing technicians keep their skills where the service still exists).
3. Check **Service categories** in the sidebar. Check each technician's approved services (Edit profile), because retired services such as Refrigerator repair no longer appear.

## NEW INSTALL
Follow the Stage 1 steps: Supabase pooler connection string, Netlify variables (DATABASE_URL, SESSION_SECRET, SETUP_TOKEN), open /setup.html, create tables, create the owner. Then delete SETUP_TOKEN.

## Services now offered
1. Electrical Works, Estimating & Costing
2. Plumbing
3. Home Cleaning
4. Water Tank Cleaning
5. AC Servicing
6. Metal Fabrication, Estimating & Costing

You can add, rename, set an inspection fee for, reorder, or retire services in **Service categories**.

## Taking an order and assigning a technician
1. **Bookings, New booking**. Enter the customer's mobile first (returning customers fill in automatically), then name, address, area, service, preferred time and the problem.
2. Open the booking and press **Find technician**. You see only technicians who are **active, verified and approved for that service**, best match first: same area, then fewest open jobs, then rating. You can change the area, tick "Only this area", and see how many jobs each person already has that day.
3. Press **Assign**. To change technician later, press Reassign (a reason is required). Every step is recorded in the booking's activity log.
4. You can also reschedule (reason required), change status, or cancel (reason required).

## Technician portal
1. Open the technician's profile and press **Enable portal login**. A temporary password is shown ONCE. Send it with the **Send on WhatsApp** button.
2. The technician opens `https://YOUR-SITE/tech.html` and signs in with their **Technician ID or mobile number** plus the password. They must set their own password at first login.
3. They see only their own assigned jobs, with customer name, address, call, WhatsApp and map buttons, and move each job along: On my way, I have arrived, Start work, Mark job completed. You see these updates on the booking.
4. Only **active and verified** technicians can sign in. Suspending or deactivating a technician blocks the portal immediately. Use **Reset password** or **Revoke access** on the profile any time.
5. Five wrong passwords lock that technician for 15 minutes.

Why a password and not just a mobile number: a mobile number or ID is easy to guess, so on its own it would let anyone read customers' addresses and phone numbers. SMS one-time codes can be added later with a provider such as Firebase or MSG91.

## Not in this stage (Stage 3)
Cash collection and commission ledger, settlement verification, reports and CSV export, quotations, and customer reviews entry.

## If the API does not work after a drag-and-drop deploy
Put this folder in a GitHub repository and import it in Netlify (settings are in `netlify.toml`).

## Rebuilding the function (only if you change src/)
`npm install` then `npm run build`.
