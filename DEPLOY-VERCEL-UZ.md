# EduLife — Vercel ga oson deploy (5 daqiqa)

GitHub repozitoriyani Vercel ga ulang → env qo‘ying → **Redeploy**. Tayyor.

---

## 1-qadam: Supabase bazasi (bir marta)

1. [supabase.com/dashboard](https://supabase.com/dashboard) → loyihangiz
2. **SQL Editor** → **New query**
3. Ketma-ket ishga tushiring (har birini **Run**):
   - `supabase-setup.sql`
   - `supabase-security-migration.sql`

---

## 2-qadam: GitHub → Vercel

1. [vercel.com/new](https://vercel.com/new)
2. **Import** → GitHub repozitoriyangiz (`EduLife`)
3. Sozlamalar (o‘zgartirmasdan ham bo‘ladi):
   - **Framework Preset:** Other
   - **Build Command:** `npm run build`
   - **Output Directory:** `.` (nuqta)
4. Hali **Deploy** bosmang — avval 3-qadam (env).

---

## 3-qadam: Environment Variables (majburiy)

### Usul A — eng oson (Import .env)

1. Kompyuterda `vercel.env.example` ni nusxalang → `vercel.env` nomi bilan saqlang
2. Ichidagi barcha `YOUR_...` va `paste_...` ni Supabase kalitlari bilan almashtiring
3. Vercel → loyiha → **Settings** → **Environment Variables**
4. **Import .env** → `vercel.env` faylini tanlang
5. **Production**, **Preview**, **Development** — **uchalasini** belgilang → **Save**

### Usul B — qo‘lda (4 ta + admin)

Har bir qator: **Key** = nom, **Value** = qiymat (Key ga URL yozmang!)

| Key | Qayerdan |
|-----|----------|
| `SUPABASE_URL` | Supabase → Settings → General → **Project URL** |
| `SUPABASE_ANON_KEY` | Settings → API → **anon public** → Copy |
| `SUPABASE_SERVICE_ROLE_KEY` | API → **service_role** → Reveal → Copy |
| `GEMINI_API_KEY` | Google AI Studio / Gemini API key |
| `EDU_SESSION_SECRET` | O‘zingiz: kamida 32 belgi |
| `ADMIN_USERNAME` | Admin login |
| `ADMIN_PASSWORD` | Kuchli parol |
| `ADMIN_DISPLAY_NAME` | `EduLife Admin` |

---

## 4-qadam: Deploy

1. **Deployments** → **Redeploy**
2. Build Logs: `supabase-config.js yaratildi.`
3. Status: **Ready** → **Visit**

---

## 5-qadam: Tekshirish

| URL | Nima |
|-----|------|
| `/login.html` | Admin / o‘quvchi login |
| `/api/health` | `{"ok":true,...}` |
| `/api/speaking` | AI speaking endpoint, `GEMINI_API_KEY` bo'lsa ishlaydi |
| `/tests.html` | O‘quvchi testlar (login kerak) |

Agar frontend va backend turli domenlarda tursa, `api-config.js` ichida:
`window.EDU_API_BASE_URL = 'https://your-backend-domain.com';`
deb yozing.

---

## Tez-tez xatolar

| Muammo | Yechim |
|--------|--------|
| `SUPABASE_URL va SUPABASE_ANON_KEY kerak` | Env + **Redeploy** |
| Speaking AI ishlamayapti | `GEMINI_API_KEY` ni Vercel env ga qo'ying + **Redeploy** |
| `Gemini quota tugagan` yoki `billing` xatosi | Google AI Studio / Google Cloud da billing va quota ni yoqing yoki boshqa ishlaydigan `GEMINI_MODEL` belgilang |
| `invalid characters` (Key) | Key = `SUPABASE_URL`, Value = URL |
| Login 500 | `EDU_SESSION_SECRET` ≥ 32 belgi |
