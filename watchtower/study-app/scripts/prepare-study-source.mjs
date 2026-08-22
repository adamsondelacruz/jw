import { mkdir, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { basename, join } from "node:path";

const [studyDir, studyDate, enUrl, tlUrl] = process.argv.slice(2);

if (!studyDir || !studyDate || !enUrl || !tlUrl) {
  console.error("Usage: node scripts/prepare-study-source.mjs STUDY_DIR YYYY-MM-DD EN_URL TL_URL");
  process.exit(1);
}

const enHtml = join(studyDir, `${studyDate}-article-en.html`);
const tlHtml = join(studyDir, `${studyDate}-article-tl.html`);
const paragraphs = join(studyDir, `${studyDate}-article-paragraphs.json`);

await mkdir(studyDir, { recursive: true });
await writeFile(enHtml, await fetchText(enUrl));
await writeFile(tlHtml, await fetchText(tlUrl));

const extractor = new URL("./extract-jw-paragraphs.mjs", import.meta.url).pathname;
const result = spawnSync(process.execPath, [extractor, enHtml, tlHtml, paragraphs, enUrl, tlUrl], {
  stdio: "inherit",
});

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

console.log(`Wrote source files:
- ${basename(enHtml)}
- ${basename(tlHtml)}
- ${basename(paragraphs)}`);

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      "user-agent": "Mozilla/5.0 WatchtowerStudyApp/0.1",
      accept: "text/html,application/xhtml+xml",
    },
  });
  if (!response.ok) {
    throw new Error(`Could not fetch ${url}: ${response.status}`);
  }
  return response.text();
}
