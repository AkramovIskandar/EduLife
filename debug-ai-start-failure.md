# Debug Session: ai-start-failure

Status: OPEN

## Symptom
- `Start Chat` bosilgandan keyin tugma kutilganidek yo'qolmaydi yoki AI darhol ishlamaydi.

## Falsifiable Hypotheses
- H1: `startCheck()` umuman chaqirilmayapti, chunki event binding yoki overlay DOM holatida muammo bor.
- H2: `startCheck()` chaqiriladi, lekin `requestAi()` backendga muvaffaqiyatli bora olmayapti.
- H3: Backend javob qaytaradi, lekin `speakText()` yoki `speechSynthesis` oqimi sabab AI ovozi chiqmayapti.
- H4: `sessionStarted` va `updateControls()` oqimi noto'g'ri ishlayotgani uchun `Start Chat` tugmasi yashirilmayapti.

## Plan
- Frontend instrumentatsiya qo'shish
- Runtime loglarni yig'ish
- Dalilga asoslanib root cause ni aniqlash
- Minimal fix qilish
- Qayta tekshirish

## Evidence
- `http://localhost:3000/api/health` server ishga tushishidan oldin ulanmagan.
- `http://localhost:3001/api/health` ulanmagan.
- `http://localhost:3002/api/health` ulanmagan.
- `level-check.js` dagi `startCheck()` oqimida `sessionStarted = true` faqat `requestAi()` muvaffaqiyatli tugagandan keyin berilgan.
- `node dev-server.mjs` ishga tushirilgandan keyin `POST /api/level-check` muvaffaqiyatli JSON javob qaytardi.

## Hypothesis Status
| ID | Hypothesis | Status | Evidence Summary |
|----|------------|--------|------------------|
| H1 | `startCheck()` chaqirilmayapti | Inconclusive | UI runtime logi hali foydalanuvchi klikidan yig'ilmadi |
| H2 | Backendga ulanish bo'lmayapti | Confirmed | 3000/3001/3002 portlarda server yo'q edi |
| H3 | TTS oqimi xato | Inconclusive | Backend tiklanmaguncha asosiy blok shu bosqichga yetmagan |
| H4 | `sessionStarted/updateControls` sabab tugma yashirilmayapti | Confirmed | Kodda tugma faqat API javobidan keyin yashirilgan |

## Root Cause
- Asosiy sabab 1: frontend kutayotgan lokal AI backend server ishlamayotgan edi.
- Asosiy sabab 2: `Start Chat` tugmasini yashirish vaqti noto'g'ri joyda bo'lgan, ya'ni start bosilganda emas, balki API muvaffaqiyatidan keyin.

## Fix Applied
- `level-check.js` ga instrumentatsiya qo'shildi.
- `startCheck()` ichida `sessionStarted = true` start bosilishi bilan darhol ishlaydigan qilindi.
- Lokal AI backend `node dev-server.mjs` orqali `localhost:3000` da ishga tushirildi.
