import { useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, Clock, FileText, Gauge, Home, Mic, Moon, Pause, Play, RotateCcw, Sun, ZoomIn, ZoomOut } from "lucide-react";
import type { ReaderMode, ReaderPreferences, Talk, TalkFile } from "../types";
import { loadTalkManifest } from "../lib/manifest";
import { loadPreferences, loadProgress, savePreferences, saveProgress } from "../lib/storage";
import { loadTalkDocument } from "../lib/document";
import type { LoadedDocument } from "../lib/document";
import { clamp, computePixelsPerSecond, estimateProgressPercent } from "../lib/scrolling";
import { findBestSpeechMatch, getVoiceWordState } from "../lib/voiceFollow";
import { startSpeechSession, type StopSpeechSession } from "../lib/speechRecognition";

type ActiveFile = {
  talk: Talk;
  file: TalkFile;
};

export function App() {
  const [talks, setTalks] = useState<Talk[]>([]);
  const [active, setActive] = useState<ActiveFile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preferences, setPreferences] = useState<ReaderPreferences>(() => loadPreferences());

  useEffect(() => {
    void loadTalkManifest()
      .then((manifest) => {
        setTalks(manifest.talks);
      })
      .catch((reason: unknown) => {
        setError(reason instanceof Error ? reason.message : "Could not load talk library.");
      });
  }, []);

  useEffect(() => {
    savePreferences(preferences);
  }, [preferences]);

  function updatePreferences(next: Partial<ReaderPreferences>) {
    setPreferences((current) => ({ ...current, ...next }));
  }

  if (error) {
    return <ErrorScreen message={error} />;
  }

  if (!active) {
    return <Library talks={talks} onOpen={setActive} />;
  }

  return (
    <Reader
      active={active}
      preferences={preferences}
      onBack={() => setActive(null)}
      onOpen={setActive}
      onPreferences={updatePreferences}
      talks={talks}
    />
  );
}

function Library({ talks, onOpen }: { talks: Talk[]; onOpen: (active: ActiveFile) => void }) {
  return (
    <main className="library-shell">
      <section className="library-header">
        <div>
          <p className="eyebrow">Talk Library</p>
          <h1>JW Talk Teleprompter</h1>
        </div>
        <div className="status-pill">Offline-ready PWA</div>
      </section>

      <section className="talk-list" aria-label="Available talks">
        {talks.map((talk) => (
          <article className="talk-row" key={talk.id}>
            <div className="talk-number">{talk.number ?? talk.id}</div>
            <div className="talk-main">
              <h2>{talk.title}</h2>
              <p>
                {talk.estimatedMinutes ? `${talk.estimatedMinutes} min estimate` : "No timing estimate"} · {talk.files.length} files
              </p>
              <div className="file-chips">
                {talk.files.map((file) => (
                  <button className="file-chip" key={file.id} onClick={() => onOpen({ talk, file })}>
                    {file.role ?? file.kind}
                  </button>
                ))}
              </div>
            </div>
            <button
              className="primary-button"
              onClick={() => {
                const file = talk.files.find((candidate) => candidate.id === talk.preferredFileId) ?? talk.files[0];
                onOpen({ talk, file });
              }}
            >
              <BookOpen size={20} />
              Open
            </button>
          </article>
        ))}
      </section>
    </main>
  );
}

function Reader({
  active,
  preferences,
  talks,
  onBack,
  onOpen,
  onPreferences,
}: {
  active: ActiveFile;
  preferences: ReaderPreferences;
  talks: Talk[];
  onBack: () => void;
  onOpen: (active: ActiveFile) => void;
  onPreferences: (next: Partial<ReaderPreferences>) => void;
}) {
  const [document, setDocument] = useState<LoadedDocument | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<ReaderMode>("manual");
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [activeBlock, setActiveBlock] = useState<string | undefined>();
  const [confirmedWordIndex, setConfirmedWordIndex] = useState<number | undefined>();
  const [voiceStatus, setVoiceStatus] = useState("off");
  const [reader, setReader] = useState<HTMLDivElement | null>(null);
  const activeBlockRef = useRef<string | undefined>();
  const confirmedWordRef = useRef<number | undefined>();

  useEffect(() => {
    if (!preferences.keepAwake || !("wakeLock" in navigator)) return;

    let lock: WakeLockSentinel | undefined;
    let disposed = false;
    const acquire = async () => {
      if (window.document.visibilityState !== "visible" || disposed) return;
      lock = await navigator.wakeLock.request("screen").catch(() => undefined);
    };
    const onVisibilityChange = () => {
      if (window.document.visibilityState === "visible" && (!lock || lock.released)) void acquire();
    };

    void acquire();
    window.document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      disposed = true;
      window.document.removeEventListener("visibilitychange", onVisibilityChange);
      void lock?.release();
    };
  }, [preferences.keepAwake]);

  useEffect(() => {
    setDocument(null);
    setError(null);
    setConfirmedWordIndex(undefined);
    confirmedWordRef.current = undefined;
    void loadTalkDocument(active.file)
      .then(setDocument)
      .catch((reason: unknown) => {
        setError(reason instanceof Error ? reason.message : "Could not load document.");
      });
  }, [active.file]);

  useEffect(() => {
    if (!reader || !document || document.kind !== "html") return;
    const saved = loadProgress(active.file.id);
    reader.scrollTop = saved?.scrollTop ?? 0;
    setActiveBlock(saved?.activeBlockId);
  }, [active.file.id, document, reader]);

  useEffect(() => {
    if (!reader) return;

    let frame = 0;
    let last = performance.now();

    function tick(now: number) {
      if (!reader) return;
      const elapsed = (now - last) / 1000;
      last = now;

      if (playing && mode === "timed") {
        const pixelsPerSecond = computePixelsPerSecond(
          Math.max(reader.scrollHeight - reader.clientHeight, 0),
          preferences.targetMinutes,
          preferences.speedMultiplier,
        );
        reader.scrollTop = clamp(reader.scrollTop + pixelsPerSecond * elapsed, 0, reader.scrollHeight);
      }

      frame = requestAnimationFrame(tick);
    }

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [mode, playing, preferences.speedMultiplier, preferences.targetMinutes, reader]);

  useEffect(() => {
    if (!reader) return;

    function onScroll() {
      if (!reader) return;
      const percent = estimateProgressPercent(reader.scrollTop, reader.scrollHeight, reader.clientHeight);
      setProgress(percent);
      const block = findCurrentBlock(reader);
      setActiveBlock(block?.getAttribute("data-block-id") ?? undefined);
      saveProgress({
        fileId: active.file.id,
        scrollTop: reader.scrollTop,
        activeBlockId: block?.getAttribute("data-block-id") ?? undefined,
        updatedAt: new Date().toISOString(),
      });
    }

    reader.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => reader.removeEventListener("scroll", onScroll);
  }, [active.file.id, reader]);

  useEffect(() => {
    if (!reader || document?.kind !== "html") return;
    reader.querySelectorAll(".current-block").forEach((element) => element.classList.remove("current-block"));
    if (activeBlock) {
      reader.querySelector(`[data-block-id="${activeBlock}"]`)?.classList.add("current-block");
    }
  }, [activeBlock, document, reader]);

  useEffect(() => {
    if (!reader || document?.kind !== "html") return;
    reader.querySelectorAll(".current-word,.read-word,.upcoming-word,.next-word").forEach((element) => {
      element.classList.remove("current-word", "read-word", "upcoming-word", "next-word");
    });
    if (mode !== "voice") return;

    const activeStart = document.blocks.find((block) => block.id === activeBlock)?.startWordIndex ?? 0;
    const cursor = confirmedWordIndex ?? activeStart - 1;
    const voiceWords = getVoiceWordState(cursor, document.words.length);

    if (voiceWords.fadedEndWordIndex !== undefined) {
      for (let index = 0; index <= voiceWords.fadedEndWordIndex; index += 1) {
        reader.querySelector<HTMLElement>(`[data-word-index="${index}"]`)?.classList.add("read-word");
      }
    }
    if (voiceWords.currentWordIndex !== undefined) {
      reader.querySelector<HTMLElement>(`[data-word-index="${voiceWords.currentWordIndex}"]`)?.classList.add("current-word");
    }
    if (voiceWords.upcomingStartWordIndex !== undefined && voiceWords.upcomingEndWordIndex !== undefined) {
      for (let index = voiceWords.upcomingStartWordIndex; index <= voiceWords.upcomingEndWordIndex; index += 1) {
        reader.querySelector<HTMLElement>(`[data-word-index="${index}"]`)?.classList.add("upcoming-word");
      }
      reader.querySelector<HTMLElement>(`[data-word-index="${voiceWords.upcomingStartWordIndex}"]`)?.classList.add("next-word");
    }
  }, [activeBlock, confirmedWordIndex, document, mode, reader]);

  useEffect(() => {
    activeBlockRef.current = activeBlock;
  }, [activeBlock]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (!reader) return;
      if (event.key === " ") {
        event.preventDefault();
        setMode("timed");
        setPlaying((value) => !value);
      }
      if (event.key === "ArrowDown" || event.key === "PageDown") {
        event.preventDefault();
        jumpBlock(reader, 1);
      }
      if (event.key === "ArrowUp" || event.key === "PageUp") {
        event.preventDefault();
        jumpBlock(reader, -1);
      }
      if (event.key === "+" || event.key === "=") {
        onPreferences({ fontScale: clamp(preferences.fontScale + 0.08, 0.75, 1.8) });
      }
      if (event.key === "-") {
        onPreferences({ fontScale: clamp(preferences.fontScale - 0.08, 0.75, 1.8) });
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onPreferences, preferences.fontScale, reader]);

  useEffect(() => {
    if (mode !== "voice") {
      setVoiceStatus("off");
      setConfirmedWordIndex(undefined);
      confirmedWordRef.current = undefined;
      return;
    }
    if (!reader || document?.kind !== "html") {
      setVoiceStatus("waiting for text");
      return;
    }

    let stopped = false;
    let stopSession: StopSpeechSession | undefined;
    setVoiceStatus("starting");

    void startSpeechSession({
      locale: "en-US",
      onStatus: setVoiceStatus,
      onError: () => setVoiceStatus("microphone error"),
      onTranscript: (transcript) => {
        if (stopped) return;
      const match = findBestSpeechMatch(transcript, document.blocks, document.words, activeBlockRef.current);
      if (!match) {
        setVoiceStatus("listening");
        return;
      }

      const block = reader.querySelector<HTMLElement>(`[data-block-id="${match.block.id}"]`);
      if (block) {
        scrollBlockToPromptLine(reader, block);
        setActiveBlock(match.block.id);
        const nextConfirmed = Math.max(confirmedWordRef.current ?? -1, match.endWordIndex);
        confirmedWordRef.current = nextConfirmed;
        setConfirmedWordIndex(nextConfirmed);
        setVoiceStatus("following");
      }
      },
    })
      .then((stop) => {
        if (stopped) void stop();
        else stopSession = stop;
      })
      .catch(() => {
        if (!stopped) setVoiceStatus("not available");
      });

    return () => {
      stopped = true;
      void stopSession?.();
    };
  }, [document, mode, reader]);

  const themeClass = `reader-shell theme-${preferences.theme}`;
  const style = {
    "--reader-font-scale": preferences.fontScale.toString(),
    "--reader-line-height": preferences.lineHeight.toString(),
  } as React.CSSProperties;

  return (
    <main className={themeClass} style={style}>
      <aside className="reader-sidebar">
        <button className="icon-button" onClick={onBack} title="Home">
          <Home size={22} />
        </button>
        <div className="reader-title">
          <span>Talk {active.talk.number ?? active.talk.id}</span>
          <strong>{active.file.title ?? active.file.name}</strong>
        </div>
        <select
          className="file-select"
          value={active.file.id}
          onChange={(event) => {
            const nextFile = active.talk.files.find((file) => file.id === event.target.value);
            if (nextFile) onOpen({ talk: active.talk, file: nextFile });
          }}
        >
          {active.talk.files.map((file) => (
            <option key={file.id} value={file.id}>
              {file.title ?? file.name}
            </option>
          ))}
        </select>
        <div className="progress-label">{progress}%</div>
        <div className="vertical-progress" aria-hidden="true">
          <span style={{ height: `${progress}%` }} />
        </div>
      </aside>

      <section className="reader-stage" data-testid="reader-stage">
        <div className="top-bar">
          <div>
            <p>{active.talk.title}</p>
            <strong>{active.file.name}</strong>
          </div>
          <div className="mode-tabs" role="tablist" aria-label="Teleprompter mode">
            {(["manual", "timed", "voice"] as ReaderMode[]).map((item) => (
              <button
                className={item === mode ? "active" : ""}
                key={item}
                onClick={() => {
                  setMode(item);
                  setPlaying(item === "timed");
                }}
              >
                {item === "voice" ? <Mic size={16} /> : item === "timed" ? <Clock size={16} /> : <FileText size={16} />}
                {item}
              </button>
            ))}
          </div>
        </div>

        <div
          className="document-view"
          data-testid="document-view"
          ref={setReader}
          onClick={(event) => {
            if (!reader) return;
            const rect = reader.getBoundingClientRect();
            const y = event.clientY - rect.top;
            if (y > rect.height * 0.7) jumpBlock(reader, 1);
            if (y < rect.height * 0.25) jumpBlock(reader, -1);
          }}
        >
          {error && <ErrorScreen message={error} />}
          {!error && !document && <div className="loading">Loading talk...</div>}
          {document?.kind === "html" && <article className="talk-document" data-testid="talk-document" dangerouslySetInnerHTML={{ __html: document.html }} />}
          {document?.kind === "pdf" && (
            <iframe className="pdf-frame" src={document.url} title={active.file.title ?? active.file.name} />
          )}
        </div>

        <Controls
          mode={mode}
          playing={playing}
          progress={progress}
          preferences={preferences}
          voiceStatus={voiceStatus}
          onMode={setMode}
          onPlay={setPlaying}
          onPreferences={onPreferences}
          onReset={() => {
            if (reader) reader.scrollTop = 0;
          }}
          onJump={(direction) => {
            if (reader) jumpBlock(reader, direction);
          }}
        />
      </section>
    </main>
  );
}

function Controls({
  mode,
  playing,
  progress,
  preferences,
  voiceStatus,
  onMode,
  onPlay,
  onPreferences,
  onReset,
  onJump,
}: {
  mode: ReaderMode;
  playing: boolean;
  progress: number;
  preferences: ReaderPreferences;
  voiceStatus: string;
  onMode: (mode: ReaderMode) => void;
  onPlay: (playing: boolean) => void;
  onPreferences: (next: Partial<ReaderPreferences>) => void;
  onReset: () => void;
  onJump: (direction: -1 | 1) => void;
}) {
  return (
    <footer className="control-bar">
      <button className="icon-button" onClick={() => onJump(-1)} title="Previous paragraph">
        ↑
      </button>
      <button className="play-button" onClick={() => {
        onMode("timed");
        onPlay(!playing);
      }}>
        {playing && mode === "timed" ? <Pause size={22} /> : <Play size={22} />}
        {playing && mode === "timed" ? "Pause" : "Start"}
      </button>
      <button className="icon-button" onClick={() => onJump(1)} title="Next paragraph">
        ↓
      </button>
      <div className="slider-control">
        <Gauge size={18} />
        <input
          aria-label="Speed"
          max="1.8"
          min="0.4"
          step="0.05"
          type="range"
          value={preferences.speedMultiplier}
          onChange={(event) => onPreferences({ speedMultiplier: Number(event.target.value) })}
        />
        <span>{preferences.speedMultiplier.toFixed(2)}x</span>
      </div>
      <div className="slider-control">
        <Clock size={18} />
        <input
          aria-label="Target minutes"
          max="45"
          min="5"
          step="1"
          type="range"
          value={preferences.targetMinutes}
          onChange={(event) => onPreferences({ targetMinutes: Number(event.target.value) })}
        />
        <span>{preferences.targetMinutes}m</span>
      </div>
      <button className="icon-button" onClick={() => onPreferences({ fontScale: clamp(preferences.fontScale - 0.08, 0.75, 1.8) })} title="Smaller text">
        <ZoomOut size={21} />
      </button>
      <button className="icon-button" onClick={() => onPreferences({ fontScale: clamp(preferences.fontScale + 0.08, 0.75, 1.8) })} title="Larger text">
        <ZoomIn size={21} />
      </button>
      <button className="icon-button" onClick={() => onPreferences({ theme: preferences.theme === "dark" ? "warm" : "dark" })} title="Theme">
        {preferences.theme === "dark" ? <Sun size={21} /> : <Moon size={21} />}
      </button>
      <button className="icon-button" onClick={onReset} title="Reset">
        <RotateCcw size={20} />
      </button>
      <div className="status-readout">
        {progress}% · {mode === "voice" ? voiceStatus : mode}
      </div>
    </footer>
  );
}

function findCurrentBlock(root: HTMLElement) {
  const blocks = Array.from(root.querySelectorAll<HTMLElement>("[data-block-id]"));
  const stageTop = root.getBoundingClientRect().top + root.clientHeight * 0.24;
  return blocks.find((block) => block.getBoundingClientRect().bottom > stageTop) ?? blocks[0];
}

function jumpBlock(root: HTMLElement, direction: -1 | 1) {
  const blocks = Array.from(root.querySelectorAll<HTMLElement>("[data-block-id]"));
  if (!blocks.length) {
    root.scrollBy({ top: direction * root.clientHeight * 0.55, behavior: "smooth" });
    return;
  }

  const lowerPromptLine = root.scrollTop + root.clientHeight * 0.34;
  const upperPromptLine = root.scrollTop + root.clientHeight * 0.16;
  const next =
    direction === 1
      ? blocks.find((block) => block.offsetTop > lowerPromptLine) ?? blocks[blocks.length - 1]
      : [...blocks].reverse().find((block) => block.offsetTop < upperPromptLine) ?? blocks[0];

  scrollBlockToPromptLine(root, next);
}

function scrollBlockToPromptLine(root: HTMLElement, block: HTMLElement) {
  root.scrollTo({
    top: clamp(block.offsetTop - root.clientHeight * 0.18, 0, root.scrollHeight - root.clientHeight),
    behavior: "smooth",
  });
}

function ErrorScreen({ message }: { message: string }) {
  return (
    <div className="error-screen">
      <h1>Could not open the talk</h1>
      <p>{message}</p>
    </div>
  );
}
