# EduLife — GitHub + Supabase to‘liq ulanish

**GitHub:** https://github.com/EduLife779744445/EduLife  
**Supabase loyiha:** Dashboard → Settings → General → **Reference ID** (GitHub ga yozmang)

---

## 1. Supabase bazasi (bir marta)

1. [supabase.com](https://supabase.com) → o‘z loyihangizni oching
2. **SQL Editor** → **New query**
3. `supabase-setup.sql` faylini butunlay nusxalab **Run**
4. **Table Editor** da ko‘ring: `student_accounts`, `submissions`, `test_settings`

---

## 2. Lokal kompyuter

`.env` fayli (loyiha ichida, GitHub ga ketmaydi):

```
SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
SUPABASE_ANON_KEY=your_anon_public_key
```

Har safar ishga tushirishdan oldin:

```powershell
cd C:\Users\theil\Desktop\EduLife-main
npm run config
npx serve .
```

Brauzer: `http://localhost:3000/login.html`

| Rol | Login | Parol |
|-----|-------|-------|
| Admin | Vercel `ADMIN_USERNAME` | Vercel `ADMIN_PASSWORD` |
| O‘quvchi | `students.html` dan qo‘shilgan | o‘qituvchi belgilagan |

Console (F12): `Supabase initialized successfully`

---

## 3. Vercel (internet sayti)

**To‘liq qadam-baqadam:** [DEPLOY-VERCEL-UZ.md](./DEPLOY-VERCEL-UZ.md)

Qisqa:

1. `vercel.env.example` → to‘ldiring → Vercel **Import .env**
2. Yoki qo‘lda: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `EDU_SESSION_SECRET`, `ADMIN_*`
3. **Redeploy** → `/api/health` da `"ok": true` bo‘lishi kerak

---

## Pre-intermediate testlar

Manba fayllar: `Desktop\English File\Pre-intermediate\Pre-intermediate - Tests` (faqat **A** variant).

HTML testlarni qayta yaratish:

```powershell
cd C:\Users\theil\Desktop\EduLife-main
npm run build:preint
```

Natija: `unit1-pre-intermediate.html` … `unit12-pre-intermediate.html`, progress 1–2, end test. Audio: `Listenings/pre-intermediate/`.

Supabase da yangi `test_settings` kalitlari uchun `supabase-setup.sql` dagi yangi qatorlarni SQL Editor da ishga tushiring.

---

## 4. Tekshirish

- [ ] Login ishlaydi
- [ ] `students.html` — o‘quvchi qo‘shiladi
- [ ] Test topshirish → Supabase `submissions` yangi qator
- [ ] `admin.html` — natijalar ko‘rinadi

---

## Jadvallar — nima uchun bo'sh / to'la?

| Jadval | Vazifasi | Nima bo'lishi kerak |
|--------|----------|---------------------|
| `student_accounts` | Login (username/parol) | O'quvchilar bor |
| `submissions` | Test natijalari | Test topshirgandan keyin qatorlar |
| `test_settings` | Test yoq/o'chir | Admin panel |
| `profiles` | Email Auth (ixtiyoriy) | **Bo'sh bo'lishi normal** — hozir ishlatilmaydi |
| `edulifeproject` | Kerak emas | O'chirib tashlashingiz mumkin |

**Schema Visualizer** dagi `auth.users.id` — Supabase tizim login jadvali. `profiles` shu bilan bog'lanadi; EduLife o'quvchilari `student_accounts` dan kiradi.

**Security Advisor** ogohlantirishlari (RLS always true) — hozirgi oddiy rejim; keyinroq qattiqroq qilish mumkin.

## Muammo

| Belgilar | Yechim |
|----------|--------|
| Login ishlaydi, submissions bo'sh | Vercel env + test topshirish; Console xato |
| Supabase ulanmagan | `npm run config`, `.env` tekshiring |
| Vercel da ishlamaydi | Environment Variables + Redeploy |
