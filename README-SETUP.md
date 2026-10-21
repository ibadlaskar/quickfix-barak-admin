# QuickFix Barak Admin Panel: Stage 1

Technician onboarding, verification and account control, with a secure admin login and a live dashboard.

## What you need (all free to start)
1. A **Supabase** account (supabase.com) for the PostgreSQL database.
2. A **Netlify** account.

## Step 1: Create the database
1. In Supabase, create a project and note the **database password** you set.
2. Click **Connect** at the top of the project, choose **Transaction pooler**, and copy the connection string. It looks like `postgresql://postgres.PROJECTREF:[YOUR-PASSWORD]@aws-0-REGION.pooler.supabase.com:6543/postgres`.
3. Replace `[YOUR-PASSWORD]` with your real password. If it contains symbols such as `@ # / :`, URL-encode them (for example `@` becomes `%40`), or reset it to letters and numbers only.
4. Use the **pooler** string, not the "Direct connection" one. The direct one needs IPv6 and fails from Netlify.
5. You do not need to touch Supabase's Table Editor or its API keys. This project creates its own tables and never exposes them through Supabase's public API.

## Step 2: Deploy to Netlify
1. In Netlify choose **Add new site > Deploy manually** and drag in this ZIP (or the unzipped folder).
2. Open **Site configuration > Environment variables** and add three variables:
   - `DATABASE_URL`  = your Supabase pooler connection string
   - `SESSION_SECRET` = any random text, at least 32 characters
   - `SETUP_TOKEN`    = a private password you choose, at least 12 characters
3. **Deploy again** (Deploys > Trigger deploy, or drag the ZIP again) so the variables take effect.

## Step 3: One-time setup
1. Open `https://YOUR-SITE.netlify.app/setup.html`.
2. Enter your setup token and press **Create tables**.
3. Create the **owner account** (your name, email, password of 10+ characters).
4. In Netlify, **delete the SETUP_TOKEN variable** and redeploy. Setup is now closed for good.
5. Sign in at `https://YOUR-SITE.netlify.app/`.

There is no public admin registration. Only the one-time setup can create the first owner.

## Using it
- **Technicians > Add technician**: fill the sections, review, create. The server assigns the permanent ID (QFB-TECH-0001, 0002...). IDs are never reused.
- Open a profile to verify, reject, activate, deactivate, suspend or reinstate. Reasons are required for sensitive changes and every action goes in the audit log.
- A technician can only be activated when they are **Verified**, have an **accepted agreement** and at least one **approved service**.

## If the API does not work after a drag-and-drop deploy
Drag-and-drop deploys can be fussy about functions. The reliable alternative: put this folder in a GitHub repository, connect it in Netlify (Add new site > Import from Git). The build command and settings are already in `netlify.toml`.

## Security notes
- Passwords are hashed (scrypt). Sessions are signed, HttpOnly, Secure, SameSite=Strict cookies that last 8 hours.
- Five wrong passwords lock the account for 15 minutes.
- The browser never sees database credentials. All database access happens in the server function.
- Payments, payment adjustments and the audit log cannot be edited or deleted (enforced by the database).

## Stage 2 (next)
Bookings and assignment, cash collection and commission ledger, settlement verification, reports with CSV export, service category and price management, private document storage, and technician app access.

## Rebuilding the function (only if you change src/)
`npm install` then `npm run build`.
