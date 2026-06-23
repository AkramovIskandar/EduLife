# EduLife xavfsizlik qo'llanmasi

## Darhol bajarish kerak

### 1. Supabase migratsiyasi
SQL Editor da `supabase-security-migration.sql` ni ishga tushiring (mavjud loyiha uchun).

### 2. Vercel Environment Variables
| O'zgaruvchi | Izoh |
|-------------|------|
| `SUPABASE_URL` | Loyiha URL |
| `SUPABASE_ANON_KEY` | Faqat anon (public) kalit |
| `SUPABASE_SERVICE_ROLE_KEY` | **Maxfiy** — faqat server API |
| `EDU_SESSION_SECRET` | Kamida 32 belgi tasodifiy satr |
| `ADMIN_USERNAME` | Admin login |
| `ADMIN_PASSWORD` | Kuchli parol (admin123 ishlatmang) |

Keyin **Redeploy**.

### 3. Eski kalitlarni bekor qilish
Agar anon/service kalit GitHub ga tushgan bo'lsa: Supabase → Settings → API → **Rotate keys**.

## Nima tuzatildi

- `admin123` hardcoded bypass olib tashlandi
- Parollar `bcrypt` (pgcrypto) bilan xeshlanadi
- RLS: `student_accounts` va `submissions` o'qish anon uchun yopiq
- Admin/o'quvchi operatsiyalari `/api/*` orqali (service role)
- `test_key` formati: `unit_1` (SQL bilan mos)
- `tests.html` ga `auth.js` qo'shildi
- `DOMContentLoaded` bitta marta chaqiriladi

## Hali ochiq (keyingi bosqich)

**Test javoblari** hali brauzerda (`answerKey` obyektlari). To'liq himoya uchun serverda baholash API kerak (`/api/grade`).

**Anon kalit** frontendda qoladi — bu Supabase arxitekturasida normal; muhimi RLS va service role maxfiyligi.

## Lokal ishga tushirish

```bash
npm install
cp .env.example .env
# .env ni to'ldiring
npm run config
npx vercel dev
```

Oddiy `file://` yoki statik serverda login ishlamaydi — API route kerak.
