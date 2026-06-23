import fs from 'fs';
import path from 'path';
import { PDFParse } from 'pdf-parse';

const [input, output] = process.argv.slice(2);
if (!input || !output) {
  console.error('Usage: node scripts/extract-pdf-text.mjs <input.pdf> <output.txt>');
  process.exit(1);
}

const buffer = fs.readFileSync(input);
const parser = new PDFParse({ data: buffer });
const result = await parser.getText();
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, result.text, 'utf8');
console.log(`Wrote ${output} (${result.text.length} chars)`);
