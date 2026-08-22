import { mkdir, readdir, copyFile, readFile, rm, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";

const appRoot = resolve(new URL("..", import.meta.url).pathname);
const watchtowerRoot = resolve(appRoot, "..");
const publicStudies = join(appRoot, "public", "studies");

await rm(publicStudies, { recursive: true, force: true });
await mkdir(publicStudies, { recursive: true });

const monthDirs = (await readdir(watchtowerRoot, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory() && /^20\d\d-\d\d$/.test(entry.name))
  .map((entry) => join(watchtowerRoot, entry.name))
  .sort();

const studies = [];

for (const monthDir of monthDirs) {
  const files = await readdir(monthDir);
  const markdownFiles = files.filter((file) => /^\d{4}-\d{2}-\d{2}-ans-bi\.md$/.test(file)).sort();

  for (const markdown of markdownFiles) {
    const studyDate = markdown.slice(0, 10);
    const base = `${studyDate}-ans-bi`;
    const sourcePrefix = join(monthDir, base);
    const publicPrefix = join(publicStudies, base);
    const sourceMarkdown = `${sourcePrefix}.md`;
    const sourceHtml = `${sourcePrefix}.html`;
    const sourcePdf = `${sourcePrefix}.pdf`;
    const sourcePackage = join(monthDir, `${studyDate}-study-package.json`);
    const sourceParagraphs = join(monthDir, `${studyDate}-article-paragraphs.json`);
    const legacyParagraphs = join(monthDir, `${studyDate}-paragraphs.json`);

    await copyFile(sourceMarkdown, `${publicPrefix}.md`);
    const studyFiles = [
      {
        id: `${studyDate}-md`,
        kind: "markdown",
        name: "Bilingual answers",
        path: `/studies/${base}.md`,
      },
    ];

    if (existsSync(sourceHtml)) {
      await copyFile(sourceHtml, `${publicPrefix}.html`);
      studyFiles.push({
        id: `${studyDate}-html`,
        kind: "html",
        name: "Styled HTML",
        path: `/studies/${base}.html`,
      });
    }

    if (existsSync(sourcePdf)) {
      await copyFile(sourcePdf, `${publicPrefix}.pdf`);
      studyFiles.push({
        id: `${studyDate}-pdf`,
        kind: "pdf",
        name: "PDF",
        path: `/studies/${base}.pdf`,
      });
    }

    const paragraphsSource = existsSync(sourceParagraphs)
      ? sourceParagraphs
      : existsSync(legacyParagraphs)
        ? legacyParagraphs
        : "";
    let paragraphsPath;
    if (paragraphsSource) {
      const publicParagraphs = join(publicStudies, basename(paragraphsSource));
      await copyFile(paragraphsSource, publicParagraphs);
      paragraphsPath = `/studies/${basename(paragraphsSource)}`;
    }

    const packagePath = await ensureStudyPackage(sourceMarkdown, sourcePackage, paragraphsSource);
    await copyFile(packagePath, join(publicStudies, basename(packagePath)));
    studyFiles.push({
      id: `${studyDate}-package`,
      kind: "package",
      name: "Study package",
      path: `/studies/${basename(packagePath)}`,
    });

    const sourceArticleFiles = [];
    for (const suffix of ["article-en.html", "article-tl.html", "article-en.pdf", "article-tl.pdf"]) {
      const source = join(monthDir, `${studyDate}-${suffix}`);
      if (!existsSync(source)) continue;
      const target = join(publicStudies, basename(source));
      await copyFile(source, target);
      sourceArticleFiles.push(`/studies/${basename(source)}`);
    }

    const metadata = await readMetadata(sourceMarkdown, paragraphsSource);
    studies.push({
      id: studyDate,
      title: metadata.title,
      week: metadata.week,
      preferredFileId: `${studyDate}-md`,
      packagePath: `/studies/${basename(packagePath)}`,
      ...(paragraphsPath ? { paragraphsPath } : {}),
      ...(sourceArticleFiles.length ? { sourceArticleFiles } : {}),
      files: studyFiles,
    });
  }
}

async function ensureStudyPackage(markdownPath, packagePath, paragraphsPath) {
  const builder = new URL("./build-study-package.mjs", import.meta.url).pathname;
  const args = [builder, markdownPath, packagePath];
  if (paragraphsPath) args.push(paragraphsPath);
  const result = spawnSync(process.execPath, args, { stdio: "inherit" });
  if (result.status !== 0) {
    throw new Error(`Could not build study package for ${markdownPath}`);
  }
  return packagePath;
}

studies.sort((a, b) => b.id.localeCompare(a.id));
await writeFile(join(publicStudies, "watchtower-manifest.json"), `${JSON.stringify({ studies }, null, 2)}\n`);
console.log(`Synced ${studies.length} studies from ${relative(process.cwd(), watchtowerRoot)} to ${relative(process.cwd(), publicStudies)}`);

async function readMetadata(markdownPath, paragraphsPath) {
  const markdown = await readFile(markdownPath, "utf8");
  const title = markdown.match(/^#\s+(.+?)(?:\s+-\s+Bilingual.*)?$/m)?.[1]?.trim() ?? basename(markdownPath, ".md");
  const week =
    markdown.match(/\*\*The Watchtower\s+-\s+.+?\|\s+(.+?)\*\*/)?.[1]?.trim() ??
    (paragraphsPath ? await readWeekFromParagraphs(paragraphsPath) : "") ??
    "";
  return { title, week };
}

async function readWeekFromParagraphs(path) {
  try {
    const json = JSON.parse(await readFile(path, "utf8"));
    return json.week ?? "";
  } catch {
    return "";
  }
}
