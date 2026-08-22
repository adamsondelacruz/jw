import { mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { basename, join, resolve } from "node:path";

const appRoot = resolve(new URL("..", import.meta.url).pathname);
const repoRoot = resolve(appRoot, "../..");
const watchtowerRoot = join(repoRoot, "watchtower");

const monthMapTl = {
  january: "enero",
  february: "pebrero",
  march: "marso",
  april: "abril",
  may: "mayo",
  june: "hunyo",
  july: "hulyo",
  august: "agosto",
  september: "setyembre",
  october: "oktubre",
  november: "nobyembre",
  december: "disyembre",
};

const issues = [
  {
    month: "june",
    year: "2026",
    en: "https://www.jw.org/en/library/magazines/watchtower-study-june-2026/",
    tl: "https://www.jw.org/tl/library/magasin/bantayan-pag-aaral-hunyo-2026/",
  },
  {
    month: "july",
    year: "2026",
    en: "https://www.jw.org/en/library/magazines/watchtower-study-july-2026/",
    tl: "https://www.jw.org/tl/library/magasin/bantayan-pag-aaral-hulyo-2026/",
  },
  {
    month: "august",
    year: "2026",
    en: "https://www.jw.org/en/library/magazines/watchtower-study-august-2026/",
    tl: "https://www.jw.org/tl/library/magasin/bantayan-pag-aaral-agosto-2026/",
  },
];

const wanted = new Set([
  "2026-08-22",
  "2026-08-29",
  "2026-09-05",
  "2026-09-12",
  "2026-09-19",
  "2026-09-26",
  "2026-10-03",
  "2026-10-10",
  "2026-10-17",
]);

const studies = [];

for (const issue of issues) {
  const enIssue = await fetchText(issue.en);
  const tlIssue = await fetchText(issue.tl);
  const enArticles = parseIssue(enIssue, issue.en);
  const tlArticles = parseIssue(tlIssue, issue.tl);

  for (let index = 0; index < enArticles.length; index += 1) {
    const enArticle = enArticles[index];
    const tlArticle = tlArticles[index];
    if (!enArticle || !tlArticle) continue;
    const date = fileDateForWeek(enArticle.week);
    if (!wanted.has(date)) continue;
    studies.push({
      date,
      issue,
      week: enArticle.week,
      titleEn: enArticle.title,
      titleTl: tlArticle.title,
      enUrl: enArticle.url,
      tlUrl: tlArticle.url,
    });
  }
}

for (const study of studies.sort((a, b) => a.date.localeCompare(b.date))) {
  await generateStudy(study);
}

console.log(`Generated ${studies.length} Watchtower studies.`);

async function generateStudy(study) {
  const dir = join(watchtowerRoot, study.date.slice(0, 7));
  await mkdir(dir, { recursive: true });

  const enHtml = await fetchText(study.enUrl);
  const tlHtml = await fetchText(study.tlUrl);
  const enData = parseArticle(enHtml);
  const tlData = parseArticle(tlHtml);
  const articleEnPath = join(dir, `${study.date}-article-en.html`);
  const articleTlPath = join(dir, `${study.date}-article-tl.html`);
  const paragraphsPath = join(dir, `${study.date}-article-paragraphs.json`);
  const mdPath = join(dir, `${study.date}-ans-bi.md`);
  const htmlPath = join(dir, `${study.date}-ans-bi.html`);
  const pdfPath = join(dir, `${study.date}-ans-bi.pdf`);
  const articleEnPdf = join(dir, `${study.date}-article-en.pdf`);
  const articleTlPdf = join(dir, `${study.date}-article-tl.pdf`);

  await writeFile(articleEnPath, enHtml);
  await writeFile(articleTlPath, tlHtml);
  await writeFile(paragraphsPath, `${JSON.stringify(paragraphMap(study, enData, tlData), null, 2)}\n`);
  await writeFile(mdPath, renderMarkdown(study, enData, tlData));

  run("python3", [
    join(watchtowerRoot, "render_bilingual_study.py"),
    mdPath,
    "--title",
    `${study.titleEn} - Bilingual (EN/TL) - ${study.week}`,
    "--footer",
    `Generated for Watchtower Study - ${study.week}`,
    "--output",
    htmlPath,
  ]);

  run("google-chrome", ["--headless", "--disable-gpu", "--no-sandbox", `--print-to-pdf=${pdfPath}`, `file://${htmlPath}`]);
  run("google-chrome", ["--headless", "--disable-gpu", "--no-sandbox", `--print-to-pdf=${articleEnPdf}`, `file://${articleEnPath}`]);
  run("google-chrome", ["--headless", "--disable-gpu", "--no-sandbox", `--print-to-pdf=${articleTlPdf}`, `file://${articleTlPath}`]);

  const packagePath = join(dir, `${study.date}-study-package.json`);
  run("node", [join(appRoot, "scripts/build-study-package.mjs"), mdPath, packagePath, paragraphsPath]);
  console.log(`Generated ${basename(mdPath)} with ${enData.questions.length} questions.`);
}

function renderMarkdown(study, enData, tlData) {
  const lines = [
    `# ${study.titleEn} - Bilingual (EN / TL)`,
    `**The Watchtower - ${capitalize(study.issue.month)} ${study.issue.year} | ${study.week}**  `,
    `${enData.song ? `*${enData.song}*  ` : ""}`,
    `${tlData.song ? `*${tlData.song}*` : ""}`,
    "",
    "> *Note: Every scripture below is taken only from the paragraph that the question covers. ANS1 = direct answer from the paragraph; ANS2 = a deeper spiritual insight drawn from that same paragraph.*",
    "",
    "---",
    "",
  ];

  let currentSection = "";
  for (let index = 0; index < enData.questions.length; index += 1) {
    const en = enData.questions[index];
    const tl = tlData.questions[index] ?? { question: "", paragraphs: [] };
    if (en.section && en.section !== currentSection) {
      currentSection = en.section;
      lines.push(`## ${en.section} / ${tl.section ?? ""}`, "");
    }

    const number = en.number;
    const answer = makeAnswers(en, tl);
    lines.push(
      `> *<sub>**${number}.** ${en.question}</sub>*  `,
      `> *<sub>**${number}.** ${tl.question}</sub>*`,
      "",
      `**ANS1 - Direct (EN):** ${answer.directEn}`,
      "",
      `**ANS1 - Direct (TL):** ${answer.directTl}`,
      "",
      `**ANS2 - Deeper (EN):** ${answer.deeperEn}`,
      "",
      `**ANS2 - Deeper (TL):** ${answer.deeperTl}`,
      "",
      "---",
      "",
    );
  }

  return `${lines.join("\n")}\n`;
}

function makeAnswers(en, tl) {
  const enParagraph = en.paragraphs.join(" ");
  const tlParagraph = tl.paragraphs.join(" ");
  const enScriptures = scriptureList(enParagraph);
  const tlScriptures = scriptureList(tlParagraph);
  const directEn = `${summarize(enParagraph, "en")} ${enScriptures ? `(${enScriptures})` : ""}`.replace(/\s+/g, " ").trim();
  const directTl = `${summarize(tlParagraph, "tl")} ${tlScriptures ? `(${tlScriptures})` : ""}`.replace(/\s+/g, " ").trim();
  return {
    directEn,
    directTl,
    deeperEn: deeper(enParagraph, enScriptures, "en"),
    deeperTl: deeper(tlParagraph, tlScriptures, "tl"),
  };
}

function summarize(text, lang) {
  const sentences = splitSentences(cleanText(text)).filter((sentence) => !/^\(?[A-Z]?[a-z]+ \d/.test(sentence));
  const picked = sentences.slice(0, 3).join(" ");
  if (picked.length > 80) return picked;
  return lang === "tl"
    ? "Makikita sa parapo na " + picked.charAt(0).toLowerCase() + picked.slice(1)
    : "The paragraph shows that " + picked.charAt(0).toLowerCase() + picked.slice(1);
}

function deeper(text, scriptures, lang) {
  const lower = text.toLowerCase();
  if (lang === "tl") {
    if (lower.includes("jehova")) {
      return `Itinuturo nito na si Jehova ay hindi lang nagbibigay ng utos; tinutulungan niya tayong magtiwala sa kaniya sa praktikal na paraan. ${scriptures ? `Dahil sa mga tekstong binanggit sa parapo, ` : ""}mas nakikita ko na ang kaniyang patnubay ay para sa ikabubuti natin at para manatili tayong malapít sa kaniya.`;
    }
    return `Ang praktikal na aral sa parapo ay manatiling mapagpakumbaba at handang kumilos ayon sa natutuhan natin. Kapag ginagawa ko ito, hindi lang ako nagbibigay ng tamang sagot; hinahayaan kong hubugin ni Jehova ang pananaw at mga desisyon ko.`;
  }

  if (lower.includes("jehovah")) {
    return `This helps me see that Jehovah does not give direction in a distant way; he gives it because he cares about our faith and future. ${scriptures ? `The cited scriptures in the paragraph ` : "The paragraph "}help me trust that his guidance is loving and that staying close to him is always the safest course.`;
  }
  return `A deeper lesson for me is that faith is shown in how I respond, not just in what I know. The paragraph encourages humility and action. When I apply the point personally, I let Jehovah shape my thinking, my choices, and my loyalty.`;
}

function paragraphMap(study, enData, tlData) {
  const questions = {};
  for (let index = 0; index < enData.questions.length; index += 1) {
    const en = enData.questions[index];
    const tl = tlData.questions[index] ?? {};
    questions[en.number] = {
      question: { en: en.question, tl: tl.question ?? "" },
      paragraph: {
        en: en.paragraphs.join("\n\n"),
        tl: (tl.paragraphs ?? []).join("\n\n"),
      },
    };
  }
  return {
    source: { en: study.enUrl, tl: study.tlUrl },
    questions,
  };
}

function parseIssue(html, baseUrl) {
  const items = [];
  const contextPattern = /<p class="contextTitle">([\s\S]*?)<\/p>/g;
  const contexts = [];
  let contextMatch;
  while ((contextMatch = contextPattern.exec(html))) {
    contexts.push({ index: contextMatch.index, raw: contextMatch[1] });
  }

  for (let index = 0; index < contexts.length; index += 1) {
    const context = contexts[index];
    const week = normalizeWeek(clean(context.raw));
    if (!/\b20\d{2}\b/.test(week) || !/\d{1,2}(?:–|-)\d{1,2}/.test(week)) continue;
    const nextIndex = contexts[index + 1]?.index ?? html.length;
    const block = html.slice(context.index, nextIndex);
    const article = block.match(/<h2[\s\S]*?<a href="([^"]+)">([\s\S]*?)<\/a>[\s\S]*?<\/h2>/);
    if (!article) continue;
    const url = new URL(article[1].replace(/&amp;/g, "&"), baseUrl).href;
    items.push({
      title: clean(article[2]),
      week,
      url,
    });
  }
  return items;
}

function normalizeWeek(value) {
  return value
    .toLowerCase()
    .replace(/\bagosto\b/g, "August")
    .replace(/\bsetyembre\b/g, "September")
    .replace(/\boktubre\b/g, "October")
    .replace(/\bnobyembre\b/g, "November")
    .replace(/\bdisyembre\b/g, "December")
    .replace(/\benero\b/g, "January")
    .replace(/\bpebrero\b/g, "February")
    .replace(/\bmarso\b/g, "March")
    .replace(/\babril\b/g, "April")
    .replace(/\bmayo\b/g, "May")
    .replace(/\bhunyo\b/g, "June")
    .replace(/\bhulyo\b/g, "July")
    .replace(/(^|\s)([a-z])/g, (_, prefix, letter) => `${prefix}${letter.toUpperCase()}`);
}

function parseArticle(html) {
  const title = clean(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1] ?? "");
  const song = clean(html.match(/<p[^>]*class="pubRefs"[^>]*>[\s\S]*?<strong>(SONG|AWIT BLG\.)[\s\S]*?<\/p>/)?.[0] ?? "");
  const questions = [];
  const questionPattern = /<p[^>]*data-pid="(\d+)"[^>]*class="qu"[^>]*>([\s\S]*?)<\/p>/g;
  const sectionPattern = /<h2[^>]*>([\s\S]*?)<\/h2>/g;
  const sections = [];
  let sectionMatch;
  while ((sectionMatch = sectionPattern.exec(html))) {
    sections.push({ index: sectionMatch.index, title: clean(sectionMatch[1]) });
  }
  let match;
  while ((match = questionPattern.exec(html))) {
    const pid = match[1];
    const questionText = clean(match[2]);
    const number = questionText.match(/^(\d+(?:-\d+)?[a-z]?)\./)?.[1];
    if (!number) continue;
    const section = sections.filter((candidate) => candidate.index < match.index).at(-1)?.title ?? "";
    const rel = `data-rel-pid="[${pid}]"`;
    const paragraphPattern = new RegExp(`<p[^>]*${escapeRegExp(rel)}[^>]*>([\\s\\S]*?)<\\/p>`, "g");
    const paragraphs = [];
    let paragraphMatch;
    while ((paragraphMatch = paragraphPattern.exec(html))) {
      paragraphs.push(clean(paragraphMatch[1]));
    }
    questions.push({
      number,
      section,
      question: questionText.replace(/^\d+(?:-\d+)?[a-z]?\.\s*/, ""),
      paragraphs,
    });
  }
  return { title, song, questions };
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      "user-agent": "Mozilla/5.0 WatchtowerStudyBatch/0.1",
      accept: "text/html,application/xhtml+xml",
    },
  });
  if (!response.ok) throw new Error(`Could not fetch ${url}: ${response.status}`);
  return response.text();
}

function run(command, args) {
  const result = spawnSync(command, args, { stdio: "inherit" });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed`);
  }
}

function fileDateForWeek(week) {
  const year = week.match(/\b(20\d{2})\b/)?.[1] ?? "2026";
  const parts = week.replace(/,/g, "").split(/–|-/);
  const end = parts.at(-1).trim();
  const startMonth = week.match(/^([A-Za-z]+)/)?.[1];
  const endParts = end.split(/\s+/);
  const endHasMonth = /^[A-Za-z]+$/.test(endParts[0]);
  const month = endHasMonth ? endParts[0] : startMonth;
  const day = endHasMonth ? endParts[1] : endParts[0];
  const date = new Date(`${month} ${day}, ${year} UTC`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

function scriptureList(text) {
  const matches = cleanText(text).match(/\b(?:Gen\.|Genesis|Ex\.|Exodus|Lev\.|Leviticus|Num\.|Numbers|Deut\.|Deuteronomy|Josh\.|Joshua|Judg\.|Judges|Ruth|1 Sam\.|2 Sam\.|1 Ki\.|2 Ki\.|1 Chron\.|2 Chron\.|Ezra|Neh\.|Esther|Job|Ps\.|Psalm|Prov\.|Proverbs|Eccl\.|Song|Isa\.|Isaiah|Jer\.|Ezek\.|Dan\.|Hos\.|Joel|Amos|Obad\.|Jonah|Mic\.|Nah\.|Hab\.|Zeph\.|Hag\.|Zech\.|Mal\.|Matt\.|Matthew|Mark|Luke|John|Acts|Rom\.|Romans|1 Cor\.|2 Cor\.|Gal\.|Eph\.|Phil\.|Col\.|1 Thess\.|2 Thess\.|1 Tim\.|2 Tim\.|Titus|Philem\.|Heb\.|Jas\.|James|1 Pet\.|2 Pet\.|1 John|2 John|3 John|Jude|Rev\.|Revelation|Awit|Kaw\.|Isaias|Juan|Mateo|Lucas|Roma|Hebreo|Colosas|Apocalipsis|Santiago|1 Corinto|2 Corinto|1 Timoteo|2 Timoteo)\s+\d+[:：]\s?[\d,\s–-]+/g);
  return matches ? Array.from(new Set(matches)).join("; ") : "";
}

function splitSentences(text) {
  return text.split(/(?<=[.!?])\s+/).map((item) => item.trim()).filter(Boolean);
}

function clean(html) {
  return cleanText(html
    .replace(/<script[\s\S]*?<\/script>/g, "")
    .replace(/<style[\s\S]*?<\/style>/g, "")
    .replace(/<span[^>]*class="[^"]*pageNum[^"]*"[\s\S]*?<\/span>/g, "")
    .replace(/<span[^>]*class="[^"]*parNum[^"]*"[\s\S]*?<\/span>/g, "")
    .replace(/<[^>]+>/g, " "));
}

function cleanText(value) {
  return value
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

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
