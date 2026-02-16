# Smart Bookmark App

Simple realtime bookmark manager built with Next.js App Router, Supabase (Auth + Database + Realtime), and Tailwind CSS.

## Features
- Google OAuth only (no email/password)
- Add + delete bookmarks (URL + title)
- Private data per user (RLS)
- Realtime updates across tabs

## Setup

### 1) Supabase project
Create a new Supabase project, then run this SQL in the SQL editor:

```sql
create table if not exists public.bookmarks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  url text not null,
  title text not null,
  created_at timestamptz not null default now()
);

alter table public.bookmarks enable row level security;

create policy "Bookmarks are viewable by owner"
  on public.bookmarks
  for select
  using (auth.uid() = user_id);

create policy "Bookmarks are insertable by owner"
  on public.bookmarks
  for insert
  with check (auth.uid() = user_id);

create policy "Bookmarks are deletable by owner"
  on public.bookmarks
  for delete
  using (auth.uid() = user_id);

-- Enable realtime for this table
alter publication supabase_realtime add table public.bookmarks;
```

### 2) Enable Google OAuth
In Supabase Auth settings:
- Enable Google provider
- Add an OAuth redirect URL for local dev: `http://localhost:3000/auth/callback`
- Add your production URL after deployment, e.g. `https://your-app.vercel.app/auth/callback`

### 3) Environment variables
Create `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=YOUR_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

## Local dev
Install deps and run:

```
npm install
npm run dev
```

## Deployment
Recommended: Vercel
- Import the repo
- Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Add the production redirect URL in Supabase Auth settings

## Issues & Fixes
- Google sign-in reused the last account after logout and didn’t show the account picker. Fixed by adding `queryParams: { prompt: "select_account" }` to the OAuth sign-in call so Google always prompts for account selection.
