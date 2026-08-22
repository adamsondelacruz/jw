import { readFileSync, writeFileSync } from "node:fs";

const [enPath, tlPath, outputPath, enUrl = "", tlUrl = ""] = process.argv.slice(2);

if (!enPath || !tlPath || !outputPath) {
  console.error("Usage: node scripts/extract-jw-paragraphs.mjs EN_HTML TL_HTML OUTPUT_JSON");
  process.exit(1);
}

function clean(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/g, "")
    .replace(/<style[\s\S]*?<\/style>/g, "")
    .replace(/<span[^>]*class="[^"]*pageNum[^"]*"[\s\S]*?<\/span>/g, "")
    .replace(/<span[^>]*class="[^"]*parNum[^"]*"[\s\S]*?<\/span>/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&rsquo;/g, "’")
    .replace(/&lsquo;/g, "‘")
    .replace(/&ldquo;/g, "“")
    .replace(/&rdquo;/g, "”")
    .replace(/&mdash;/g, "—")
    .replace(/&ndash;/g, "–")
    .replace(/&shy;/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseArticle(path) {
  const html = readFileSync(path, "utf8");
  const questions = [];
  const questionPattern = /<p[^>]*data-pid="(\d+)"[^>]*class="qu"[^>]*>([\s\S]*?)<\/p>/g;
  let match;

  while ((match = questionPattern.exec(html))) {
    const pid = match[1];
    const text = clean(match[2]);
    const number = text.match(/^(\d+(?:-\d+)?[a-z]?)\./)?.[1];
    if (!number) continue;
    questions.push({
      pid,
      number,
      question: text.replace(/^\d+(?:-\d+)?[a-z]?\.\s*/, ""),
    });
  }

  const output = {};
  for (const question of questions) {
    const rel = `data-rel-pid="[${question.pid}]"`;
    const paragraphPattern = new RegExp(`<p[^>]*${escapeRegExp(rel)}[^>]*>([\\s\\S]*?)<\\/p>`, "g");
    const paragraphs = [];
    let paragraphMatch;
    while ((paragraphMatch = paragraphPattern.exec(html))) {
      paragraphs.push(clean(paragraphMatch[1]));
    }
    output[question.number] = {
      question: question.question,
      paragraph: paragraphs.join("\n\n"),
    };
  }

  return output;
}

const en = parseArticle(enPath);
const tl = parseArticle(tlPath);
const numbers = Array.from(new Set([...Object.keys(en), ...Object.keys(tl)]));

const output = {
  source: {
    en: enUrl,
    tl: tlUrl,
  },
  questions: Object.fromEntries(
    numbers.map((number) => [
      number,
      {
        question: {
          en: en[number]?.question ?? "",
          tl: tl[number]?.question ?? "",
        },
        paragraph: {
          en: en[number]?.paragraph ?? "",
          tl: tl[number]?.paragraph ?? "",
        },
      },
    ]),
  ),
};

writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`);
console.log(`Wrote ${numbers.length} paragraph entries to ${outputPath}`);
