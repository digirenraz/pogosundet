# PoGoSundet — Initial Setup Guide

This guide walks you through the one-time setup required before running the app locally.

---

## 1. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and sign in (or create an account).
2. Click **New project**.
3. Choose your organisation, give the project a name (e.g. `pogosundet`), set a database password, and — **critical for GDPR** — select **Europe (Ireland) — eu-west-1** as the region.
4. Click **Create new project** and wait for it to spin up (~1 minute).

---

## 2. Copy your API keys

1. In your Supabase project dashboard, go to **Settings → API**.
2. Copy these three values:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **Project API keys → anon / public** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **Project API keys → service_role** → `SUPABASE_SERVICE_ROLE_KEY`
3. In the project root, copy `.env.local.example` to `.env.local` and paste in the values.

> ⚠️ Never commit `.env.local` to git. It is already in `.gitignore`.

---

## 3. Configure Supabase Auth settings

In your Supabase dashboard:

1. Go to **Authentication → Providers → Email**.
   - Enable the Email provider.
   - Turn **Confirm email** ON (required — users must verify their address before logging in).

2. Go to **Authentication → URL Configuration**.
   - **Site URL**: `http://localhost:3000` (change to your Vercel URL before going live).
   - **Redirect URLs**: add `http://localhost:3000/**` to allow all local redirects.

3. Translate the email templates to Danish (optional but recommended for Phase 1):
   - Go to **Authentication → Email Templates**.
   - Update the **Confirm signup** and **Reset password** templates with Danish text.

---

## 4. Set up Google OAuth

### 4a. Create a Google Cloud project

1. Go to [console.cloud.google.com](https://console.cloud.google.com).
2. Click the project dropdown (top left) → **New Project**.
3. Name it `PoGoSundet` and click **Create**.

### 4b. Configure the OAuth consent screen

1. In the left menu, go to **APIs & Services → OAuth consent screen**.
2. Select **External** and click **Create**.
3. Fill in:
   - App name: `PoGoSundet`
   - User support email: your email
   - Developer contact email: your email
4. Click **Save and Continue** through the remaining steps (no scopes needed beyond the defaults).

### 4c. Create OAuth credentials

1. Go to **APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID**.
2. Application type: **Web application**.
3. Name it anything (e.g. `PoGoSundet Web`).
4. Under **Authorised redirect URIs**, add:
   ```
   https://<your-project-ref>.supabase.co/auth/v1/callback
   ```
   (Replace `<your-project-ref>` with your Supabase project reference — visible in the Supabase URL.)
5. Click **Create** and copy the **Client ID** and **Client Secret**.

### 4d. Add credentials to Supabase

1. In your Supabase dashboard, go to **Authentication → Providers → Google**.
2. Toggle Google **Enabled**.
3. Paste in the **Client ID** and **Client Secret** from step 4c.
4. Click **Save**.

---

## 5. Run the app locally

```bash
npm install   # only needed once, or after pulling new changes
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## 6. Before deploying to Vercel

1. Add all three env vars (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) to your Vercel project settings under **Environment Variables**.
2. Update Supabase **Site URL** to your Vercel production URL.
3. Add the Vercel URL to **Redirect URLs** in Supabase Auth settings.
4. Add the Vercel URL to **Authorised redirect URIs** in Google Cloud Console.
