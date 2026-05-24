# CAT Catalyst

Static CAT practice platform for shared dailies, VARC sectionals, QA sectionals, bookmarks, and review.

## Local Development

```bash
npm install
npm run dev
```

## Static Bank

The question bank is shipped as static files:

- `public/questions_db.json`
- `public/bank_assets/**`

Shared daily and weekly papers are deterministic from `seed + bank_version`, so they do not depend on profile history.

## Supabase Sync

Supabase is optional. Without env vars, the app remains local-only.

1. Create a Supabase project.
2. Run `supabase/schema.sql` in the Supabase SQL editor.
3. Add local env values:

```bash
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-public-anon-key
```

4. For GitHub Pages, set:

- Repository variable: `VITE_SUPABASE_URL`
- Repository secret: `VITE_SUPABASE_ANON_KEY`

Synced cloud state:

- profile display name
- user settings
- bookmarks
- submitted attempts and per-question answers
- completed daily sections

The bank itself stays static and is not stored in Supabase.
