import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { parseHtmlStudy, parseMarkdownStudy, parseStudyPackage, validateStudyPackage } from "./studyParser";

describe("study parser", () => {
  it("loads the bilingual markdown answer contract", async () => {
    const study = await parseMarkdownStudy(`
# Sample - Bilingual (EN / TL)
*Song 1*

> *<sub>**1-2.** What happened?</sub>*
> *<sub>**1-2.** Ano ang nangyari?</sub>*

**ANS1 - Direct (EN):** Direct English.

**ANS1 - Direct (TL):** Direct Tagalog.

**ANS2 - Deeper (EN):** Deeper English.

**ANS2 - Deeper (TL):** Deeper Tagalog.
`);

    expect(study.kind).toBe("study");
    if (study.kind !== "study") return;
    expect(study.questions).toHaveLength(1);
    expect(study.questions[0].number).toBe("1-2");
    expect(study.questions[0].direct.tl).toBe("Direct Tagalog.");
  });

  it("loads the styled generated html answer blocks", () => {
    const study = parseHtmlStudy(`
<body>
<header><h1>Sample</h1><p class="subtitle">Week</p></header>
<div class="qa-block">
<p class="question"><span class="qnum">3.</span> How did they react?</p>
<p class="question tl"><span class="qnum">3.</span> Ano ang reaksiyon nila?</p>
<div class="ans direct"><div class="line"><span class="chip en">EN</span><p>Direct EN</p></div><div class="line tl"><span class="chip tl">TL</span><p>Direct TL</p></div></div>
<div class="ans deeper"><div class="line"><span class="chip en">EN</span><p>Deeper EN</p></div><div class="line tl"><span class="chip tl">TL</span><p>Deeper TL</p></div></div>
</div>
</body>`);

    expect(study.kind).toBe("study");
    if (study.kind !== "study") return;
    expect(study.questions[0].questionEn).toBe("How did they react?");
    expect(study.questions[0].deeper.en).toBe("Deeper EN");
  });

  it("loads the seeded Watchtower answer file", async () => {
    const source = await readFile("public/studies/2026-08-15-ans-bi.md", "utf8");
    const study = await parseMarkdownStudy(source);

    expect(study.kind).toBe("study");
    if (study.kind !== "study") return;
    expect(study.questions.length).toBeGreaterThanOrEqual(18);
    expect(study.questions[0].direct.en).toContain("Capernaum");
    expect(study.questions.at(-1)?.deeper.tl).toContain("Jehova");
  });

  it("loads a portable study package", async () => {
    const pkg = JSON.parse(await readFile("public/studies/2026-08-15-study-package.json", "utf8"));
    const study = parseStudyPackage(pkg);

    expect(study.kind).toBe("study");
    if (study.kind !== "study") return;
    expect(study.sourceKind).toBe("package");
    expect(study.questions).toHaveLength(18);
    expect(study.questions[0].paragraph?.en).toContain("Capernaum");
  });

  it("keeps package answers separate from article paragraphs", async () => {
    const pkg = JSON.parse(await readFile("public/studies/2026-08-29-study-package.json", "utf8"));
    const study = parseStudyPackage(pkg);

    expect(study.kind).toBe("study");
    if (study.kind !== "study") return;

    const seenDeeper = new Set<string>();
    for (const question of study.questions) {
      for (const language of ["en", "tl"] as const) {
        const direct = normalizeForExpectation(question.direct[language]);
        const paragraph = normalizeForExpectation(question.paragraph?.[language]);
        const deeper = normalizeForExpectation(question.deeper[language]);

        expect(paragraph.startsWith(direct)).toBe(false);
        expect(seenDeeper.has(`${language}:${deeper}`)).toBe(false);
        seenDeeper.add(`${language}:${deeper}`);
      }
    }
  });

  it("rejects corrupted packages with paragraph-copy or repeated deeper answers", async () => {
    const pkg = JSON.parse(await readFile("public/studies/2026-08-29-study-package.json", "utf8"));
    const paragraphCopy = structuredClone(pkg);
    paragraphCopy.questions[0].direct.en = paragraphCopy.questions[0].paragraph.en.slice(0, 180);

    expect(() => validateStudyPackage(paragraphCopy)).toThrow(/copied from the paragraph/);

    const repeated = structuredClone(pkg);
    repeated.questions[1].deeper.en = repeated.questions[0].deeper.en;

    expect(() => validateStudyPackage(repeated)).toThrow(/repeated deeper answers/);
  });
});

function normalizeForExpectation(value: string | undefined) {
  return (value ?? "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}
