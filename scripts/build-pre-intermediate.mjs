/**
 * Build Pre-intermediate HTML tests from English File source PDFs (variant A only).
 * Source: Desktop/English File/Pre-intermediate/Pre-intermediate - Tests
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PDFParse } from 'pdf-parse';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const SOURCE_ROOT =
  process.env.PREINT_SOURCE ||
  'C:\\Users\\theil\\Desktop\\English File\\Pre-intermediate\\Pre-intermediate - Tests';
const EXTRACTED = path.join(ROOT, 'Pre-intermediate', 'extracted');
const AUDIO_ROOT = path.join(ROOT, 'Listenings', 'pre-intermediate');

const PRIMARY = '#7C3AED';
const PRIMARY_DARK = '#6D28D9';
const PRIMARY_LIGHT = '#EDE9FE';

const pad2 = (n) => String(n).padStart(2, '0');

async function extractPdf(pdfPath, outPath) {
  if (fs.existsSync(outPath)) {
    const age = Date.now() - fs.statSync(outPath).mtimeMs;
    const srcAge = fs.statSync(pdfPath).mtimeMs;
    if (age > srcAge) return fs.readFileSync(outPath, 'utf8');
  }
  const buffer = fs.readFileSync(pdfPath);
  const parser = new PDFParse({ data: buffer });
  const result = await parser.getText();
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, result.text, 'utf8');
  return result.text;
}

function copyFile(src, dest) {
  if (!fs.existsSync(src)) {
    console.warn('Missing audio:', src);
    return;
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  if (!fs.existsSync(dest) || fs.statSync(src).mtimeMs > fs.statSync(dest).mtimeMs) {
    fs.copyFileSync(src, dest);
  }
}

function parseAkExercises(block) {
  const exercises = [];
  let current = null;
  for (const rawLine of block.split('\n')) {
    const line = rawLine.trim();
    if (!line || /^[A-Za-z]/.test(line)) continue;
    const m3 = line.match(/^(\d+)\s+(\d+)\s+(.+)$/);
    if (m3) {
      const exNum = Number(m3[1]);
      const itemNum = Number(m3[2]);
      const answer = m3[3].trim();
      if (!current || current.num !== exNum) {
        current = { num: exNum, items: [] };
        exercises.push(current);
      }
      current.items.push({ num: itemNum, answer });
      continue;
    }
    const m2 = line.match(/^(\d+)\s+(.+)$/);
    if (m2 && current) {
      const itemNum = Number(m2[1]);
      const answer = m2[2].trim();
      if (itemNum > 0 && itemNum <= 30 && answer.length > 0) {
        current.items.push({ num: itemNum, answer });
      }
    }
  }
  return exercises;
}

function parseAkSection(akText, startLabel, endLabels) {
  const startIdx = akText.indexOf(startLabel);
  if (startIdx === -1) return [];
  let endIdx = akText.length;
  for (const label of endLabels) {
    const i = akText.indexOf(label, startIdx + startLabel.length);
    if (i !== -1 && i < endIdx) endIdx = i;
  }
  return parseAkExercises(akText.slice(startIdx, endIdx));
}

function isLetterMatchAnswer(a, testSnippet = '') {
  return (
    /^[a-k]$/i.test(a) &&
    (/Match.*\ba[–-]k\b/i.test(testSnippet) ||
      /Match.*conversations/i.test(testSnippet) ||
      /Conversation\s+\d/i.test(testSnippet) ||
      (/Match.*\ba[–-][a-g]\b/i.test(testSnippet) &&
        (extractMatchOptions(testSnippet).length >= 3 || extractAkMatchOptions(testSnippet).length >= 3)))
  );
}

function inferType(answer, testSnippet = '') {
  const a = answer.trim();
  if ((a === 'H' || a === 'L') && !/Match/i.test(testSnippet)) return 'hl';
  if (isLetterMatchAnswer(a, testSnippet)) return 'match';
  if ((a === 'T' || a === 'F') && !/Match/i.test(testSnippet) && !/Conversation\s+\d/i.test(testSnippet)) {
    return 'tf';
  }
  if (
    /^[A-G]$/i.test(a) &&
    /Conversation\s+\d/i.test(testSnippet) &&
    extractMatchOptions(testSnippet).length >= 3
  ) {
    return 'match';
  }
  if (/^[A-C]$/i.test(a) && (hasDoesntSay(testSnippet) || /A True/i.test(testSnippet))) return 'tfds';
  if (/^[A-C]$/i.test(a) && testSnippet.includes('A ') && testSnippet.includes('B ')) return 'mc3';
  if (/^[A-G]$/i.test(a)) return 'match';
  if (/^[a-k]$/i.test(a) && /Match/i.test(testSnippet)) return 'match';
  if (/^\d+$/.test(a)) return 'stress';
  if (a.length > 40 || a.includes(' / ')) return 'text';
  return 'text';
}

function isPdfNoiseLine(text) {
  return (
    /^--\s*\d+\s+of\s+\d+\s+--/i.test(text) ||
    /^(?:Grammar|Vocabulary|Pronunciation|Reading|Listening|Writing|Speaking)\s+total\b/i.test(text) ||
    /^File Test\b/i.test(text) ||
    /Photocopiable/i.test(text) ||
    /^English File fifth edition/i.test(text)
  );
}

function getExerciseInstruction(testExText) {
  const lines = testExText.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    const m = t.match(/^\d+\s+(.+)$/);
    if (!m) continue;
    const rest = m[1].trim();
    if (!isExerciseHeaderLine(rest)) continue;
    let instruction = cleanPrompt(rest);
    let j = i + 1;
    while (j < lines.length) {
      const nt = lines[j].trim();
      if (!nt || /^\d+[\s\t]+/.test(nt) || /^Example:/i.test(nt)) break;
      if (isExerciseHeaderLine(nt) || isPdfNoiseLine(nt)) break;
      const incomplete =
        !/[.?!]$/.test(instruction) ||
        /\b(Tick the correct|using the present|Match the conversations?)$/i.test(instruction) ||
        /Listen to [^.]+Tick the correct$/i.test(instruction) ||
        (/^Listen to/i.test(instruction) && !/\b(Tick|Write|Match|Complete|Answer|Choose)\b/i.test(instruction));
      if (!incomplete) break;
      instruction = cleanPrompt(`${instruction} ${nt}`);
      j++;
    }
    return instruction;
  }
  return '';
}

function isWordBankLine(text) {
  const t = text.trim();
  if (!t || t.includes('/') || t.includes('?') || /_{2,}/.test(t)) return false;
  if (/[(),]/.test(t) || /\.\s*[a-z]/i.test(t)) return false;
  const words = t.split(/\s+/).filter(Boolean);
  if (words.length < 2 || words.length > 10) return false;
  if (words.some((w) => /^(the|a|an|to|for|on|in|at|with|about|from|by|across|along|of|tick|correct|word)$/i.test(w))) {
    return false;
  }
  return words.every((w) => /^[a-z'-]+$/i.test(w) && w.length <= 18);
}

function looksLikePhraseTail(text) {
  const t = text.trim();
  if (!t) return false;
  const words = t.split(/\s+/);
  return (
    words.length >= 2 ||
    /^(a|an|the|to|for|on|in|at|with|about|from|by|somebody|someone|something)\b/i.test(t) ||
    /\.$/.test(t)
  );
}

function parseVerbPhraseSlash(parts) {
  if (parts.length < 2) return null;
  const headOpts = parts.slice(0, -1);
  const lastPart = parts[parts.length - 1];
  const lastWords = lastPart.split(/\s+/);
  if (headOpts.some((p) => p.split(/\s+/).length > 3)) return null;

  let options = [...headOpts];
  let tail = '';
  if (lastWords.length > 1) {
    const avgLen =
      headOpts.reduce((sum, p) => sum + p.split(/\s+/).length, 0) / Math.max(headOpts.length, 1);
    const optWords = Math.max(1, Math.round(avgLen));
    const lastOpt = lastWords.slice(0, optWords).join(' ');
    const maybeTail = lastWords.slice(optWords).join(' ');
    if (maybeTail && looksLikePhraseTail(maybeTail)) {
      options.push(lastOpt);
      tail = maybeTail;
    } else {
      options.push(lastPart);
    }
  } else {
    options.push(lastPart);
  }

  options = options.map((o) => cleanPrompt(o)).filter((o) => o && o.length <= 25);
  if (options.length < 2) return null;
  if (options.some((o) => o.split(/\s+/).length > 4)) return null;

  const prompt = tail ? `________ ${tail}` : '________';
  return { prompt: cleanPrompt(prompt), options: options.slice(0, 3) };
}

function parseInlineSlashChoice(parts) {
  if (parts.length >= 3) {
    const last = parts[parts.length - 1];
    const nameVerb = parts[0].match(/^([A-Z][a-z]+)\s+(.+)$/);
    if (nameVerb && parts.length === 3 && looksLikePhraseTail(last)) {
      return {
        prompt: cleanPrompt(`${nameVerb[1]} ______ ${last}`),
        options: [nameVerb[2], parts[1]],
      };
    }
  }

  if (parts.length === 3 && /^[A-Z]/.test(parts[0]) && /[.?!]$/.test(parts[2])) {
    const inner = parseInlineSlashChoice([parts[0], `${parts[1]} ${parts[2]}`]);
    if (inner) {
      return {
        prompt: cleanPrompt(inner.prompt.replace(/\s*\.$/, '')),
        options: inner.options,
      };
    }
  }

  if (parts.length >= 3) {
    const last = parts[parts.length - 1];
    if (looksLikePhraseTail(last) && last.split(/\s+/).length >= 2) {
      const tail = last;
      const head = parts.slice(0, -1);
      const verbParsed = parseVerbPhraseSlash([...head, tail]);
      if (verbParsed) return verbParsed;
    }
  }

  if (parts.length === 2) {
    const [a, b] = parts;
    if (/^The /i.test(a) && /^[a-z]/.test(b)) {
      const shared = a.match(/^(The\s+.+\s+(?:have|has|are|is|was|were)\s+(?:a\s+)?\w+)\s+/i);
      if (shared) {
        const opt0 = a.slice(shared[1].length).trim();
        const opt1 = b
          .replace(/^have a similar\s+/i, '')
          .replace(/^has a similar\s+/i, '')
          .replace(/\.\s*$/, '')
          .trim();
        if (opt0 && opt1) {
          return {
            prompt: cleanPrompt(`${shared[1]} ______ .`),
            options: [opt0, opt1],
          };
        }
      }
      const subject = a.match(/^(The\s+(?:two\s+)?\w+(?:\s+\w+)?)\s+/i)?.[1] || a.split(/\s+/).slice(0, 3).join(' ');
      const opt0 = a.slice(subject.length).trim();
      const opt1 = b.replace(/\.\s*$/, '').trim();
      if (opt0 && opt1) {
        return {
          prompt: cleanPrompt(`${subject} ______ .`),
          options: [opt0, opt1],
        };
      }
    }
    const wordsA = a.split(/\s+/);
    const wordsB = b.split(/\s+/);
    let best = null;
    for (let suffixLen = 0; suffixLen <= wordsB.length; suffixLen++) {
      const suffix = wordsB.slice(wordsB.length - suffixLen).join(' ');
      const opt1 = wordsB.slice(0, wordsB.length - suffixLen).join(' ');
      for (let opt0Len = 1; opt0Len <= wordsA.length; opt0Len++) {
        const opt0 = wordsA.slice(wordsA.length - opt0Len).join(' ');
        const prefix = wordsA.slice(0, wordsA.length - opt0Len).join(' ');
        if (!opt0 || !opt1) continue;
        const opt0Words = opt0.split(/\s+/).length;
        const opt1Words = opt1.split(/\s+/).length;
        const balance = 10 - Math.abs(opt0Words - opt1Words) * 3;
        const score = prefix.length * 2 + Math.min(opt0.length, opt1.length) + balance;
        if (!best || score > best.score) {
          best = {
            score,
            prefix: prefix ? `${prefix} ` : '',
            suffix: suffix ? ` ${suffix}` : '',
            options: [opt0, opt1],
          };
        }
      }
    }
    if (!best) return null;
    return {
      prompt: cleanPrompt(`${best.prefix}________${best.suffix}`),
      options: best.options,
    };
  }

  if (parts.length >= 3) {
    const last = parts[parts.length - 1];
    const lastWords = last.split(/\s+/);
    const middle = parts.slice(1, -1);
    const first = parts[0];
    for (let suffixLen = 0; suffixLen < lastWords.length; suffixLen++) {
      const suffix = lastWords.slice(lastWords.length - suffixLen).join(' ');
      const lastOpt = lastWords.slice(0, lastWords.length - suffixLen).join(' ');
      for (let opt0Len = 1; opt0Len <= first.split(/\s+/).length; opt0Len++) {
        const fWords = first.split(/\s+/);
        const prefix = fWords.slice(0, fWords.length - opt0Len).join(' ');
        const opt0 = fWords.slice(fWords.length - opt0Len).join(' ');
        const options = [opt0, ...middle, ...(lastOpt ? [lastOpt] : [])].filter(Boolean);
        if (options.length >= 2 && prefix) {
          return {
            prompt: cleanPrompt(`${prefix}________${suffix ? ` ${suffix}` : ''}`),
            options,
          };
        }
      }
    }
  }
  return null;
}

function normalizeSlashText(rawText) {
  return String(rawText)
    .replace(/[\uF000-\uF0FF\uF0B7\uF0FC\u2713\u2714\u2610□]/g, ' / ')
    .replace(/(?:\s*\/\s*)+/g, ' / ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseSlashChoice(rawText, { verbPhrase = false } = {}) {
  const text = cleanPrompt(normalizeSlashText(rawText));
  if (!text.includes('/')) return null;
  const parts = text
    .split(/\s*\/\s*/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length < 2) return null;

  const verbLike =
    verbPhrase ||
    (parts.length >= 2 &&
      parts.slice(0, -1).every((p) => p.split(/\s+/).length <= 1) &&
      !parts[0].includes('.') &&
      !/^(I|You|We|They|He|She|It|The|What|When|Where|Who|How|Look|My|This|That|Do|Can|Is|Are|Was|Were|Have|Has|Did|Will|Would|Could|Should)\b/i.test(
        parts[0]
      ));

  if (verbLike) {
    const verb = parseVerbPhraseSlash(parts);
    if (verb) return verb;
  }

  const inline = parseInlineSlashChoice(parts);
  if (inline) return inline;

  return parseVerbPhraseSlash(parts);
}

function hasDoesntSay(text) {
  return /Doesn[''\u2019\u2018]t say/i.test(String(text || ''));
}

function sanitizeGlyphs(s) {
  return String(s)
    .replace(/NO\s*GLYPH/gi, '')
    .replace(/[\uE000-\uF8FF]/g, '')
    .replace(/\uFFFD/g, '')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\uF0B7\uF0FC\uF0A8\u2713\u2714\u2610□]/g, '')
    .replace(/Tick\s*\(\s*\)/gi, 'Tick')
    .replace(/\(\s*\)/g, '')
    .replace(/\s+\d{1,2}\s*$/g, '');
}

function cleanPrompt(s) {
  let out = sanitizeGlyphs(s)
    .replace(/_{2,}/g, ' ______ ')
    .replace(/\s+/g, ' ')
    .trim();
  const words = out.split(/\s+/);
  for (let n = Math.min(6, words.length - 1); n >= 2; n--) {
    const tail = words.slice(-n).join(' ');
    if (isWordBankLine(tail)) {
      out = words.slice(0, -n).join(' ').trim();
      break;
    }
  }
  return out;
}

function extractTestSection(testText, startLabel, endLabels) {
  const startRe = new RegExp(`^${startLabel}\\s*$`, 'im');
  const startMatch = startRe.exec(testText);
  if (!startMatch) return '';
  const startIdx = startMatch.index + startMatch[0].length;
  let endIdx = testText.length;
  const tail = testText.slice(startIdx);
  for (const end of endLabels) {
    const endRe = new RegExp(`^${end}\\s*$`, 'im');
    const endMatch = endRe.exec(tail);
    if (endMatch) {
      const abs = startIdx + endMatch.index;
      if (abs < endIdx) endIdx = abs;
    }
  }
  return testText.slice(startIdx, endIdx).trim();
}

function isExerciseHeaderLine(text) {
  const t = text.trim();
  if (!t) return false;
  if (t.includes('/') || /[\uF0B7\u2713\u2714□]/.test(t)) return false;
  if (/^Look at .+\.\s+[A-Z'"]/i.test(t)) return false;
  if (/_{2,}/.test(t)) return false;
  if (/\?\s*$/.test(t) && /_{2,}/.test(t)) return false;
  if (/^[a-z]/.test(t)) return false;
  if (/^[A-Za-z'']+\s+_{2,}/.test(t)) return false;
  if (/^(?:I|You|We|They|He|She|It|My|Your|Our|Their|The|A|An|Give me|Don't|Did|Can|Please|Wait|Hurry|One day|What|Where|When|Who|How|She|Ana|Bob|Jan|Tim|Jill|Li|Mo|Tom|Raoul|Darren|Hi)\b/i.test(t)) {
    return false;
  }
  return /^(?:Complete|Put|Tick|Match|Write|Order|Circle|Make sentences|Make|Choose|Read the|Read the|Label|Listen to|Listen|Correct|Cross|Answer|Which is|Rewrite|Change|Underline|Add|Fill|Look at the|Look|Replace|Name|Draw|Discuss|Describe|Compare|Identify|Highlight|Select|Type|Translate)\b/i.test(
    t
  );
}

function isReadingInstructionLine(text) {
  return /^Read the (?:article|student|review)/i.test(text.trim());
}

function parseMcOptionsFromLine(line) {
  let cleaned = sanitizeGlyphs(line.trim());
  if (!/\b[A-C]\s+/i.test(cleaned)) return [];
  const tabParts = cleaned.split(/\t+/).map((p) => p.trim()).filter(Boolean);
  if (tabParts.length >= 2 && /^[A-C]\s/i.test(tabParts[0])) {
    const tabOpts = [];
    let nextCode = 'A'.charCodeAt(0);
    for (const p of tabParts) {
      const m = p.match(/^([A-C])\s+(.+)/);
      if (m) {
        tabOpts.push({ letter: m[1].toUpperCase(), text: cleanPrompt(m[2]) });
        nextCode = m[1].toUpperCase().charCodeAt(0) + 1;
      } else if (p.trim()) {
        tabOpts.push({ letter: String.fromCharCode(nextCode), text: cleanPrompt(p) });
        nextCode++;
      }
    }
    if (tabOpts.length >= 2) return tabOpts;
  }
  if (/\bA\s+\S/.test(cleaned) && !/\bB\s+/.test(cleaned) && /\bC\s+/.test(cleaned)) {
    cleaned = cleaned.replace(/\bA\s+(.+?)\s+a\s+/i, 'A $1 B a ');
  }
  const opts = [];
  for (const m of cleaned.matchAll(/\b([A-C])\s+(.+?)(?=\s+[A-C]\s+|$)/gi)) {
    const text = cleanPrompt(m[2]);
    if (!text) continue;
    opts.push({ letter: m[1].toUpperCase(), text });
  }
  return opts.length >= 2 ? opts : [];
}

function extractAllMcQuestions(testExText, { requireExample = null } = {}) {
  const items = new Map();
  const lines = testExText.split('\n');
  const needExample = requireExample ?? /Example:/i.test(testExText);
  let afterExample = !needExample;
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    if (/^Example:/i.test(t)) {
      afterExample = true;
      continue;
    }
    if (!afterExample) continue;
    const qm = t.match(/^(\d+)[\s\t]+(.+)$/);
    if (!qm) continue;
    const num = Number(qm[1]);
    if (num < 1 || num > 15) continue;
    const rest = qm[2].trim();
    if (isExerciseHeaderLine(rest) || isReadingInstructionLine(rest) || /^Listen to/i.test(rest)) continue;
    const prompt = cleanPrompt(rest);
    let optLines = '';
    for (let j = i + 1; j < lines.length && j < i + 6; j++) {
      const ol = lines[j].trim();
      if (/^\d+[\s\t]+/.test(ol)) break;
      if (!ol || isPdfNoiseLine(ol)) continue;
      if (/^[A-C]\s+/i.test(ol) || /\b[A-C]\s+/i.test(ol)) {
        optLines += ` ${ol}`;
      } else if (/^[A-C]\s+/i.test(ol.split(/\t+/)[0])) {
        optLines += ` ${ol}`;
      } else if (optLines) {
        break;
      }
    }
    const options = parseMcOptionsFromLine(optLines);
    if (hasDoesntSay(optLines)) {
      items.set(num, {
        prompt,
        options: [
          { letter: 'A', text: 'True' },
          { letter: 'B', text: 'False' },
          { letter: 'C', text: "Doesn't say" },
        ],
        isTfds: true,
      });
    } else {
      items.set(num, { prompt, options, isTfds: false });
    }
  }
  return items;
}

function extractAllReadingMcQuestions(testExText) {
  return extractAllMcQuestions(testExText, { requireExample: true });
}

function isNewExerciseHeader(trimmed) {
  const m = trimmed.match(/^(\d+)\s+(.+)$/);
  if (!m) return false;
  const num = Number(m[1]);
  const rest = m[2].trim();
  if (num > 12 || !isExerciseHeaderLine(rest)) return false;
  if (/_{2,}/.test(trimmed)) return false;
  if (/\|/.test(rest) && rest.length < 40) return false;
  // Numbered question lines (slash choices, checkboxes) — not section headers
  if (rest.includes('/') || /[\uF0B7\u2713\u2714□]/.test(rest)) return false;
  if (/^Look at .+\.\s+[A-Z'"]/i.test(rest)) return false;
  return true;
}

function splitTestExercises(block) {
  const parts = [];
  let current = null;
  const lines = block.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trimEnd();
    const trimmed = line.trim();
    if (/^(\d+)$/.test(trimmed) && lines[i + 1]) {
      const next = lines[i + 1].trim();
      if (isNewExerciseHeader(next)) continue;
    }
    if (isNewExerciseHeader(trimmed)) {
      const num = Number(trimmed.match(/^(\d+)/)[1]);
      if (current) parts.push(current);
      current = { num, text: `${line}\n` };
      continue;
    }
    if (current) current.text += `${line}\n`;
  }
  if (current) parts.push(current);
  return parts;
}

function extractMcQuestion(testExText, itemNum) {
  const all = extractAllMcQuestions(testExText, { requireExample: false });
  if (all.has(itemNum)) {
    const { prompt, options } = all.get(itemNum);
    return { prompt, options };
  }
  const lines = testExText.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line.match(new RegExp(`^${itemNum}[\\s\\t]+`))) continue;
    let prompt = cleanPrompt(line.replace(/^\d+[\s\t]+/, ''));
    if (isExerciseHeaderLine(prompt) || isReadingInstructionLine(prompt)) continue;
    const options = [];
    let optLines = '';
    for (let j = i + 1; j < lines.length && j < i + 8; j++) {
      const ol = lines[j].trim();
      if (/^\d+[\s\t]+/.test(ol) && optLines) break;
      if (/^A\s+True/i.test(ol)) {
        return {
          prompt,
          options: [
            { letter: 'A', text: 'True' },
            { letter: 'B', text: 'False' },
            { letter: 'C', text: "Doesn't say" },
          ],
        };
      }
      if (/^[A-C]\s+/i.test(ol) || /\b[A-C]\s+/i.test(ol)) optLines += ` ${ol}`;
      else if (optLines) break;
    }
    const parsed = parseMcOptionsFromLine(optLines);
    if (parsed.length >= 2) return { prompt, options: parsed };
    return { prompt, options: [] };
  }
  return { prompt: '', options: [] };
}

function extractReadingPart2Questions(testExText) {
  const items = new Map();
  for (const line of testExText.split('\n')) {
    const t = line.trim();
    const m = t.match(/^(\d+)[\s\t]+(.+\?)\s*$/);
    if (!m) continue;
    const num = Number(m[1]);
    if (num >= 1 && num <= 15) setItemLine(items, num, m[2]);
  }
  return items;
}

function parseInlineMcFromPrompt(prompt) {
  const cleaned = cleanPrompt(prompt);
  const m = cleaned.match(/^(.+?)\s+([A-C]\s+.+\s+[A-C]\s+.+\s+[A-C]\s+.+)$/i);
  if (!m) return { prompt: cleaned, options: [] };
  const stem = cleanPrompt(m[1]);
  const opts = [];
  for (const om of m[2].matchAll(/\b([A-C])\s+([^A-C]+?)(?=\s+[A-C]\s+|$)/gi)) {
    opts.push({ letter: om[1].toUpperCase(), text: cleanPrompt(om[2]) });
  }
  return { prompt: stem, options: opts.length >= 2 ? opts : [] };
}

function setItemLine(items, num, prompt) {
  const p = cleanPrompt(prompt);
  if (!p || isPdfNoiseLine(p) || /^Read the article/i.test(p)) return;
  const prev = items.get(num);
  if (!prev || p.length > prev.length) items.set(num, p);
}

function extractItemLines(testExText) {
  const items = new Map();
  const lines = testExText.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    const m = t.match(/^(\d+)[\s\t]+(.+)$/) || t.match(/^(\d+)([A-Za-z'‘].+)$/);
    if (m) {
      const num = Number(m[1]);
      const rest = m[2].trim();
      if (isExerciseHeaderLine(rest)) continue;
      let prompt = rest;
      let j = i + 1;
      while (j < lines.length) {
        const nt = lines[j].trim();
        if (/^\d+\s*$/.test(nt) || /^\d+[\s\t]+/.test(nt) || /^\d+[A-Za-z]/.test(nt)) break;
        if (!nt || /^Example:/i.test(nt)) break;
        if (isExerciseHeaderLine(nt) || isPdfNoiseLine(nt)) break;
        if (/^_{3,}/.test(nt)) break;
        if (isWordBankLine(nt)) break;
        if (/^[A-G]\s+/.test(nt) && items.size > 0) break;
        if (/^A\s+True/i.test(nt)) break;
        if (/^Read the article again/i.test(rest)) break;
        prompt += ` ${nt}`;
        j++;
      }
      setItemLine(items, num, prompt);
      continue;
    }
    if (/^(\d+)$/.test(t)) {
      const num = Number(t);
      let j = i + 1;
      let prompt = '';
      while (j < lines.length) {
        const nt = lines[j].trim();
        if (/^\d+\s*$/.test(nt) || /^\d+\s+/.test(nt) || /^\d+[A-Za-z]/.test(nt)) break;
        if (!nt) {
          j++;
          continue;
        }
        if (/^_{3,}/.test(nt)) {
          const hint = nt.match(/\(([^)]+)\)/);
          prompt += hint ? ` ______ (${hint[1]})` : ' ______';
          j++;
          break;
        }
        if (isExerciseHeaderLine(nt) || isPdfNoiseLine(nt)) break;
        prompt += (prompt ? ' ' : '') + nt;
        j++;
      }
      if (prompt) setItemLine(items, num, prompt);
    }
  }
  return items;
}

function extractNthBlankPrompt(testExText, itemNum) {
  const blanks = [];
  const lines = testExText.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!/_{3,}/.test(line)) continue;
    let prompt = line.replace(/_{3,}/, ' ______').trim();
    const prev = (lines[i - 1] || '').trim();
    if (prev && !/_{3,}/.test(prev) && !/^Example:/i.test(prev) && prev.length < 140) {
      const prevClean = prev
        .replace(/^\d+\s+\d+\s+/, '')
        .replace(/^\d+\s+/, '')
        .replace(/\s+\d+\s*$/, '')
        .trim();
      const curClean = prompt.replace(/^\d+\s+/, '').trim();
      if (prevClean && !/^_{3,}/.test(prevClean)) {
        prompt = `${prevClean} ${curClean}`.replace(/\s+\d+\s+(?=[A-Z][a-z])/g, ' ').trim();
      }
    }
    prompt = cleanPrompt(prompt.replace(/\s+\d+\s*$/, ''));
    if (prompt) blanks.push(prompt);
  }
  return blanks[itemNum - 1] || '';
}

function isListeningMcExercise(testExText) {
  const flat = testExText.replace(/\s+/g, ' ');
  return (
    /Tick.*A,?\s*B,?\s*or\s*C/i.test(flat) &&
    !/Match.*conversations/i.test(testExText) &&
    !/Match.*\ba[–-][a-g]\b/i.test(testExText)
  );
}

function extractPronMatchRow(testExText, itemNum) {
  const line = testExText.split('\n').find((l) => l.trim().match(new RegExp(`^${itemNum}[\\s\\t]+`)));
  if (!line) return '';
  const rest = line.trim().replace(new RegExp(`^${itemNum}[\\s\\t]+`), '');
  if (isExerciseHeaderLine(rest)) return '';
  const segs = rest.split(/\t+|\s{2,}/).map((s) => s.trim()).filter(Boolean);
  return cleanPrompt(segs.join(' '));
}

function extractEmailBlank(testExText, itemNum) {
  const ctx = new RegExp(
    `([A-Za-z][^\\n]{0,50}?)\\s*${itemNum}\\s*\\n[_\\s]+\\(([^)]+)\\)`,
    'i'
  );
  const m = testExText.match(ctx);
  if (m) return cleanPrompt(`${m[1].trim()} ______ (${m[2]})`);
  const solo = new RegExp(`\\b${itemNum}\\s*\\n[_\\s]+\\(([^)]+)\\)`, 'i');
  const m2 = testExText.match(solo);
  if (m2) return cleanPrompt(`______ (${m2[1]})`);
  return '';
}

function extractDialoguePrompt(testExText, itemNum) {
  const re = new RegExp(`(\\S[^\\n]*?\\b${itemNum})\\s*\\n[_\\s]+\\(([^)]+)\\)`, 'i');
  const m = testExText.match(re);
  if (m) return cleanPrompt(`${m[1].replace(/\s+\d+\s*$/, '')} ______ (${m[2]})`);
  return extractEmailBlank(testExText, itemNum);
}

function extractTextPrompt(testExText, itemNum) {
  const items = extractItemLines(testExText);
  if (items.has(itemNum)) return items.get(itemNum);
  const email = extractEmailBlank(testExText, itemNum);
  if (email) return email;
  const dialogue = extractDialoguePrompt(testExText, itemNum);
  if (dialogue) return dialogue;
  const line = testExText.split('\n').find((l) => {
    const t = l.trim();
    return (
      t.match(new RegExp(`^${itemNum}[\\s\\t]+`)) &&
      !isExerciseHeaderLine(t.replace(new RegExp(`^${itemNum}[\\s\\t]+`), ''))
    );
  });
  if (line) return cleanPrompt(line.replace(new RegExp(`^${itemNum}[\\s\\t]+`), ''));
  return '';
}

function promptOrFallback(testEx, itemNum, itemAnswer) {
  const p = extractTextPrompt(testEx, itemNum);
  if (p && !/^Complete \(\d+\)$/i.test(p) && !/^Item \d+$/i.test(p)) return p;
  const stress = extractStressWord(testEx, itemNum, true);
  if (stress && /\|/.test(stress)) return stress;
  const conv = extractConversationPrompt(testEx, itemNum);
  if (conv) return conv;
  const a = (itemAnswer || '').trim();
  if (/^[A-G]$/i.test(a)) return `Match conversation ${itemNum} (option ${a.toUpperCase()})`;
  if (/^[HL]$/i.test(a)) return 'Write L or H';
  if (/^\d+$/.test(a)) return 'Choose the stressed syllable';
  const instr = getExerciseInstruction(testEx);
  if (instr) return `${instr.replace(/\.$/, '')} — question ${itemNum}`;
  return `Question ${itemNum}`;
}

function extractTickFormChoice(rest) {
  const slashIdx = rest.indexOf('/');
  if (slashIdx === -1) return null;
  const left = rest.slice(0, slashIdx);
  const right = rest.slice(slashIdx + 1);
  const opt0M = left.match(/([a-z][a-z'\u2019\-]*(?:\s+[a-z'\u2019\-]+){0,3})\s*[\uF000-\uF0FF\u2713\u2714\u2610□]\s*$/i);
  const opt1M = right.match(/^([a-z][a-z'\u2019\-]*(?:\s+[a-z'\u2019\-]+){0,3})\s*[\uF000-\uF0FF\u2713\u2714\u2610□]/i);
  if (!opt0M || !opt1M) return null;
  const opt0 = cleanPrompt(opt0M[1]);
  const opt1 = cleanPrompt(opt1M[1]);
  const prefix = left.slice(0, opt0M.index).trim();
  const tail = right.slice(opt1M[0].length).trim();
  if (!opt0 || !opt1 || !tail) return null;
  return {
    prompt: cleanPrompt(`${prefix} ______ ${tail}`),
    options: [opt0, opt1],
  };
}

function extractTickVerbQuestion(testExText, itemNum, instruction = '') {
  const line = testExText.split('\n').find((l) => {
    if (!l.trim().match(new RegExp(`^${itemNum}[\\s\\t]`))) return false;
    const rest = l.replace(new RegExp(`^${itemNum}[\\s\\t]+`), '').trim();
    return !isExerciseHeaderLine(rest);
  });
  if (!line) return null;
  const rest = line.replace(new RegExp(`^${itemNum}[\\s\\t]+`), '');
  const verbPhrase = /correct verb/i.test(instruction);

  if (/correct form/i.test(instruction)) {
    const tickForm = extractTickFormChoice(rest);
    if (tickForm) return tickForm;
  }

  if (rest.includes('/')) {
    if (/correct form/i.test(instruction)) {
      const parts = normalizeSlashText(rest)
        .split(/\s*\/\s*/)
        .map((p) => p.trim())
        .filter(Boolean);
      if (parts.length === 2) {
        const inline = parseInlineSlashChoice(parts);
        if (inline) return inline;
      }
    }
    const parsed = parseSlashChoice(rest, { verbPhrase });
    if (parsed) return parsed;
  }

  const options = [...rest.matchAll(/([a-z][a-z'\-]*(?:\s+[a-z'\-]+){0,4})\s*[\uF0B7\uF0FC\uF063\u2713\u2714\u2610□]/gi)].map(
    (m) => m[1].trim()
  );
  if (options.length >= 2) {
    return { prompt: '________', options: options.slice(0, 3) };
  }
  return null;
}

function extractWordBankAfterItem(testExText, itemNum) {
  const lines = testExText.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].trim().match(new RegExp(`^${itemNum}[\\s\\t]`))) continue;
    const rest = lines[i].replace(new RegExp(`^${itemNum}[\\s\\t]+`), '').trim();
    if (isExerciseHeaderLine(rest)) continue;
    const next = (lines[i + 1] || '').trim();
    if (isWordBankLine(next)) return next.split(/\s+/).filter(Boolean);
    return [];
  }
  return [];
}

function extractWordChoice(testExText, itemNum) {
  const lines = testExText.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].trim().match(new RegExp(`^${itemNum}[\\s\\t]`))) continue;
    const rest = lines[i].replace(new RegExp(`^${itemNum}[\\s\\t]+`), '').trim();
    if (isExerciseHeaderLine(rest)) continue;
    const prompt = cleanPrompt(rest);
    const next = (lines[i + 1] || '').trim();
    if (next && !/^\d+[\s\t]/.test(next) && !/^Example/i.test(next) && !/^Grammar|^Vocabulary/i.test(next)) {
      const words = next.split(/\t+|\s{2,}|\s+/).map((w) => w.trim()).filter((w) => w && /^[a-z]/i.test(w));
      if (words.length >= 2 && words.length <= 6) {
        return {
          prompt,
          options: words.map((text, idx) => ({ letter: String.fromCharCode(65 + idx), text })),
        };
      }
    }
    const bank = extractWordBankAfterItem(testExText, itemNum);
    if (bank.length >= 2) {
      return {
        prompt,
        options: bank.map((text, idx) => ({ letter: String.fromCharCode(65 + idx), text })),
      };
    }
    return { prompt, options: [] };
  }
  return null;
}

function extractReadingQuestion(testExText, itemNum) {
  const lines = testExText.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].trim().match(new RegExp(`^${itemNum}\\s+`))) continue;
    let prompt = lines[i].replace(/^\d+\s+/, '').trim();
    if (/^Read the article/i.test(prompt)) continue;
    const options = [];
    let isTfds = false;
    for (let j = i + 1; j < lines.length && j < i + 6; j++) {
      const ol = lines[j].trim();
      if (/^A\s+True/i.test(ol)) {
        isTfds = true;
        options.push(
          { letter: 'A', text: 'True' },
          { letter: 'B', text: 'False' },
          { letter: 'C', text: "Doesn't say" }
        );
        break;
      }
      const om = ol.match(/^([A-C])\s+(.+)/i);
      if (om) {
        const text = om[2].replace(/[\uF0B7\u2713\u2714].*$/, '').trim();
        if (!/True|False|Doesn't/i.test(text)) options.push({ letter: om[1].toUpperCase(), text });
      } else if (/^\d+\s+/.test(ol) && options.length) break;
    }
    return { prompt, options, isTfds };
  }
  const items = extractItemLines(testExText);
  const prompt = items.get(itemNum) || '';
  return { prompt, options: [], isTfds: false };
}

function extractConversationPrompt(testExText, itemNum) {
  const re = new RegExp(`Conversation\\s+${itemNum}\\s*[:\\s]+([^\\n]+)`, 'i');
  const m = testExText.match(re);
  if (m) return cleanPrompt(m[1].replace(/_{2,}.*$/, '').trim());
  return '';
}

function extractListeningSlashChoice(testExText, itemNum) {
  const line = testExText.split('\n').find((l) => l.trim().match(new RegExp(`^${itemNum}[\\s\\t]`)));
  if (!line || !line.includes('/')) return null;
  const rest = cleanPrompt(line.replace(new RegExp(`^${itemNum}[\\s\\t]+`), ''));
  const parsed = parseSlashChoice(rest);
  if (!parsed || parsed.options.length < 2) return null;
  return parsed;
}

function extractListeningCityChoice(testExText, itemNum) {
  const re = new RegExp(`Conversation\\s+${itemNum}\\s*:\\s*([^\\n]+)`, 'i');
  const m = testExText.match(re);
  if (!m) return null;
  const rest = m[1].trim();
  const known = [
    'Mexico City',
    'Mumbai',
    'Singapore',
    'Seoul',
    'Venice',
    'Paris',
    'Rome',
    'Cuzco',
    'Istanbul',
    'Santiago',
    'London',
    'Tokyo',
    'Berlin',
    'Madrid',
    'Barcelona',
  ];
  const opts = known.filter((c) => rest.includes(c));
  if (opts.length < 2) {
    const cities = rest.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/g) || [];
    opts.push(...cities.filter((c) => !/^(The|Most|Best|Cleanest|Friendliest|Exciting|Value|Conversation)$/i.test(c)));
  }
  const unique = [...new Set(opts)];
  if (unique.length < 2) return null;
  const criterion = unique
    .reduce((s, c) => s.replace(c, ''), rest)
    .replace(/\s+/g, ' ')
    .trim();
  return {
    prompt: criterion ? `Conversation ${itemNum}: ${cleanPrompt(criterion)}` : `Conversation ${itemNum}`,
    options: unique.slice(0, 3),
  };
}

function extractStressWord(testExText, itemNum, skipFallback = false) {
  const lines = testExText.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    if (!t.match(new RegExp(`^${itemNum}[\\s\\t]`))) continue;
    let word = t.replace(new RegExp(`^${itemNum}[\\s\\t]+`), '').trim();
    word = word.replace(/\s+\d+\s*[\uF0B7□\s]*(\d+\s*)*$/i, '').trim();
    if (word && /\|/.test(word)) return word;
    if (word && !/^\d+$/.test(word) && !isExerciseHeaderLine(word)) return word;
    if (lines[i + 1]) {
      const n = lines[i + 1].trim();
      if (/\|/.test(n)) return n.replace(/\s+\d+\s*[\uF0B7□].*$/i, '').trim();
    }
  }
  return skipFallback ? '' : promptOrFallback(testExText, itemNum, '');
}

function extractWordBank(testExText) {
  const lines = testExText.split('\n').filter((l) => l.trim());
  const bank = [];
  for (const line of lines) {
    if (/^Example:/i.test(line)) break;
    if (/^\d+\s+/.test(line.trim())) break;
    if (/^(?:Complete|Put|Tick|Match|Which)/i.test(line.trim())) continue;
    const words = line.trim().split(/\s+/).filter((w) => /^[a-z]+$/i.test(w.replace(/\|/g, '')));
    if (words.length >= 3) bank.push(...words);
  }
  return [...new Set(bank)];
}

function extractReadingPassage(testText) {
  const rBlock = extractTestSection(testText, 'READING', ['WRITING', 'Writing']);
  const m =
    rBlock.match(/1\s+Read[^\n]*\n([\s\S]*?)(?:\nExample:|\n1\s+The |\n1\s+[A-Z][a-z]+ )/i) ||
    testText.match(/READING\s*\n1\s+Read[\s\S]*?\n([\s\S]*?)(?:\nExample:|\n1\s+)/i);
  if (!m) return '';
  return sanitizeGlyphs(
    m[1]
      .trim()
      .split('\n')
      .filter((l) => !l.includes('Photocopiable') && !/^File Test/i.test(l))
      .join('\n')
      .trim()
  );
}

function splitReadingPart1(rBlock) {
  const markers = [
    /\n2\s+Read\s+the\s+/i,
    /\n2\s+Read\s+the article/i,
    /\n2\s+Write\s+[A-Z]\s+for/i,
    /\n2\s+Who\s+was/i,
  ];
  let cut = rBlock.length;
  for (const re of markers) {
    const m = re.exec(rBlock);
    if (m && m.index > 0 && m.index < cut) cut = m.index;
  }
  return rBlock.slice(0, cut);
}

function splitReadingPart2(rBlock) {
  const markers = [
    /\n2\s+Read\s+the\s+/i,
    /\n2\s+Read\s+the article/i,
    /\n2\s+Write\s+[A-Z]\s+for/i,
    /\n2\s+Who\s+was/i,
  ];
  for (const re of markers) {
    const m = re.exec(rBlock);
    if (m) return rBlock.slice(m.index + 1);
  }
  return rBlock.split(/2\s+Read/i)[1] || '';
}

function extractWritingPrompt(testText) {
  const wBlock = extractTestSection(testText, 'WRITING', ['LISTENING', 'Reading and Writing total']);
  const m = wBlock.match(/^(Write[\s\S]*?)(?:\nA holiday|\nWriting total|$)/im);
  return m ? m[1].trim() : 'Write your answer below (100–150 words).';
}

function extractMatchOptions(testExText) {
  const options = [];
  const convIdx = testExText.search(/Conversation\s+1/i);
  const scanText = convIdx >= 0 ? testExText.slice(convIdx) : testExText;
  for (const line of scanText.split('\n')) {
    const m = line.match(/^([A-G])\s+(.+)/);
    if (!m || /^Conversation/i.test(m[2])) continue;
    if (/\bB\s+.+\bC\s+/i.test(m[2])) continue;
    const text = cleanPrompt(m[2]);
    if (!text || /^(?:True|False|Doesn't say)$/i.test(text)) continue;
    if (/True\s+False/i.test(text)) continue;
    if (text.length > 80) continue;
    options.push({ letter: m[1], text });
  }
  return options;
}

function extractAfMatchPrompt(testExText, itemNum) {
  const line = testExText.split('\n').find((l) => {
    const t = l.trim();
    const m = t.match(new RegExp(`^${itemNum}\\s+(.+)$`));
    return m && !isExerciseHeaderLine(m[1].trim());
  });
  if (!line) return '';
  let rest = line.trim().replace(new RegExp(`^${itemNum}\\s+`), '');
  rest = rest.split(/_{2,}/)[0];
  rest = rest.replace(/\s+[a-f]\s+[a-f]\s+.*$/i, '').trim();
  return cleanPrompt(rest);
}

function cleanMatchPhrase(s) {
  return sanitizeGlyphs(String(s))
    .replace(/_{2,}/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseAkMatchRow(rest) {
  const tabSegs = rest.split(/\t+/).map((s) => s.trim()).filter(Boolean);
  if (tabSegs.length >= 2) {
    const last = tabSegs[tabSegs.length - 1];
    const secondLast = tabSegs[tabSegs.length - 2];
    if (/^[a-k]$/i.test(secondLast) && last && !/^_{2,}$/.test(last) && !/^[a-k]$/i.test(last)) {
      let promptSegs = tabSegs.slice(0, -2).filter((s) => !/^_{2,}$/.test(s));
      while (promptSegs.length && /^[a-k]$/i.test(promptSegs[promptSegs.length - 1])) promptSegs.pop();
      return {
        prompt: cleanPrompt(promptSegs.join(' ')),
        letter: secondLast.toLowerCase(),
        phrase: cleanMatchPhrase(last),
      };
    }
  }
  const segs = rest.split(/\s{2,}/).map((s) => s.trim()).filter(Boolean);
  if (segs.length >= 2) {
    const last = segs[segs.length - 1];
    const secondLast = segs[segs.length - 2];
    if (/^[a-k]$/i.test(secondLast) && last && !/^_{2,}$/.test(last) && !/^[a-k]$/i.test(last)) {
      let promptSegs = segs.slice(0, -2).filter((s) => !/^_{2,}$/.test(s));
      while (promptSegs.length && /^[a-k]$/i.test(promptSegs[promptSegs.length - 1])) promptSegs.pop();
      return {
        prompt: cleanPrompt(promptSegs.join(' ')),
        letter: secondLast.toLowerCase(),
        phrase: cleanMatchPhrase(last),
      };
    }
  }
  const endM = rest.match(/^(.*?)(?:\s+___\s+)?([a-k])\s+(.+)$/i);
  if (!endM) return null;
  let prompt = endM[1].trim().replace(/\s+[a-k]\s*$/i, '').trim();
  const phrase = cleanMatchPhrase(endM[3]);
  const letter = endM[2].toLowerCase();
  if (!phrase || !letter) return null;
  return { prompt: cleanPrompt(prompt), letter, phrase };
}

function extractAkMatchOptions(testExText) {
  const options = new Map();
  for (const line of testExText.split('\n')) {
    const m = line.trim().match(/^(\d+)\s+(.+)$/);
    if (!m || Number(m[1]) > 11) continue;
    const rest = m[2];
    if (isExerciseHeaderLine(rest)) continue;
    const row = parseAkMatchRow(rest);
    if (row) options.set(row.letter, row.phrase);
  }
  return [...options.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([letter, text]) => ({ letter: letter.toUpperCase(), text }));
}

function extractAkMatchPrompt(testExText, itemNum) {
  const line = testExText.split('\n').find((l) => {
    const m = l.trim().match(new RegExp(`^${itemNum}\\s+(.+)$`));
    if (!m) return false;
    return !isExerciseHeaderLine(m[1].trim());
  });
  if (!line) return '';
  const rest = line.trim().replace(new RegExp(`^${itemNum}\\s+`), '');
  const row = parseAkMatchRow(rest);
  return row?.prompt || cleanPrompt(rest.split(/\t+|\s{2,}/)[0] || rest);
}

function extractAfMatchOptions(testExText, akItems) {
  const valueByLetter = new Map();
  const rowEndings = {};
  for (const line of testExText.split('\n')) {
    const t = line.trim();
    const m = t.match(/^(\d+)\s+(.+)$/);
    if (!m || Number(m[1]) > 12) continue;
    const num = Number(m[1]);
    const rest = m[2];
    if (isExerciseHeaderLine(rest)) continue;
    const segs = rest.split(/\t+|\s{2,}/).map((s) => s.trim()).filter(Boolean);
    const last = cleanPrompt(segs[segs.length - 1] || '');
    if (last && !/^[a-f]$/i.test(last) && !/Match\s+\d/i.test(last)) rowEndings[num] = last;
  }
  for (const item of akItems) {
    if (rowEndings[item.num]) valueByLetter.set(item.answer.trim().toLowerCase(), rowEndings[item.num]);
  }
  if (rowEndings[4] && rowEndings[5] && rowEndings[6]) {
    const rotated = { f: rowEndings[6], d: rowEndings[4], c: rowEndings[5] };
    for (const [letter, val] of Object.entries(rotated)) {
      if (akItems.some((i) => i.answer.trim().toLowerCase() === letter)) valueByLetter.set(letter, val);
    }
  }
  return ['a', 'b', 'c', 'd', 'e', 'f']
    .filter((l) => valueByLetter.has(l))
    .map((l) => ({ letter: l.toUpperCase(), text: valueByLetter.get(l) }));
}

function isListenTrueFalse(testExText) {
  return /A\s+True/i.test(testExText) && /B\s+False/i.test(testExText);
}

function radioMcHtml(id, prompt, options, itemNum) {
  const prefix = itemNum != null ? `${itemNum}. ` : '';
  const opts =
    options.length >= 2
      ? options
      : [
          { letter: 'A', text: 'A' },
          { letter: 'B', text: 'B' },
          { letter: 'C', text: 'C' },
        ];
  return `<div class="q-item"><p>${prefix}${escapeHtml(prompt)}</p><div class="radio-group">${opts
    .map((o) => {
      const lbl = /^[A-G]$/i.test(o.letter) ? `${o.letter}. ${o.text}` : o.text;
      return `<label><input type="radio" name="${id}" value="${escapeHtml(o.letter)}"> ${escapeHtml(lbl)}</label>`;
    })
    .join('')}</div></div>`;
}

function textInputHtml(id, prompt, itemNum, placeholder = 'Your answer') {
  return `<div class="q-item"><p>${itemNum}. ${escapeHtml(prompt)}</p><input type="text" name="${id}" class="answer-input" placeholder="${escapeHtml(placeholder)}"></div>`;
}

function buildExerciseQuestions(ex, testEx, idPrefix, sectionKind) {
  const instruction = getExerciseInstruction(testEx);
  const instructionHtml = instruction ? `<h3>${escapeHtml(instruction)}</h3>` : '';
  const isDialogue = /dialogue/i.test(instruction);
  const isEmail = /complete the (?:email|letter)/i.test(instruction);
  const isRewrite = /rewrite/i.test(instruction);
  const listenTf = sectionKind === 'listening' && isListenTrueFalse(testEx);
  const isStressEx = /stressed syllable/i.test(instruction);
  const isTick =
    /tick/i.test(instruction) && sectionKind !== 'listening' && !listenTf && !isStressEx;
  const isAfMatch = /Match.*\ba[–-]f\b/i.test(instruction);
  const isAkMatch = /Match.*\ba[–-]k\b/i.test(instruction);
  const isWordChoice = /correct word/i.test(instruction) || /into a noun/i.test(instruction);
  const isJustAlreadyYet = /just,\s*already,\s*or\s*yet/i.test(instruction);
  const isMatchPron = /match the words/i.test(instruction);
  const listenMc = sectionKind === 'listening' && isListeningMcExercise(testEx);
  const wordBank = isMatchPron ? extractWordBank(testEx) : [];
  const wordBankHtml = wordBank.length
    ? `<div class="word-bank">${wordBank.map((w) => escapeHtml(w)).join(' · ')}</div>`
    : '';
  const afMatchOpts = isAfMatch ? extractAfMatchOptions(testEx, ex.items) : [];
  const akMatchOpts = isAkMatch ? extractAkMatchOptions(testEx) : [];
  const matchOpts = listenTf
    ? []
    : akMatchOpts.length
      ? akMatchOpts
      : afMatchOpts.length
        ? afMatchOpts
        : extractMatchOptions(testEx);
  const matchHeader =
    matchOpts.length >= 3 && sectionKind === 'listening' && !listenMc
      ? `<div class="match-options">${matchOpts.map((o) => `<div><strong>${o.letter}</strong> ${escapeHtml(o.text)}</div>`).join('')}</div>`
      : (isAfMatch || isAkMatch) && matchOpts.length
        ? `<div class="match-options">${matchOpts.map((o) => `<div><strong>${o.letter}</strong> ${escapeHtml(o.text)}</div>`).join('')}</div>`
        : '';

  const questions = ex.items.map((item) => {
    const id = `${idPrefix}${ex.num}_${item.num}`;
    const answers = altAnswers(item.answer);
    const type = isAkMatch ? 'match' : inferType(item.answer, testEx);
    let html = '';

    if (sectionKind === 'listening') {
      const slash = extractListeningSlashChoice(testEx, item.num);
      const city = extractListeningCityChoice(testEx, item.num);
      if (listenMc) {
        const { prompt, options } = extractMcQuestion(testEx, item.num);
        const opts =
          options.length >= 2
            ? options
            : [
                { letter: 'A', text: 'A' },
                { letter: 'B', text: 'B' },
                { letter: 'C', text: 'C' },
              ];
        html = radioMcHtml(
          id,
          prompt || promptOrFallback(testEx, item.num, item.answer),
          opts,
          item.num
        );
      } else if (slash) {
        const opts = slash.options.map((text) => ({ letter: text, text }));
        html = radioMcHtml(id, slash.prompt, opts, item.num);
      } else if (city) {
        const opts = city.options.map((text) => ({ letter: text, text }));
        html = radioMcHtml(id, city.prompt, opts, item.num);
      } else if (listenTf || type === 'tf') {
        const prompt = promptOrFallback(testEx, item.num, item.answer);
        const akTf = /^(T|F)$/i.test(item.answer.trim());
        html = akTf
          ? `<div class="q-item"><p>${item.num}. ${escapeHtml(prompt)}</p><div class="radio-group"><label><input type="radio" name="${id}" value="T"> True</label><label><input type="radio" name="${id}" value="F"> False</label></div></div>`
          : `<div class="q-item"><p>${item.num}. ${escapeHtml(prompt)}</p><div class="radio-group"><label><input type="radio" name="${id}" value="A"> A. True</label><label><input type="radio" name="${id}" value="B"> B. False</label></div></div>`;
      } else if (type === 'match' && /^[A-K]$/i.test(item.answer.trim())) {
        const selectOpts = matchOpts.length
          ? matchOpts
          : isAkMatch
            ? 'abcdefghijk'.split('').map((l) => ({ letter: l.toUpperCase(), text: l }))
            : 'ABCDEFG'.split('').map((l) => ({ letter: l, text: l }));
        const convPrompt =
          (isAkMatch ? extractAkMatchPrompt(testEx, item.num) : '') ||
          extractConversationPrompt(testEx, item.num) ||
          `Item ${item.num}`;
        const optVal = (letter) => (isAkMatch ? letter.toLowerCase() : letter);
        html = `<div class="q-item"><p>${item.num}. ${escapeHtml(convPrompt)}</p><select name="${id}" class="answer-input"><option value="">— Select —</option>${selectOpts
          .map((o) => `<option value="${optVal(o.letter)}">${o.letter}. ${escapeHtml(o.text)}</option>`)
          .join('')}</select></div>`;
      } else {
        const prompt = promptOrFallback(testEx, item.num, item.answer);
        const parsed = prompt.includes('/') ? parseSlashChoice(prompt) : null;
        if (parsed) {
          const opts = parsed.options.map((text) => ({ letter: text, text }));
          html = radioMcHtml(id, parsed.prompt, opts, item.num);
        } else {
          html = textInputHtml(id, prompt, item.num);
        }
      }
    } else if (isEmail) {
      const prompt = extractEmailBlank(testEx, item.num) || promptOrFallback(testEx, item.num, item.answer);
      html = textInputHtml(id, prompt, item.num, 'verb form');
    } else if (isRewrite) {
      const prompt = promptOrFallback(testEx, item.num, item.answer);
      html = textInputHtml(id, prompt, item.num, 'Rewrite the sentence');
    } else if (isJustAlreadyYet) {
      const prompt =
        extractNthBlankPrompt(testEx, item.num) || promptOrFallback(testEx, item.num, item.answer);
      html = textInputHtml(id, prompt, item.num, 'just / already / yet');
    } else if (isDialogue) {
      const prompt = extractDialoguePrompt(testEx, item.num) || promptOrFallback(testEx, item.num, item.answer);
      html = textInputHtml(id, prompt, item.num, 'answer');
    } else if (isTick) {
      const tick = extractTickVerbQuestion(testEx, item.num, instruction);
      if (tick) {
        const opts = tick.options.map((text) => ({ letter: text, text }));
        html = radioMcHtml(id, tick.prompt, opts, item.num);
      } else {
        const line = promptOrFallback(testEx, item.num, item.answer);
        const parsed = line.includes('/') ? parseSlashChoice(line) : null;
        if (parsed) {
          const opts = parsed.options.map((text) => ({ letter: text, text }));
          html = radioMcHtml(id, parsed.prompt, opts, item.num);
        } else if (line.includes('/')) {
          html = textInputHtml(id, line, item.num);
        } else {
          html = textInputHtml(id, line, item.num);
        }
      }
    } else if (isWordChoice) {
      const wc = extractWordChoice(testEx, item.num);
      const slashParsed = wc?.prompt?.includes('/')
        ? parseSlashChoice(wc.prompt)
        : parseSlashChoice(promptOrFallback(testEx, item.num, item.answer));
      if (slashParsed) {
        const opts = slashParsed.options.map((text) => ({ letter: text, text }));
        html = radioMcHtml(id, slashParsed.prompt, opts, item.num);
      } else if (wc?.options.length) {
        const opts = wc.options.map((o) => ({ letter: o.text, text: o.text }));
        html = radioMcHtml(id, wc.prompt, opts, item.num);
      } else {
        html = textInputHtml(id, promptOrFallback(testEx, item.num, item.answer), item.num);
      }
    } else if (type === 'stress') {
      const word = extractStressWord(testEx, item.num);
      const max = Math.max(3, ...answers.map((a) => Number(a)));
      html = `<div class="q-item"><p>${item.num}. ${escapeHtml(word || promptOrFallback(testEx, item.num, item.answer))}</p><div class="radio-group">${Array.from({ length: max }, (_, i) => i + 1)
        .map((n) => `<label><input type="radio" name="${id}" value="${n}"> syllable ${n}</label>`)
        .join('')}</div></div>`;
    } else if (type === 'mc3' || type === 'tfds') {
      const { prompt, options, isTfds } = extractReadingQuestion(testEx, item.num);
      const { prompt: mcPrompt, options: mcOpts } =
        options.length >= 2 ? { prompt, options } : extractMcQuestion(testEx, item.num);
      const opts =
        isTfds || type === 'tfds'
          ? [
              { letter: 'A', text: 'True' },
              { letter: 'B', text: 'False' },
              { letter: 'C', text: "Doesn't say" },
            ]
          : mcOpts.length
            ? mcOpts
            : options;
      html = radioMcHtml(id, mcPrompt || prompt, opts, item.num);
    } else if (type === 'tf') {
      const prompt = promptOrFallback(testEx, item.num, item.answer);
      html = `<div class="q-item"><p>${item.num}. ${escapeHtml(prompt)}</p><div class="radio-group"><label><input type="radio" name="${id}" value="T"> True</label><label><input type="radio" name="${id}" value="F"> False</label></div></div>`;
    } else if (type === 'hl') {
      const prompt = promptOrFallback(testEx, item.num, item.answer);
      html = `<div class="q-item"><p>${item.num}. ${escapeHtml(prompt)}</p><div class="radio-group"><label><input type="radio" name="${id}" value="L"> L</label><label><input type="radio" name="${id}" value="H"> H</label></div></div>`;
    } else if (listenTf || (type === 'mc3' && /True.*False/i.test(promptOrFallback(testEx, item.num, item.answer)))) {
      const prompt = promptOrFallback(testEx, item.num, item.answer).replace(/\s*A\s+True.*$/i, '').trim();
      html = `<div class="q-item"><p>${item.num}. ${escapeHtml(prompt)}</p><div class="radio-group"><label><input type="radio" name="${id}" value="A"> A. True</label><label><input type="radio" name="${id}" value="B"> B. False</label></div></div>`;
    } else if (type === 'match') {
      const selectOpts = matchOpts.length
        ? matchOpts
        : isAkMatch
          ? 'abcdefghijk'.split('').map((l) => ({ letter: l.toUpperCase(), text: l }))
          : 'ABCDEFG'.split('').map((l) => ({ letter: l, text: l }));
      const convPrompt =
        (isAkMatch ? extractAkMatchPrompt(testEx, item.num) : '') ||
        extractAfMatchPrompt(testEx, item.num) ||
        extractConversationPrompt(testEx, item.num) ||
        promptOrFallback(testEx, item.num, item.answer);
      const optVal = (letter) => (isAkMatch ? letter.toLowerCase() : letter);
      html = `<div class="q-item"><p>${item.num}. ${escapeHtml(convPrompt)}</p><select name="${id}" class="answer-input"><option value="">— Select —</option>${selectOpts
        .map((o) => `<option value="${optVal(o.letter)}">${o.letter}. ${escapeHtml(o.text)}</option>`)
        .join('')}</select></div>`;
    } else {
      const prompt = isMatchPron
        ? extractPronMatchRow(testEx, item.num) ||
          `${promptOrFallback(testEx, item.num, item.answer)} → type the matching word`
        : promptOrFallback(testEx, item.num, item.answer);
      html = textInputHtml(id, prompt, item.num);
    }
    return { id, type, answers, html };
  });

  return { instructionHtml: instructionHtml + wordBankHtml + matchHeader, questions };
}

function buildAnswerKeyObject(sections) {
  const key = {};
  for (const sec of sections) {
    for (const q of sec.questions) key[q.id] = q.answers[0];
  }
  return key;
}

function normalizeAnswer(val) {
  if (!val) return '';
  return val
    .toString()
    .trim()
    .toLowerCase()
    .replace(/['']/g, "'")
    .replace(/[?!.,;:"()]/g, '')
    .replace(/\s+/g, ' ');
}

function altAnswers(raw) {
  const trimmed = raw.trim();
  const parts =
    trimmed.includes(',') &&
    !trimmed.includes('/') &&
    trimmed.split(',').every((p) => p.trim().split(/\s+/).length <= 3 && p.trim().length <= 24)
      ? trimmed.split(/\s*,\s*/)
      : trimmed.split(/\s*\/\s*/);
  return parts
    .map((a) =>
      normalizeAnswer(
        a.replace(/…/g, ' ').replace(/\.\.\./g, ' ').replace(/\s+/g, ' ').trim()
      )
    )
    .filter(Boolean);
}

function buildSections(testText, akText) {
  const sections = [];
  const grammarAk = parseAkSection(akText, 'GRAMMAR', ['VOCABULARY', 'Pronunciation', 'PRONUNCIATION']);
  const vocabAk = parseAkSection(akText, 'VOCABULARY', ['PRONUNCIATION', 'Pronunciation', 'Reading']);
  const pronAk = parseAkSection(akText, 'PRONUNCIATION', ['Reading', 'READING']) ||
    parseAkSection(akText, 'Pronunciation', ['Reading', 'READING']);
  const readingAkBlock =
    akText.match(/\nREADING\s*\n([\s\S]*?)(?=\nWRITING|\nLISTENING|\nSpeaking)/i)?.[1] ||
    akText.match(/Reading and Writing[\s\S]*?\nREADING\s*\n([\s\S]*?)(?=\nWRITING)/i)?.[1] ||
    '';
  const readingExercises = parseAkExercises(readingAkBlock);
  const readingAk1 = readingExercises[0] ? [readingExercises[0]] : [];
  const readingAk2 = readingExercises[1] ? [readingExercises[1]] : [];
  const listeningAk = parseAkSection(akText, 'LISTENING', ['SPEAKING', 'Speaking']);

  const gBlock = extractTestSection(testText, 'GRAMMAR', ['VOCABULARY', 'Vocabulary']);
  const vBlock = extractTestSection(testText, 'VOCABULARY', ['PRONUNCIATION', 'Pronunciation']);
  const pBlock = extractTestSection(testText, 'PRONUNCIATION', ['Reading', 'READING', 'Grammar, Vocabulary']) ||
    extractTestSection(testText, 'Pronunciation', ['Reading', 'READING']);
  const rBlock = extractTestSection(testText, 'READING', ['WRITING', 'Writing']);
  const lBlock = extractTestSection(testText, 'LISTENING', ['SPEAKING', 'Speaking']);

  const gParts = splitTestExercises(gBlock);
  const vParts = splitTestExercises(vBlock);
  const pParts = splitTestExercises(pBlock);
  const lParts = splitTestExercises(lBlock);

  for (const ex of grammarAk) {
    const testEx = gParts.find((p) => p.num === ex.num)?.text || '';
    const { instructionHtml, questions } = buildExerciseQuestions(ex, testEx, 'g', 'grammar');
    sections.push({
      id: `section-grammar-${ex.num}`,
      title: `Grammar ${ex.num}`,
      questions,
      html: instructionHtml + questions.map((q) => q.html).join('\n'),
    });
  }

  for (const ex of vocabAk) {
    const testEx = vParts.find((p) => p.num === ex.num)?.text || '';
    const { instructionHtml, questions } = buildExerciseQuestions(ex, testEx, 'v', 'vocab');
    sections.push({
      id: `section-vocab-${ex.num}`,
      title: `Vocabulary ${ex.num}`,
      questions,
      html: instructionHtml + questions.map((q) => q.html).join('\n'),
    });
  }

  for (const ex of pronAk) {
    ex.items = ex.items.filter(
      (it) => !/:\s*[a-z]+/i.test(it.answer) && !/musician.*option/i.test(it.answer)
    );
    const testEx = pParts.find((p) => p.num === ex.num)?.text || '';
    const { instructionHtml, questions } = buildExerciseQuestions(ex, testEx, 'p', 'pron');
    sections.push({
      id: `section-pronunciation-${ex.num}`,
      title: `Pronunciation ${ex.num}`,
      questions,
      html: instructionHtml + questions.map((q) => q.html).join('\n'),
    });
  }

  const passage = extractReadingPassage(testText);
  const readingQuestions = [];
  let readingHtml = '';

  if (readingAk1.length) {
    const ex = readingAk1[0];
    const testEx = splitReadingPart1(rBlock);
    const readingMc = extractAllReadingMcQuestions(testEx);
    const itemLines = extractItemLines(testEx);
    const isTfds = hasDoesntSay(testEx);
    readingHtml += '<h3>Part 1</h3>';
    for (const item of ex.items) {
      const id = `r1_${item.num}`;
      const answers = altAnswers(item.answer);
      const mc = readingMc.get(item.num);
      const promptRaw =
        mc?.prompt ||
        itemLines.get(item.num) ||
        extractReadingQuestion(testEx, item.num).prompt ||
        promptOrFallback(testEx, item.num, item.answer);
      const inlineMc = parseInlineMcFromPrompt(promptRaw);
      const prompt = inlineMc.prompt || promptRaw;
      const type = isTfds || mc?.isTfds ? 'tfds' : 'mc3';
      const opts = isTfds || mc?.isTfds
        ? [
            { letter: 'A', text: 'True' },
            { letter: 'B', text: 'False' },
            { letter: 'C', text: "Doesn't say" },
          ]
        : inlineMc.options.length >= 2
          ? inlineMc.options
          : mc?.options?.length >= 2
            ? mc.options
            : extractMcQuestion(testEx, item.num).options.length >= 2
              ? extractMcQuestion(testEx, item.num).options
              : extractReadingQuestion(testEx, item.num).options;
      const html = radioMcHtml(
        id,
        prompt,
        opts.length >= 2 ? opts : [
          { letter: 'A', text: 'A' },
          { letter: 'B', text: 'B' },
          { letter: 'C', text: 'C' },
        ],
        item.num
      );
      readingQuestions.push({ id, type, answers, html });
      readingHtml += html;
    }
  }

  if (readingAk2.length) {
    const ex = readingAk2[0];
    const testEx = splitReadingPart2(rBlock);
    const itemLines = extractItemLines(testEx);
    for (const [num, prompt] of extractReadingPart2Questions(testEx)) {
      itemLines.set(num, prompt);
    }
    const isLetterMatch = ex.items.every((it) => /^[A-Z]$/i.test(it.answer.trim()));
    readingHtml += '<h3>Part 2</h3>';
    for (const item of ex.items) {
      const id = `r2_${item.num}`;
      const answers = altAnswers(item.answer);
      const type = inferType(item.answer, testEx);
      const prompt = itemLines.get(item.num) || promptOrFallback(testEx, item.num, item.answer);
      let html = '';
      if (type === 'tf') {
        html = `<div class="q-item"><p>${item.num}. ${escapeHtml(prompt)}</p><div class="radio-group"><label><input type="radio" name="${id}" value="T"> True</label><label><input type="radio" name="${id}" value="F"> False</label></div></div>`;
      } else if (isLetterMatch && /Write [A-Z] for/i.test(testEx)) {
        html = `<div class="q-item"><p>${item.num}. ${escapeHtml(prompt)}</p><input type="text" name="${id}" class="answer-input" maxlength="1" placeholder="K / S / M" style="max-width:4rem!important"></div>`;
      } else {
        html = textInputHtml(id, prompt, item.num, 'Short answer');
      }
      readingQuestions.push({ id, type, answers, html });
      readingHtml += html;
    }
  }

  if (readingQuestions.length) {
    sections.push({
      id: 'section-reading',
      title: 'Reading',
      questions: readingQuestions,
      passage,
      html: readingHtml,
      readingLayout: true,
    });
  }

  const writingPrompt = extractWritingPrompt(testText);
  sections.push({
    id: 'section-writing',
    title: 'Writing',
    questions: [],
    html: `<div class="question-block"><h3>${escapeHtml(writingPrompt.replace(/\n/g, ' '))}</h3><textarea name="writing" class="writing-area answer-input" rows="6" placeholder="Write here (100–150 words)..."></textarea><p style="font-size:0.85rem;color:#64748B;margin-top:0.5rem;">This section is reviewed manually.</p></div>`,
  });

  for (const ex of listeningAk) {
    const testEx = lParts.find((p) => p.num === ex.num)?.text || '';
    const { instructionHtml, questions } = buildExerciseQuestions(ex, testEx, 'l', 'listening');
    sections.push({
      id: `section-listening-${ex.num}`,
      title: `Listening ${ex.num}`,
      questions,
      html: instructionHtml + questions.map((q) => q.html).join('\n'),
      listeningPart: ex.num,
    });
  }

  sections.push({
    id: 'section-details',
    title: 'Your Information',
    questions: [],
    html: '',
    isRegistration: true,
  });

  return sections;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderHtml(meta, sections, audioPaths) {
  const sectionIds = sections.map((s) => s.id);
  const answerKey = {};
  for (const sec of sections) {
    for (const q of sec.questions || []) {
      answerKey[q.id] = q.answers;
    }
  }

  const sectionHtml = sections
    .map((sec, idx) => {
      if (sec.isRegistration) {
        return `
            <section class="test-section" id="section-details">
                <div class="section-title"><h2>Final Step: Your Information</h2></div>
                <div class="q-item">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
                        <div><label style="display:block;margin-bottom:0.35rem;font-weight:600;">First Name *</label><input type="text" id="regFirstName" class="answer-input" required></div>
                        <div><label style="display:block;margin-bottom:0.35rem;font-weight:600;">Last Name *</label><input type="text" id="regLastName" class="answer-input" required></div>
                        <div><label style="display:block;margin-bottom:0.35rem;font-weight:600;">Proposed Group *</label><input type="text" id="regGroup" class="answer-input" value="${escapeHtml(meta.groupDefault)}" required></div>
                        <div><label style="display:block;margin-bottom:0.35rem;font-weight:600;">Phone Number *</label><input type="tel" id="regPhone" class="answer-input" value="+998 " required></div>
                    </div>
                </div>
                <div class="flex-between">
                    <button type="button" class="btn btn-outline" onclick="nextUnitSection(${idx - 1})"><i class="fa-solid fa-arrow-left"></i> Previous</button>
                    <button type="button" class="btn btn-primary btn-submit" onclick="submitTest()">Finish & Submit <i class="fa-solid fa-paper-plane"></i></button>
                </div>
            </section>`;
      }

      let audioTag = '';
      if (sec.listeningPart && audioPaths[sec.listeningPart - 1]) {
        audioTag = `<audio controls class="listening-audio" style="width:100%;margin-bottom:1.5rem;border-radius:10px;"><source src="${audioPaths[sec.listeningPart - 1]}" type="audio/mpeg"></audio>`;
      }

      const passageHtml = sec.passage
        ? `<div class="reading-split"><div class="reading-passages"><p>${escapeHtml(sec.passage).replace(/\n\n/g, '</p><p>').replace(/\n/g, ' ')}</p></div><div class="reading-questions">`
        : '<div class="question-block">';
      const passageClose = sec.passage ? '</div></div>' : '</div>';

      const active = idx === 0 ? ' active' : '';
      const prev = idx > 0 ? `<button type="button" class="btn btn-outline" onclick="nextUnitSection(${idx - 1})"><i class="fa-solid fa-arrow-left"></i> Previous</button>` : '<span></span>';
      const nextLabel = idx === sections.length - 2 ? 'Final Step <i class="fa-solid fa-user-check"></i>' : 'Next Section <i class="fa-solid fa-arrow-right"></i>';
      const next = idx < sections.length - 1 ? `<button type="button" class="btn btn-primary" onclick="nextUnitSection(${idx + 1})">${nextLabel}</button>` : '';

      return `
            <section class="test-section${active}" id="${sec.id}">
                <div class="section-title">
                    <h2>${escapeHtml(sec.title)}</h2>
                </div>
                ${audioTag}
                ${passageHtml}
                ${sec.html}
                ${passageClose}
                <div class="flex-between" style="margin-top:1.5rem;">
                    ${prev}
                    ${next}
                </div>
            </section>`;
    })
    .join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(meta.title)} - EDU LIFE</title>
    <link rel="icon" type="image/png" href="image.png">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Outfit:wght@700;800;900&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <link rel="stylesheet" href="styles.css">
    <style>
        :root { --primary: ${PRIMARY}; --primary-dark: ${PRIMARY_DARK}; --primary-light: ${PRIMARY_LIGHT}; --text-muted: #64748B; }
        body { font-family: 'Inter', sans-serif; background: #F8FAFC; color: #1E293B; line-height: 1.6; }
        .test-container { max-width: 1100px; margin: 2rem auto; padding: 0 1.5rem; }
        .test-header { background: #fff; padding: 2.5rem; border-radius: 24px; box-shadow: 0 4px 6px -1px rgba(0,0,0,.1); margin-bottom: 2rem; text-align: center; border-bottom: 4px solid var(--primary); }
        .test-section { background: #fff; padding: 2.5rem; border-radius: 24px; box-shadow: 0 4px 6px -1px rgba(0,0,0,.1); margin-bottom: 2rem; display: none; }
        .test-section.active { display: block; }
        .section-title { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1rem; margin-bottom: 2rem; padding-bottom: 1rem; border-bottom: 2px solid #F1F5F9; }
        .section-title h2 { font-family: 'Outfit', sans-serif; font-size: 1.5rem; color: var(--primary-dark); margin: 0; }
        .question-block h3, .reading-questions h3 { font-size: 1.05rem; margin: 0 0 1rem; color: var(--primary-dark); }
        .q-item { margin-bottom: 1rem; padding: 1rem 1.25rem; border-radius: 12px; background: #F8FAFC; border: 1px solid #E2E8F0; }
        .q-item p { font-weight: 500; margin-bottom: 0.75rem; }
        .test-section .answer-input:not(.inline-input), .test-section select.answer-input, .test-section textarea.answer-input {
            display: block; width: 100% !important; max-width: 100% !important; box-sizing: border-box;
            border: 2px solid #E2E8F0 !important; border-radius: 10px !important; background: #fff !important;
            padding: 0.65rem 0.9rem !important; font-size: 1rem !important; letter-spacing: normal !important; margin-top: 0.35rem;
        }
        .test-section input.answer-input[type="text"]:not(.inline-input) { max-width: 28rem !important; }
        .test-section .q-item > p .inline-input {
            display: inline-block !important; width: auto !important; min-width: 3.5rem !important; max-width: 9rem !important;
            margin: 0 0.1rem !important; padding: 0.15rem 0.35rem !important;
            border: none !important; border-bottom: 2px solid var(--primary) !important; border-radius: 0 !important;
            background: transparent !important; vertical-align: baseline; box-shadow: none !important;
        }
        .test-section .q-item > p .inline-input-wide { min-width: 6rem !important; max-width: 11rem !important; }
        .test-section .q-item > p:has(.inline-input) { line-height: 2.1; margin-bottom: 0.35rem; }
        .test-section textarea.writing-area { min-height: 8rem; max-height: 16rem; resize: vertical; }
        .word-bank { display: flex; flex-wrap: wrap; gap: 0.5rem; padding: 0.75rem 1rem; margin-bottom: 1rem; background: #fff; border: 1px dashed var(--primary); border-radius: 10px; font-size: 0.95rem; }
        .match-options { font-size: 0.9rem; color: var(--text-muted); margin-bottom: 1rem; padding: 0.75rem 1rem; background: #fff; border-radius: 10px; border: 1px solid #E2E8F0; }
        .match-options div { margin-bottom: 0.35rem; }
        .radio-group { display: flex; flex-direction: column; gap: 0.5rem; }
        .radio-group label { display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem 1rem; background: #fff; border: 2px solid #E2E8F0; border-radius: 10px; cursor: pointer; font-weight: 400; }
        .radio-group label:hover { border-color: var(--primary); background: var(--primary-light); }
        .radio-group input { width: 1.1rem; height: 1.1rem; accent-color: var(--primary); }
        .reading-split { display: grid; grid-template-columns: minmax(280px, 1fr) minmax(300px, 1fr); gap: 1.5rem; align-items: start; }
        .reading-passages { background: #fff; padding: 1.5rem; border-radius: 12px; border-left: 4px solid var(--primary); max-height: min(70vh, 28rem); overflow-y: auto; line-height: 1.7; font-size: 1.02rem; }
        .reading-questions { max-height: min(70vh, 28rem); overflow-y: auto; }
        .btn { padding: 0.75rem 1.5rem; border-radius: 12px; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; gap: 0.5rem; border: none; }
        .btn-primary { background: var(--primary); color: #fff; }
        .btn-outline { background: #fff; border: 2px solid #E2E8F0; color: var(--text-muted); }
        .flex-between { display: flex; justify-content: space-between; align-items: center; gap: 1rem; flex-wrap: wrap; }
        .progress-nav { position: sticky; top: 0; background: rgba(255,255,255,0.95); backdrop-filter: blur(10px); padding: 1rem 0; z-index: 100; border-bottom: 1px solid #E2E8F0; }
        .progress-container { max-width: 1100px; margin: 0 auto; padding: 0 1.5rem; display: flex; align-items: center; gap: 1.5rem; }
        .progress-bg { flex-grow: 1; height: 10px; background: #E2E8F0; border-radius: 5px; overflow: hidden; }
        .progress-bar { height: 100%; background: var(--primary); width: 0%; transition: width 0.4s ease; }
        @media (max-width: 900px) { .reading-split { grid-template-columns: 1fr; } .reading-passages, .reading-questions { max-height: none; } }
    </style>
</head>
<body>
    <nav class="progress-nav">
        <div class="progress-container">
            <div class="progress-bg"><div class="progress-bar" id="progressBar"></div></div>
            <span id="progressText" style="font-weight:600;color:var(--primary);">Step 1</span>
        </div>
    </nav>
    <main class="test-container">
        <div class="test-header">
            <h1 style="color:var(--primary);">${escapeHtml(meta.title)}</h1>
            <p>${escapeHtml(meta.subtitle)}</p>
        </div>
        <form id="unitTestForm">
${sectionHtml}
            <section class="test-section" id="section-result">
                <div style="text-align:center;padding:3rem 0;">
                    <i class="fa-solid fa-circle-check" style="font-size:5rem;color:var(--primary);margin-bottom:2rem;"></i>
                    <h2>Test Submitted!</h2>
                    <p id="resultFeedback" style="color:#64748B;">Calculating your score...</p>
                    <button type="button" class="btn btn-primary" onclick="window.location.href='tests.html'">Back to Tests</button>
                </div>
            </section>
        </form>
    </main>
    <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
    <script src="supabase-config.js"></script>
    <script src="auth.js"></script>
    <script src="script.js"></script>
    <script>
        if (!localStorage.getItem('currentUser')) { window.location.href = 'login.html'; }
        const unitSections = ${JSON.stringify(sectionIds.filter((id) => id !== 'section-result'))};
        const answerKey = ${JSON.stringify(answerKey)};

        function nextUnitSection(idx) {
            document.querySelectorAll('.test-section').forEach(s => s.classList.remove('active'));
            if (idx >= unitSections.length) return;
            document.getElementById(unitSections[idx]).classList.add('active');
            const bar = document.getElementById('progressBar');
            const txt = document.getElementById('progressText');
            if (bar) bar.style.width = ((idx + 1) / unitSections.length * 100) + '%';
            if (txt) txt.innerText = 'Step ' + (idx + 1) + ' of ' + unitSections.length;
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }

        function normalize(s) {
            if (!s) return '';
            return s.toString().trim().toLowerCase()
                .replace(/['']/g, "'").replace(/[?!.,;:"()]/g, '').replace(/\\s+/g, ' ');
        }

        function checkAnswer(userVal, accepted) {
            const u = normalize(userVal);
            if (!u) return false;
            return accepted.some((a) => {
                const c = normalize(a);
                if (u === c) return true;
                if (/^[a-gtflh]$/.test(c) && u === c) return true;
                const parts = a.replace(/…/g, '...').split(/\\s*\\.\\.\\.\\s*/).map((p) => normalize(p)).filter(Boolean);
                if (parts.length >= 2 && parts.every((p) => u.includes(p))) return true;
                if (c.length >= 4 && (u.includes(c) || c.includes(u))) return true;
                return false;
            });
        }

        async function submitTest() {
            const firstName = document.getElementById('regFirstName').value.trim();
            const lastName = document.getElementById('regLastName').value.trim();
            const group = document.getElementById('regGroup').value.trim();
            const phone = document.getElementById('regPhone').value.trim();
            if (!firstName || !lastName || !group || !phone) { alert('Please fill in all required fields!'); return; }

            const btn = document.querySelector('.btn-submit');
            if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Submitting...'; }

            let score = 0;
            const answers = new FormData(document.getElementById('unitTestForm'));
            for (const id in answerKey) {
                const userVal = answers.get(id);
                if (checkAnswer(userVal, answerKey[id])) score++;
            }

            if (window.eduSupabase) {
                await window.eduSupabase.from('submissions').insert([{
                    student_name: firstName + ' ' + lastName,
                    test_type: ${JSON.stringify(meta.testType)},
                    score: score,
                    group_name: group,
                    phone: phone,
                    raw_answers: Object.fromEntries(answers.entries())
                }]);
            }

            document.querySelectorAll('.test-section').forEach(s => s.classList.remove('active'));
            document.getElementById('section-result').classList.add('active');
            document.getElementById('resultFeedback').innerText = 'Thank you, ' + firstName + '! Auto-graded score: ' + score + ' points (writing reviewed separately).';
            setTimeout(() => { window.location.href = 'tests.html'; }, 5000);
        }
    </script>
</body>
</html>`;
}

function unitSourcePaths(n) {
  const folder = path.join(SOURCE_ROOT, `ef5e_pre_int_file_${n}_test_a_b`);
  const p = pad2(n);
  const mp3s = fs.existsSync(folder)
    ? fs.readdirSync(folder).filter((f) => f.toLowerCase().endsWith('.mp3')).sort()
    : [];
  return {
    folder,
    testPdf: path.join(folder, `EF5e_Pre_Int_File_Test_${p}a.pdf`),
    akPdf: path.join(folder, `EF5e_Pre_Int_File_Test_${p}a_AK.pdf`),
    mp3s: mp3s.map((f) => path.join(folder, f)),
  };
}

function validateSections(sections, label) {
  let bad = 0;
  for (const sec of sections) {
    for (const q of sec.questions || []) {
      if (/Complete \(\d+\)|\bItem \d+\b|Choose option [A-G]\b/i.test(q.html)) bad++;
    }
  }
  if (bad > 0) console.warn(`  ${label}: ${bad} placeholder prompts`);
  return bad;
}

async function buildUnit(n) {
  if (n === 1) {
    console.log('Skipping unit 1 — hand-crafted template (unit1-pre-intermediate.html)');
    return;
  }
  const src = unitSourcePaths(n);
  const audioDir = path.join(AUDIO_ROOT, `unit_${n}`);
  const audioRel = [];
  src.mp3s.slice(0, 2).forEach((mp3, i) => {
    const dest = path.join(audioDir, `listening_${i + 1}.mp3`);
    copyFile(mp3, dest);
    audioRel.push(`Listenings/pre-intermediate/unit_${n}/listening_${i + 1}.mp3`);
  });

  const testText = await extractPdf(src.testPdf, path.join(EXTRACTED, `unit${n}_test.txt`));
  const akText = await extractPdf(src.akPdf, path.join(EXTRACTED, `unit${n}_ak.txt`));
  const sections = buildSections(testText, akText);
  validateSections(sections, `Unit ${n}`);
  const html = renderHtml(
    {
      title: `Pre-intermediate Unit Test ${n}`,
      subtitle: `File ${n} — Variant A (no speaking section)`,
      testType: `Pre-intermediate Unit Test ${n}`,
      groupDefault: `Pre-intermediate Unit ${n}`,
    },
    sections,
    audioRel
  );
  const out = path.join(ROOT, `unit${n}-pre-intermediate.html`);
  fs.writeFileSync(out, html, 'utf8');
  console.log('Built', out);
}

async function buildProgress(num, folder, testName, pdfBase, audioBase) {
  const folderPath = path.join(SOURCE_ROOT, folder);
  const testPdf = path.join(folderPath, `${pdfBase}a.pdf`);
  const akPdf = path.join(folderPath, `${pdfBase}a_AK.pdf`);
  const audioDir = path.join(AUDIO_ROOT, `progress_${num}`);
  const audios = fs.readdirSync(folderPath).filter((f) => f.toLowerCase().endsWith('.mp3'));
  const audioPaths = [];
  audios.slice(0, 2).forEach((f, i) => {
    const dest = path.join(audioDir, `listening_${i + 1}.mp3`);
    copyFile(path.join(folderPath, f), dest);
    audioPaths.push(`Listenings/pre-intermediate/progress_${num}/listening_${i + 1}.mp3`);
  });

  const testText = await extractPdf(testPdf, path.join(EXTRACTED, `progress${num}_test.txt`));
  const akText = await extractPdf(akPdf, path.join(EXTRACTED, `progress${num}_ak.txt`));
  const sections = buildSections(testText, akText);
  validateSections(sections, testName);
  const html = renderHtml(
    {
      title: testName,
      subtitle: 'Variant A — Files ' + (num === 1 ? '1–6' : '7–12'),
      testType: testName,
      groupDefault: testName,
    },
    sections,
    audioPaths
  );
  const out = path.join(ROOT, `pre-intermediate-progress-test-${num}.html`);
  fs.writeFileSync(out, html, 'utf8');
  console.log('Built', out);
}

async function buildEndTest() {
  const folderPath = path.join(SOURCE_ROOT, 'ef5e_pre_int_end_of_course_test_a_b');
  const testPdf = path.join(folderPath, 'EF5e_Pre_Int_End_Test_A.pdf');
  const akPdf = path.join(folderPath, 'EF5e_Pre_Int_End_Test_A_AK.pdf');
  const audioDir = path.join(AUDIO_ROOT, 'end_test');
  const mp3s = fs.readdirSync(folderPath).filter((f) => f.toLowerCase().endsWith('.mp3'));
  const audioPaths = [];
  mp3s.slice(0, 2).forEach((f, i) => {
    const dest = path.join(audioDir, `listening_${i + 1}.mp3`);
    copyFile(path.join(folderPath, f), dest);
    audioPaths.push(`Listenings/pre-intermediate/end_test/listening_${i + 1}.mp3`);
  });

  const testText = await extractPdf(testPdf, path.join(EXTRACTED, 'end_test.txt'));
  const akText = await extractPdf(akPdf, path.join(EXTRACTED, 'end_ak.txt'));
  const sections = buildSections(testText, akText);
  validateSections(sections, 'End test');
  const html = renderHtml(
    {
      title: 'Pre-intermediate End of Course Test',
      subtitle: 'Variant A — End of course examination',
      testType: 'Pre-intermediate End of Course Test',
      groupDefault: 'Pre-intermediate End Test',
    },
    sections,
    audioPaths
  );
  const out = path.join(ROOT, 'pre-intermediate-test.html');
  fs.writeFileSync(out, html, 'utf8');
  console.log('Built', out);
}

async function main() {
  if (!fs.existsSync(SOURCE_ROOT)) {
    console.error('Source not found:', SOURCE_ROOT);
    process.exit(1);
  }
  for (let n = 1; n <= 12; n++) await buildUnit(n);
  await buildProgress(1, 'ef5e_pre_int_progress_test_1_6_a_b', 'Pre-intermediate Progress Test 1', 'EF5e_Pre_Int_Progress_Test_1_6', 'EF5e_Pre_Int_Progress_Test_1_6');
  await buildProgress(2, 'ef5e_pre_int_progress_test_7_12_a_b', 'Pre-intermediate Progress Test 2', 'EF5e_Pre_Int_Progress_Test_7_12', 'EF5e_Pre_Int_Progress_Test_7_12');
  await buildEndTest();
  console.log('All pre-intermediate tests built.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
