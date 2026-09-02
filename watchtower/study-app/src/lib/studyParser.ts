import DOMPurify from "dompurify";
import { marked } from "marked";
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.mjs?url";
import type { LoadedStudy, StudyFile, StudyPackage, StudyQuestion } from "../types";

GlobalWorkerOptions.workerSrc = pdfWorker;

type QuestionDraft = {
  number: string;
  questionEn: string;
  questionTl: string;
  directEn?: string;
  directTl?: string;
  deeperEn?: string;
  deeperTl?: string;
  paragraphEn?: string;
  paragraphTl?: string;
};

export async function loadStudyFile(file: StudyFile): Promise<LoadedStudy> {
  if (file.kind === "package") {
    const response = await fetch(file.path);
    if (!response.ok) {
      throw new Error(`Could not load ${file.name}: ${response.status}`);
    }
    return parseStudyPackage(await response.json() as StudyPackage);
  }

  if (file.kind === "pdf") {
    const text = await extractPdfText(file.path);
    const parsed = readPlainTextQuestionBlocks(text);
    if (parsed.length) {
      return {
        kind: "study",
        sourceKind: "html",
        title: file.name,
        meta: ["Parsed from PDF text"],
        questions: parsed,
      };
    }
    return { kind: "pdf", title: file.name, url: file.path };
  }

  const response = await fetch(file.path);
  if (!response.ok) {
    throw new Error(`Could not load ${file.name}: ${response.status}`);
  }

  const source = await response.text();
  return file.kind === "markdown"
    ? parseMarkdownStudy(source)
    : parseHtmlStudy(source);
}

export function parseStudyPackage(pkg: StudyPackage): LoadedStudy {
  if (pkg.schema !== "jw-study-package/v1") {
    throw new Error("Unsupported study package format.");
  }
  validateStudyPackage(pkg);

  return {
    kind: "study",
    sourceKind: "package",
    title: pkg.title,
    meta: pkg.meta ?? [],
    questions: pkg.questions.map((question, index) => ({
      id: question.id ?? `q-${index + 1}`,
      number: question.number,
      questionEn: question.question.en ?? "",
      questionTl: question.question.tl ?? "",
      direct: {
        en: question.direct.en ?? "",
        tl: question.direct.tl ?? "",
      },
      deeper: {
        en: question.deeper.en ?? "",
        tl: question.deeper.tl ?? "",
      },
      paragraph: question.paragraph
        ? {
            en: question.paragraph.en ?? "",
            tl: question.paragraph.tl ?? "",
          }
        : undefined,
    })),
  };
}

export function validateStudyPackage(pkg: StudyPackage) {
  const repeated = new Set<string>();

  for (const question of pkg.questions) {
    for (const language of ["en", "tl"] as const) {
      const direct = normalizeForValidation(question.direct[language]);
      const deeper = normalizeForValidation(question.deeper[language]);
      const paragraph = normalizeForValidation(question.paragraph?.[language]);

      if (direct.length > 120 && paragraph.startsWith(direct)) {
        throw new Error(`Question ${question.number} has an answer copied from the paragraph.`);
      }

      if (deeper.length > 80) {
        const key = `${language}:${deeper}`;
        if (repeated.has(key)) {
          throw new Error("This package has repeated deeper answers and needs to be regenerated.");
        }
        repeated.add(key);
      }
    }
  }
}

async function extractPdfText(path: string) {
  const loadingTask = getDocument(path);
  const pdf = await loadingTask.promise;
  const lines: string[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .filter(Boolean)
      .join(" ");
    lines.push(pageText);
  }

  return lines.join("\n");
}

export async function parseMarkdownStudy(source: string): Promise<LoadedStudy> {
  const title = source.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? "Watchtower Study";
  const meta = Array.from(source.matchAll(/^\*(.+)\*$/gm)).map((match) => stripMarkdown(match[1]));
  const questions = readMarkdownQuestionBlocks(source);
  if (questions.length) {
    return {
      kind: "study",
      sourceKind: "markdown",
      title,
      meta,
      questions,
    };
  }

  const html = await marked.parse(source);
  const doc = toDocument(html);
  return {
    kind: "study",
    sourceKind: "markdown",
    title,
    meta,
    questions: readRenderedQuestionBlocks(doc),
  };
}

function readMarkdownQuestionBlocks(source: string) {
  const drafts: QuestionDraft[] = [];
  let current: QuestionDraft | undefined;

  source.split(/\r?\n/).forEach((line) => {
    const question = line.match(/^>\s+\*<sub>(?:\*\*(.+?)\*\*\s+)?(.+?)<\/sub>\*/);
    if (question) {
      const number = question[1]?.replace(/\.$/, "") || `Review ${drafts.filter((draft) => draft.number.startsWith("Review")).length + 1}`;
      const text = stripMarkdown(question[2]);
      if (!current || current.directEn || current.directTl || current.deeperEn || current.deeperTl) {
        current = {
          number,
          questionEn: text,
          questionTl: "",
        };
        drafts.push(current);
      } else {
        current.questionTl = text;
      }
      return;
    }

    if (!current) return;
    const answer = line.match(/^\*\*(ANS[12]\s*[-—]\s*(?:Direct|Deeper)\s*\((EN|TL)\):)\*\*\s*(.+)$/i);
    if (answer) {
      const label = answer[1].toLowerCase();
      const language = answer[2].toUpperCase();
      const text = stripMarkdown(answer[3]);
      if (label.includes("ans1") && language === "EN") current.directEn = text;
      if (label.includes("ans1") && language === "TL") current.directTl = text;
      if (label.includes("ans2") && language === "EN") current.deeperEn = text;
      if (label.includes("ans2") && language === "TL") current.deeperTl = text;
    }

    const paragraph = line.match(/^\*\*(Paragraph|Talata):\*\*\s*(.+)$/i);
    if (paragraph?.[1].toLowerCase() === "paragraph") current.paragraphEn = stripMarkdown(paragraph[2]);
    if (paragraph?.[1].toLowerCase() === "talata") current.paragraphTl = stripMarkdown(paragraph[2]);
  });

  return drafts
    .filter((draft) => draft.directEn || draft.directTl || draft.deeperEn || draft.deeperTl)
    .map(finalizeQuestion);
}

function readPlainTextQuestionBlocks(source: string) {
  const lines = source
    .replace(/\s+/g, " ")
    .split(/(?=\b(?:ANS[12]\s*[-—]\s*(?:Direct|Deeper)|\d+(?:-\d+)?[a-z]?\.\s))/i)
    .map((line) => line.trim())
    .filter(Boolean);
  const drafts: QuestionDraft[] = [];
  let current: QuestionDraft | undefined;

  lines.forEach((line) => {
    const question = line.match(/^(\d+(?:-\d+)?[a-z]?)\.\s+(.+?)(?=\s+ANS1\s*[-—]\s*Direct|\s+\d+(?:-\d+)?[a-z]?\.\s+|$)/i);
    if (question && !/^ANS/i.test(line)) {
      const text = question[2].trim();
      if (!current || current.directEn || current.directTl || current.deeperEn || current.deeperTl) {
        current = {
          number: question[1],
          questionEn: text,
          questionTl: "",
        };
        drafts.push(current);
      } else {
        current.questionTl = text;
      }
    }

    if (!current) return;
    const answer = line.match(/^(ANS[12]\s*[-—]\s*(?:Direct|Deeper))\s+(EN|TL)\s+(.+)$/i);
    if (answer) {
      const label = answer[1].toLowerCase();
      const language = answer[2].toUpperCase();
      const text = answer[3].trim();
      if (label.includes("ans1") && language === "EN") current.directEn = text;
      if (label.includes("ans1") && language === "TL") current.directTl = text;
      if (label.includes("ans2") && language === "EN") current.deeperEn = text;
      if (label.includes("ans2") && language === "TL") current.deeperTl = text;
    }
  });

  return drafts
    .filter((draft) => draft.directEn || draft.directTl || draft.deeperEn || draft.deeperTl)
    .map(finalizeQuestion);
}

export function parseHtmlStudy(source: string): LoadedStudy {
  const doc = toDocument(extractBody(source));
  const title = readTitle(doc);
  const meta = Array.from(doc.querySelectorAll("header .subtitle, .subtitle"))
    .map((element) => cleanText(element.textContent))
    .filter(Boolean);

  return {
    kind: "study",
    sourceKind: "html",
    title,
    meta,
    questions: readStyledQuestionBlocks(doc),
  };
}

function readStyledQuestionBlocks(doc: Document) {
  const blocks = Array.from(doc.querySelectorAll(".qa-block"));
  if (!blocks.length) return readRenderedQuestionBlocks(doc);

  return blocks.map((block, index) => {
    const questions = Array.from(block.querySelectorAll(".question"));
    const enQuestion = cleanText(questions[0]?.textContent);
    const tlQuestion = cleanText(questions.find((item) => item.classList.contains("tl"))?.textContent);
    const direct = block.querySelector(".ans.direct");
    const deeper = block.querySelector(".ans.deeper");
    const draft: QuestionDraft = {
      number: readNumber(enQuestion) || String(index + 1),
      questionEn: removeLeadingNumber(enQuestion),
      questionTl: removeLeadingNumber(tlQuestion),
      directEn: readAnswerLine(direct, "EN"),
      directTl: readAnswerLine(direct, "TL"),
      deeperEn: readAnswerLine(deeper, "EN"),
      deeperTl: readAnswerLine(deeper, "TL"),
      paragraphEn: readParagraph(block, "EN"),
      paragraphTl: readParagraph(block, "TL"),
    };
    return finalizeQuestion(draft, index);
  });
}

function readRenderedQuestionBlocks(doc: Document) {
  const drafts: QuestionDraft[] = [];
  const children = Array.from(doc.body.children);
  let current: QuestionDraft | undefined;

  children.forEach((child) => {
    const text = cleanText(child.textContent);
    if (!text) return;

    if (child.tagName === "BLOCKQUOTE") {
      const lines = Array.from(child.querySelectorAll("p")).map((p) => cleanText(p.textContent)).filter(Boolean);
      if (lines.length) {
        const en = lines[0] ?? "";
        const tl = lines[1] ?? "";
        const number = readNumber(en) || String(drafts.length + 1);
        current = {
          number,
          questionEn: removeLeadingNumber(en),
          questionTl: removeLeadingNumber(tl),
        };
        drafts.push(current);
      }
      return;
    }

    if (!current) return;
    if (/^ANS1\s*[-—]\s*Direct\s*\(EN\):/i.test(text)) current.directEn = readAfterColon(text);
    if (/^ANS1\s*[-—]\s*Direct\s*\(TL\):/i.test(text)) current.directTl = readAfterColon(text);
    if (/^ANS2\s*[-—]\s*Deeper\s*\(EN\):/i.test(text)) current.deeperEn = readAfterColon(text);
    if (/^ANS2\s*[-—]\s*Deeper\s*\(TL\):/i.test(text)) current.deeperTl = readAfterColon(text);
    if (/^Paragraph:/i.test(text)) current.paragraphEn = readAfterColon(text);
    if (/^Talata:/i.test(text)) current.paragraphTl = readAfterColon(text);
  });

  return drafts
    .filter((draft) => draft.directEn || draft.directTl || draft.deeperEn || draft.deeperTl)
    .map(finalizeQuestion);
}

function finalizeQuestion(draft: QuestionDraft, index: number): StudyQuestion {
  return {
    id: `q-${index + 1}`,
    number: draft.number,
    questionEn: draft.questionEn,
    questionTl: draft.questionTl,
    direct: {
      en: draft.directEn ?? "",
      tl: draft.directTl ?? "",
    },
    deeper: {
      en: draft.deeperEn ?? "",
      tl: draft.deeperTl ?? "",
    },
    paragraph:
      draft.paragraphEn || draft.paragraphTl
        ? {
            en: draft.paragraphEn ?? "",
            tl: draft.paragraphTl ?? "",
          }
        : undefined,
  };
}

function readAnswerLine(root: Element | null, language: "EN" | "TL") {
  if (!root) return "";
  const line = Array.from(root.querySelectorAll(".line")).find((candidate) => {
    const chip = candidate.querySelector(".chip");
    return cleanText(chip?.textContent).toUpperCase() === language;
  });
  return cleanText(line?.querySelector("p")?.textContent);
}

function readParagraph(root: Element, language: "EN" | "TL") {
  const languageClass = language === "EN" ? "en" : "tl";
  const paragraph =
    root.querySelector(`.paragraph.${languageClass}, .source-paragraph.${languageClass}, [data-paragraph="${language.toLowerCase()}"]`) ??
    root.querySelector(".paragraph, .source-paragraph, [data-paragraph]");
  return cleanText(paragraph?.textContent);
}

function toDocument(html: string) {
  const clean = DOMPurify.sanitize(html, {
    ADD_ATTR: ["data-paragraph"],
    ALLOWED_ATTR: ["class", "data-paragraph", "id"],
  });
  return new DOMParser().parseFromString(clean, "text/html");
}

function extractBody(html: string) {
  const match = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  return match ? match[1] : html;
}

function readTitle(doc: Document) {
  return cleanText(doc.querySelector("h1")?.textContent) || "Watchtower Study";
}

function readNumber(value: string) {
  return value.match(/^(\d+(?:-\d+)?[a-z]?\.?)/i)?.[1]?.replace(/\.$/, "") ?? "";
}

function removeLeadingNumber(value: string) {
  return value.replace(/^\d+(?:-\d+)?[a-z]?\.\s*/i, "").trim();
}

function readAfterColon(value: string) {
  return value.replace(/^.*?:\s*/, "").trim();
}

function stripMarkdown(value: string) {
  return value.replace(/\*\*/g, "").replace(/`/g, "").trim();
}

function cleanText(value: string | null | undefined) {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function normalizeForValidation(value: string | undefined) {
  return stripMarkdown(value ?? "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}
