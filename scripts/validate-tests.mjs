import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function globHtml() {
  const files = fs.readdirSync(root).filter((f) => f.endsWith('.html'));
  return files.filter(
    (f) =>
      f.includes('pre-intermediate') ||
      f.includes('elementary') ||
      /^unit\d+-/.test(f)
  );
}

function extractAnswerKey(html) {
  const m = html.match(/(?:const answerKey|const key)\s*=\s*(\{[\s\S]*?\});/);
  if (!m) return null;
  try {
    return Function(`return ${m[1]}`)();
  } catch {
    return null;
  }
}

function getFieldNames(html) {
  const names = new Set();
  for (const m of html.matchAll(/\bname="([^"]+)"/g)) {
    if (!m[1].startsWith('reg') && m[1] !== 'writing') names.add(m[1]);
  }
  return names;
}

function getNameInputKinds(html, name) {
  const re = new RegExp(`<input[^>]+name="${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*>`, 'gi');
  const kinds = new Set();
  for (const m of html.matchAll(re)) {
    const type = (m[0].match(/\btype="([^"]+)"/i) || [])[1] || 'text';
    kinds.add(type.toLowerCase());
  }
  return kinds;
}

function hasCustomCheckboxGrading(html, name) {
  return (
    /^p\d+$/.test(name) &&
    getNameInputKinds(html, name).size === 1 &&
    getNameInputKinds(html, name).has('checkbox') &&
    /getAll\(['"]/.test(html)
  );
}

function isLetterMatchSelect(html) {
  return (
    /<select[^>]+class="answer-input"[^>]*>[\s\S]*?option value="[a-k]">[A-K]\. [^<]+<\/select>/i.test(html) ||
    /<div class="match-options">[\s\S]*?<strong>[A-K]<\/strong>/i.test(html)
  );
}

function validateFile(file) {
  const html = fs.readFileSync(path.join(root, file), 'utf8');
  const issues = [];
  const key = extractAnswerKey(html);

  if (/— question \d+/i.test(html)) {
    const n = (html.match(/— question \d+/gi) || []).length;
    issues.push({ sev: 'critical', type: 'placeholder', msg: `${n} ta "— question" placeholder` });
  }

  const redundantSlash = (
    html.match(/<p>\d+\. [^<]*\/[^<]*<\/p>\s*<div class="radio-group">/g) || []
  ).length;
  if (redundantSlash) {
    issues.push({
      sev: 'high',
      type: 'redundant-options',
      msg: `${redundantSlash} ta savolda variantlar prompt ichida ham, radio tugmalarida ham`,
    });
  }

  const truncatedInstr = (
    html.match(/<h3>[^<]*(?:Tick the correct|using the present|Match the conversations?)\.<\/h3>/gi) || []
  ).length;
  if (truncatedInstr) {
    issues.push({
      sev: 'high',
      type: 'truncated-instruction',
      msg: `${truncatedInstr} ta to'liq bo'lmagan ko'rsatma (h3)`,
    });
  }

  const wordBankInPrompt = (html.match(/<p>\d+\. [^<]*\b[a-z]+ [a-z]+ [a-z]+\.<\/p>/g) || []).filter((m) =>
    /\b(buy go spend|do have take)\b/i.test(m)
  ).length;
  if (wordBankInPrompt) {
    issues.push({ sev: 'medium', type: 'word-bank-leak', msg: "So'z banki savol matniga aralashgan" });
  }

  if (!isLetterMatchSelect(html) && (/> A\. A</.test(html) || /value="A">A\. A/.test(html))) {
    const n = (html.match(/> A\. A</g) || []).length;
    issues.push({ sev: 'critical', type: 'reading-mc', msg: `${n} ta reading MC "A. A" xato` });
  }

  if (/questionnaire watch|show musician|chain checkout|chemist mosquito/.test(html)) {
    issues.push({ sev: 'high', type: 'corrupt-key', msg: "Buzilgan answerKey (ikki so'z birlashtirilgan)" });
  }

  if (key) {
    const fields = getFieldNames(html);
    const keyIds = new Set(Object.keys(key));
    for (const id of keyIds) {
      if (!fields.has(id)) {
        issues.push({ sev: 'high', type: 'orphan-key', msg: `answerKey "${id}" uchun input yo'q` });
      }
    }
    for (const id of fields) {
      if (!keyIds.has(id) && /^[gvp]\d/.test(id)) {
        if (hasCustomCheckboxGrading(html, id)) continue;
        issues.push({ sev: 'medium', type: 'missing-key', msg: `"${id}" uchun answerKey yo'q` });
      }
    }
  } else if (/submitTest/.test(html)) {
    issues.push({ sev: 'high', type: 'no-key', msg: 'answerKey topilmadi' });
  }

  const unitSections = html.match(/const unitSections = (\[[^\]]+\])/);
  if (unitSections) {
    const sections = JSON.parse(unitSections[1].replace(/'/g, '"'));
    for (const id of sections) {
      if (!html.includes(`id="${id}"`)) {
        issues.push({ sev: 'critical', type: 'nav', msg: `unitSections da "${id}" HTML da yo'q` });
      }
    }
    for (const m of html.matchAll(/id="(section-[^"]+)"/g)) {
      const id = m[1];
      if (id !== 'section-result' && !sections.includes(id)) {
        issues.push({ sev: 'medium', type: 'nav', msg: `"${id}" unitSections ro'yxatida yo'q` });
      }
    }
  }

  const dupNames = {};
  for (const m of html.matchAll(/\bname="([^"]+)"/g)) {
    dupNames[m[1]] = (dupNames[m[1]] || 0) + 1;
  }
  for (const [name, count] of Object.entries(dupNames)) {
    if (count <= 1) continue;
    const kinds = getNameInputKinds(html, name);
    if (kinds.size === 1 && kinds.has('radio') && count <= 6) continue;
    if (kinds.size === 1 && kinds.has('checkbox') && count <= 15) continue;
    if (/^r\d|^l\d|^p\d/.test(name) && count > 6) {
      issues.push({ sev: 'high', type: 'duplicate', msg: `"${name}" ${count} marta takrorlangan` });
    }
  }

  if (!html.includes('reading-passages') && !html.includes('reading-layout') && html.includes('section-reading')) {
    issues.push({ sev: 'medium', type: 'reading', msg: "Reading passage strukturasi yo'q" });
  }

  return issues;
}

const files = globHtml().sort();
let total = 0;
const summary = [];

for (const file of files) {
  const issues = validateFile(file);
  if (issues.length) {
    summary.push({ file, issues });
    total += issues.length;
  }
}

console.log(`\n=== Test tekshiruvi: ${files.length} fayl, ${summary.length} ta muammoli ===\n`);
for (const { file, issues } of summary) {
  console.log(`${file} (${issues.length})`);
  for (const i of issues) {
    console.log(`  [${i.sev}] ${i.type}: ${i.msg}`);
  }
}
console.log(`\nJami: ${total} muammo\n`);
process.exit(summary.length ? 1 : 0);
