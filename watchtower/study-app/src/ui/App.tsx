import { useEffect, useRef, useState } from "react";
import { BookOpen, ChevronLeft, ChevronRight, FileInput, FileText, GalleryHorizontalEnd, Home, LayoutList, PanelTopOpen, ZoomIn, ZoomOut } from "lucide-react";
import type { LoadedStudy, ParagraphMap, Study, StudyFile, StudyPackage, StudyQuestion } from "../types";
import { loadStudyManifest } from "../lib/manifest";
import { loadStudyFile, parseStudyPackage } from "../lib/studyParser";

type ActiveStudy = {
  study: Study;
  file: StudyFile;
};

type ViewMode = "scroll" | "question";
type LanguageMode = "both" | "en" | "tl";
const importedPackagesKey = "jw-watchtower-study.imported-packages.v1";

export function App() {
  const [studies, setStudies] = useState<Study[]>([]);
  const [active, setActive] = useState<ActiveStudy | null>(null);
  const [error, setError] = useState<string | null>(null);
  const autoOpened = useRef(false);

  useEffect(() => {
    void loadStudyManifest()
      .then((manifest) => {
        const imported = loadImportedStudies();
        const nextStudies = [...imported, ...manifest.studies];
        setStudies(nextStudies);
        if (!autoOpened.current && nextStudies.length === 1) {
          const study = nextStudies[0];
          const file = study.files.find((candidate) => candidate.id === study.preferredFileId) ?? study.files[0];
          if (file) {
            autoOpened.current = true;
            setActive({ study, file });
          }
        }
      })
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Could not load studies."));
  }, []);

  if (error) return <ErrorScreen message={error} />;
  if (!active) return <Library studies={studies} onOpen={setActive} onImport={(study) => {
    setStudies((current) => [study, ...current.filter((candidate) => candidate.id !== study.id)]);
    setActive({ study, file: study.files[0] });
  }} />;
  return <Reader active={active} studies={studies} onBack={() => setActive(null)} onOpen={setActive} onImport={(study) => {
    setStudies((current) => [study, ...current.filter((candidate) => candidate.id !== study.id)]);
    setActive({ study, file: study.files[0] });
  }} />;
}

function Library({ studies, onOpen, onImport }: { studies: Study[]; onOpen: (active: ActiveStudy) => void; onImport: (study: Study) => void }) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  return (
    <main className="library-shell">
      <section className="library-header">
        <div>
          <p className="eyebrow">Watchtower Study</p>
          <h1>Answer Reader</h1>
        </div>
        <div className="library-actions">
          <button className="primary-button" onClick={() => inputRef.current?.click()}>
            <FileInput size={22} />
            Import Package
          </button>
          <div className="status-pill">Tablet-ready</div>
          <input
            ref={inputRef}
            className="hidden-input"
            type="file"
            accept="application/json,.json"
            onChange={(event) => void importPackageFile(event.currentTarget.files?.[0], onImport, event.currentTarget)}
          />
        </div>
      </section>

      <section className="study-list" aria-label="Available Watchtower studies">
        {studies.map((study) => {
          const preferred = study.files.find((file) => file.id === study.preferredFileId) ?? study.files[0];
          return (
            <article className="study-row" key={study.id}>
              <div className="study-date">{study.id.slice(5)}</div>
              <div className="study-main">
                <h2>{study.title}</h2>
                <p>{study.week}</p>
                <div className="file-chips">
                  {study.files.map((file) => (
                    <button className="file-chip" key={file.id} onClick={() => onOpen({ study, file })}>
                      {file.kind.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
              <button className="primary-button" onClick={() => onOpen({ study, file: preferred })}>
                <BookOpen size={22} />
                Open
              </button>
            </article>
          );
        })}
      </section>
    </main>
  );
}

function Reader({
  active,
  studies,
  onBack,
  onOpen,
  onImport,
}: {
  active: ActiveStudy;
  studies: Study[];
  onBack: () => void;
  onOpen: (active: ActiveStudy) => void;
  onImport: (study: Study) => void;
}) {
  const [loaded, setLoaded] = useState<LoadedStudy | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<ViewMode>("question");
  const [index, setIndex] = useState(0);
  const [showParagraph, setShowParagraph] = useState(false);
  const [fontScale, setFontScale] = useState(1);
  const [languageMode, setLanguageMode] = useState<LanguageMode>("both");

  useEffect(() => {
    setLoaded(null);
    setError(null);
    setIndex(0);
    const loadedStudy = active.study.packageData && active.file.kind === "package"
      ? Promise.resolve(parseStudyPackage(active.study.packageData))
      : loadStudyFile(active.file);

    void loadedStudy
      .then((study) => enrichWithParagraphs(study, active.study.paragraphsPath))
      .then(setLoaded)
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Could not load file."));
  }, [active.file, active.study.paragraphsPath]);

  const questions = loaded?.kind === "study" ? loaded.questions : [];
  const current = questions[index];
  const importInputRef = useRef<HTMLInputElement | null>(null);

  function move(delta: number) {
    setIndex((currentIndex) => clamp(currentIndex + delta, 0, Math.max(questions.length - 1, 0)));
    setShowParagraph(false);
  }

  return (
    <main
      className={`reader-shell language-${languageMode}`}
      style={{ "--answer-scale": fontScale } as React.CSSProperties}
    >
      <nav className="reader-rail" aria-label="Reader controls">
        <button className="icon-button" onClick={onBack} title="Back to library">
          <Home size={24} />
        </button>
        <button className="icon-button" onClick={() => importInputRef.current?.click()} title="Import package">
          <FileInput size={24} />
        </button>
        <button className={`icon-button ${mode === "scroll" ? "active" : ""}`} onClick={() => setMode("scroll")} title="Scroll view">
          <LayoutList size={24} />
        </button>
        <button className={`icon-button ${mode === "question" ? "active" : ""}`} onClick={() => setMode("question")} title="Question view">
          <GalleryHorizontalEnd size={24} />
        </button>
        <button className="icon-button" onClick={() => setFontScale((value) => Math.max(0.85, value - 0.08))} title="Smaller text">
          <ZoomOut size={24} />
        </button>
        <button className="icon-button" onClick={() => setFontScale((value) => Math.min(1.35, value + 0.08))} title="Larger text">
          <ZoomIn size={24} />
        </button>
      </nav>

      <section className="reader-main">
        <input
          ref={importInputRef}
          className="hidden-input"
          type="file"
          accept="application/json,.json"
          onChange={(event) => void importPackageFile(event.currentTarget.files?.[0], onImport, event.currentTarget)}
        />
        <header className="reader-header">
          <div>
            <p className="eyebrow">{active.study.week}</p>
            <h1>{active.study.title}</h1>
          </div>
          <div className="reader-actions">
            <select
              value={languageMode}
              onChange={(event) => setLanguageMode(event.target.value as LanguageMode)}
              aria-label="Language display"
            >
              <option value="both">EN / TG</option>
              <option value="en">EN only</option>
              <option value="tl">TG only</option>
            </select>
            <select
              value={active.file.id}
              onChange={(event) => {
                const file = active.study.files.find((candidate) => candidate.id === event.target.value);
                if (file) onOpen({ study: active.study, file });
              }}
              aria-label="Source file"
            >
              {active.study.files.map((file) => (
                <option key={file.id} value={file.id}>
                  {file.name}
                </option>
              ))}
            </select>
            <select
              value={active.study.id}
              onChange={(event) => {
                const nextStudy = studies.find((study) => study.id === event.target.value);
                const file = nextStudy?.files.find((candidate) => candidate.id === nextStudy.preferredFileId) ?? nextStudy?.files[0];
                if (nextStudy && file) onOpen({ study: nextStudy, file });
              }}
              aria-label="Study"
            >
              {studies.map((study) => (
                <option key={study.id} value={study.id}>
                  {study.id}
                </option>
              ))}
            </select>
          </div>
        </header>
        {active.study.sourceArticleFiles?.length ? (
          <div className="source-strip" aria-label="Article source files">
            {active.study.sourceArticleFiles.map((path) => (
              <a key={path} href={path} target="_blank" rel="noreferrer">
                {sourceLabel(path)}
              </a>
            ))}
          </div>
        ) : null}

        {error ? <ErrorScreen message={error} compact /> : null}
        {!loaded && !error ? <div className="loading">Loading study...</div> : null}
        {loaded?.kind === "pdf" ? <PdfView file={active.file} /> : null}
        {loaded?.kind === "study" && mode === "scroll" ? <ScrollView questions={questions} languageMode={languageMode} /> : null}
        {loaded?.kind === "study" && mode === "question" && current ? (
          <QuestionView
            current={current}
            currentIndex={index}
            total={questions.length}
            languageMode={languageMode}
            showParagraph={showParagraph}
            onToggleParagraph={() => setShowParagraph((value) => !value)}
            onPrevious={() => move(-1)}
            onNext={() => move(1)}
          />
        ) : null}
      </section>
    </main>
  );
}

async function importPackageFile(file: File | undefined, onImport: (study: Study) => void, input: HTMLInputElement) {
  if (!file) return;
  try {
    const pkg = JSON.parse(await file.text()) as StudyPackage;
    const study = studyFromPackage(pkg);
    saveImportedPackage(pkg);
    onImport(study);
  } catch (error) {
    window.alert(error instanceof Error ? error.message : "Could not import study package.");
  } finally {
    input.value = "";
  }
}

function studyFromPackage(pkg: StudyPackage): Study {
  if (pkg.schema !== "jw-study-package/v1") {
    throw new Error("This is not a supported Watchtower study package.");
  }
  return {
    id: pkg.id,
    title: pkg.title,
    week: pkg.week,
    preferredFileId: `${pkg.id}-package`,
    packageData: pkg,
    files: [
      {
        id: `${pkg.id}-package`,
        kind: "package",
        name: "Imported package",
        path: "",
      },
    ],
  };
}

function loadImportedStudies(): Study[] {
  try {
    const packages = JSON.parse(localStorage.getItem(importedPackagesKey) ?? "[]") as StudyPackage[];
    return packages.map(studyFromPackage);
  } catch {
    return [];
  }
}

function saveImportedPackage(pkg: StudyPackage) {
  const existing = loadImportedStudies()
    .map((study) => study.packageData)
    .filter((item): item is StudyPackage => Boolean(item));
  const next = [pkg, ...existing.filter((item) => item.id !== pkg.id)];
  localStorage.setItem(importedPackagesKey, JSON.stringify(next));
}

async function enrichWithParagraphs(study: LoadedStudy, paragraphsPath?: string): Promise<LoadedStudy> {
  if (study.kind !== "study" || !paragraphsPath) return study;

  const response = await fetch(paragraphsPath);
  if (!response.ok) return study;
  const paragraphMap = (await response.json()) as ParagraphMap;

  return {
    ...study,
    questions: study.questions.map((question) => {
      const entry = paragraphMap.questions[question.number];
      if (!entry?.paragraph) return question;
      return {
        ...question,
        paragraph: {
          en: entry.paragraph.en ?? question.paragraph?.en ?? "",
          tl: entry.paragraph.tl ?? question.paragraph?.tl ?? "",
        },
      };
    }),
  };
}

function ScrollView({ questions, languageMode }: { questions: StudyQuestion[]; languageMode: LanguageMode }) {
  return (
    <div className="scroll-view">
      {questions.map((question) => (
        <QuestionCard key={question.id} question={question} languageMode={languageMode} />
      ))}
    </div>
  );
}

function QuestionView({
  current,
  currentIndex,
  total,
  languageMode,
  showParagraph,
  onToggleParagraph,
  onPrevious,
  onNext,
}: {
  current: StudyQuestion;
  currentIndex: number;
  total: number;
  languageMode: LanguageMode;
  showParagraph: boolean;
  onToggleParagraph: () => void;
  onPrevious: () => void;
  onNext: () => void;
}) {
  return (
    <div className="question-stage">
      <div className={`paragraph-sheet ${showParagraph ? "open" : ""}`}>
        <ParagraphText question={current} languageMode={languageMode} />
      </div>

      <div className="stage-toolbar">
        <div className="progress-label">
          Question {currentIndex + 1} of {total}
        </div>
        <button className="soft-button" onClick={onToggleParagraph}>
          <PanelTopOpen size={20} />
          Paragraph
        </button>
      </div>

      <button className="side-nav previous" onClick={onPrevious} aria-label="Previous question">
        <ChevronLeft size={42} />
      </button>
      <button className="side-nav next" onClick={onNext} aria-label="Next question">
        <ChevronRight size={42} />
      </button>

      <article className="question-full">
        <div className="question-number">{current.number}</div>
        {languageMode !== "tl" ? <h2>{current.questionEn}</h2> : null}
        {languageMode !== "en" && current.questionTl ? <p className={languageMode === "tl" ? "question-main-tl" : "question-tl"}>{current.questionTl}</p> : null}
        <AnswerBlock label="ANS1 - Direct" answer={current.direct} languageMode={languageMode} />
        <AnswerBlock label="ANS2 - Deeper" answer={current.deeper} languageMode={languageMode} />
      </article>
    </div>
  );
}

function QuestionCard({ question, languageMode }: { question: StudyQuestion; languageMode: LanguageMode }) {
  return (
    <article className="question-card">
      <div className="question-number">{question.number}</div>
      {languageMode !== "tl" ? <h2>{question.questionEn}</h2> : null}
      {languageMode !== "en" && question.questionTl ? <p className={languageMode === "tl" ? "question-main-tl" : "question-tl"}>{question.questionTl}</p> : null}
      <AnswerBlock label="ANS1 - Direct" answer={question.direct} languageMode={languageMode} />
      <AnswerBlock label="ANS2 - Deeper" answer={question.deeper} languageMode={languageMode} />
    </article>
  );
}

function ParagraphText({ question, languageMode }: { question: StudyQuestion; languageMode: LanguageMode }) {
  const hasParagraph = Boolean(question.paragraph?.en || question.paragraph?.tl);
  if (!hasParagraph) {
    return <p>No article paragraph is attached for this card yet.</p>;
  }

  return (
    <>
      {languageMode !== "tl" && question.paragraph?.en ? <p><span>EN</span>{question.paragraph.en}</p> : null}
      {languageMode !== "en" && question.paragraph?.tl ? <p className="tl"><span>TL</span>{question.paragraph.tl}</p> : null}
    </>
  );
}

function AnswerBlock({ label, answer, languageMode }: { label: string; answer: { en: string; tl: string }; languageMode: LanguageMode }) {
  return (
    <section className="answer-block">
      <h3>{label}</h3>
      {languageMode !== "tl" ? <p><span>EN</span>{answer.en}</p> : null}
      {languageMode !== "en" ? <p className="tl"><span>TL</span>{answer.tl}</p> : null}
    </section>
  );
}

function PdfView({ file }: { file: StudyFile }) {
  return (
    <div className="pdf-view">
      <FileText size={52} />
      <h2>{file.name}</h2>
      <p>PDF files are available as source/reference material. Use the Markdown or HTML file for parsed question navigation.</p>
      <iframe src={file.path} title={file.name} />
    </div>
  );
}

function ErrorScreen({ message, compact = false }: { message: string; compact?: boolean }) {
  return (
    <main className={compact ? "error compact" : "error"}>
      <h1>Could not load</h1>
      <p>{message}</p>
    </main>
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function sourceLabel(path: string) {
  if (path.endsWith("article-en.html")) return "Article EN HTML";
  if (path.endsWith("article-tl.html")) return "Article TG HTML";
  if (path.endsWith("article-en.pdf")) return "Article EN PDF";
  if (path.endsWith("article-tl.pdf")) return "Article TG PDF";
  return path.split("/").at(-1) ?? "Source";
}
