# EduLife

Ingliz tili test platformasi — admin panel, o‘quvchilar, testlar va natijalar.

## Vercel ga deploy

**Qo‘llanma:** [DEPLOY-VERCEL-UZ.md](./DEPLOY-VERCEL-UZ.md)

1. Supabase: `supabase-setup.sql`, `supabase-security-migration.sql`
2. Vercel: `vercel.env.example` → Import .env
3. **Redeploy** → `/api/health`, `/login.html`

Lokal: `.env.example` → `.env`, `npm run build`, `npx serve .`

Batafsil: [SETUP-UZ.md](./SETUP-UZ.md)
