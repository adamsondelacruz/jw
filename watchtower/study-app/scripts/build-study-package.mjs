import { readFile, writeFile } from "node:fs/promises";
import { basename } from "node:path";

const [markdownPath, outputPath, paragraphsPath = ""] = process.argv.slice(2);

if (!markdownPath || !outputPath) {
  console.error("Usage: node scripts/build-study-package.mjs ANSWERS_MD OUTPUT_JSON [PARAGRAPHS_JSON]");
  process.exit(1);
}

const markdown = await readFile(markdownPath, "utf8");
const paragraphs = paragraphsPath ? await readParagraphMap(paragraphsPath) : undefined;
const date = basename(markdownPath).slice(0, 10);
const title = markdown.match(/^#\s+(.+?)(?:\s+-\s+Bilingual.*)?$/m)?.[1]?.trim() ?? basename(markdownPath, ".md");
const week = markdown.match(/\*\*The Watchtower\s+-\s+.+?\|\s+(.+?)\*\*/)?.[1]?.trim() ?? "";
const meta = Array.from(markdown.matchAll(/^\*(.+)\*$/gm)).map((match) => stripMarkdown(match[1]));
const questions = parseMarkdownQuestions(markdown).map((question) => {
  const paragraph = paragraphs?.questions?.[question.number]?.paragraph;
  return {
    ...question,
    paragraph: {
      en: paragraph?.en ?? question.paragraph.en,
      tl: paragraph?.tl ?? question.paragraph.tl,
    },
  };
});

const studyPackage = {
  schema: "jw-study-package/v1",
  id: date,
  title,
  week,
  generatedAt: new Date().toISOString(),
  source: paragraphs?.source ?? {},
  meta,
  questions,
};

await writeFile(outputPath, `${JSON.stringify(studyPackage, null, 2)}\n`);
console.log(`Wrote ${questions.length} questions to ${outputPath}`);

async function readParagraphMap(path) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    console.warn(`Could not read paragraph map ${path}: ${error.message}`);
    return undefined;
  }
}

function parseMarkdownQuestions(source) {
  const questions = [];
  let current;

  for (const line of source.split(/\r?\n/)) {
    const question = line.match(/^>\s+\*<sub>(?:\*\*(.+?)\*\*\s+)?(.+?)<\/sub>\*/);
    if (question) {
      const number = question[1]?.replace(/\.$/, "") || `Review ${questions.filter((item) => item.number.startsWith("Review")).length + 1}`;
      const text = stripMarkdown(question[2]);
      if (!current || current.direct.en || current.direct.tl || current.deeper.en || current.deeper.tl) {
        current = {
          id: `q-${questions.length + 1}`,
          number,
          question: { en: text, tl: "" },
          direct: { en: "", tl: "" },
          deeper: { en: "", tl: "" },
          paragraph: { en: "", tl: "" },
        };
        questions.push(current);
      } else {
        current.question.tl = text;
      }
      continue;
    }

    if (!current) continue;

    const answer = line.match(/^\*\*(?:(?:\([a-z]\)\s*)?)(?:ANS[12]\s*[-—]\s*)?(Direct|Deeper)\s*\((EN|TL)\):\*\*\s*(.+)$/i);
    if (answer) {
      const label = answer[1].toLowerCase();
      const language = answer[2].toLowerCase();
      const text = stripMarkdown(answer[3]);
      if (label === "direct") current.direct[language] = joinAnswer(current.direct[language], text);
      if (label === "deeper") current.deeper[language] = joinAnswer(current.deeper[language], text);
      continue;
    }

    const paragraph = line.match(/^\*\*(Paragraph|Talata):\*\*\s*(.+)$/i);
    if (paragraph?.[1].toLowerCase() === "paragraph") current.paragraph.en = stripMarkdown(paragraph[2]);
    if (paragraph?.[1].toLowerCase() === "talata") current.paragraph.tl = stripMarkdown(paragraph[2]);
  }

  return questions.filter((question) => question.direct.en || question.direct.tl || question.deeper.en || question.deeper.tl);
}

function stripMarkdown(value) {
  return value
    .replace(/\*\*/g, "")
    .replace(/`/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function joinAnswer(current, next) {
  return current ? `${current}\n\n${next}` : next;
}
