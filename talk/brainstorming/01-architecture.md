# Architecture - Tablet Talk Teleprompter

Project: **JW Talk Teleprompter**  
Status: proposed architecture  
Vision source: [00-canonical-vision.md](00-canonical-vision.md)

## Architecture Goals

- Local-first and offline-capable.
- Tablet-first reader with portrait and landscape support.
- Supports MD, HTML, and PDF delivery files.
- Discovers talks from the existing `talk/` folder structure.
- Offers reliable manual scrolling first, then timed scrolling, then optional voice-assisted scrolling.
- Keeps speech/audio private by default.
- Has a production path for tests, packaging, and deployment.

## Recommended App Shape

Build as a **Progressive Web App**.

Why:

- Works on tablets without app-store packaging at first.
- Can run full screen from a browser.
- Can cache assets for offline use.
- Can use local file access APIs where supported.
- Can later be wrapped as a native app if needed.

Recommended stack:

- **Vite + React + TypeScript** for the app.
- **CSS modules or plain CSS** for predictable tablet styling.
- **Marked or markdown-it** for Markdown rendering.
- **DOMPurify** for sanitizing imported HTML/Markdown output.
- **PDF.js** for PDF rendering.
- **IndexedDB** for talk library metadata, reading positions, preferences, and cached files.
- **Web Speech API** for optional voice-assisted mode where browser support allows.
- **Playwright** for layout and interaction tests.

## Proposed Location

```text
talk/
  teleprompter/
    package.json
    src/
    public/
    tests/
    README.md
```

This keeps the app close to the talk material while separate from individual talk folders.

## Data Model

### Talk

```ts
type Talk = {
  id: string;              // "055"
  number?: string;         // "55"
  title: string;           // "How Can You Make a Good Name With God?"
  folderPath?: string;     // local folder handle/path when available
  files: TalkFile[];
  metrics?: TalkMetrics;
  lastOpenedFileId?: string;
  updatedAt?: string;
};
```

### Talk File

```ts
type TalkFile = {
  id: string;
  name: string;
  kind: "markdown" | "html" | "pdf" | "docx" | "unknown";
  role?: "manuscript" | "extemp" | "metrics" | "resources" | "outline";
  version?: string;        // "v3"
  title?: string;
  wordCount?: number;
  readScriptures?: string[];
  sourceUrl?: string;
};
```

### Reader State

```ts
type ReaderState = {
  talkId: string;
  fileId: string;
  scrollTop: number;
  activeBlockId?: string;
  mode: "manual" | "timed" | "voice";
  fontScale: number;
  lineHeight: number;
  theme: "light" | "warm" | "dark";
  orientation: "portrait" | "landscape";
  targetMinutes?: number;
  speedMultiplier: number;
};
```

## Talk Discovery

The app should support two discovery paths:

### Browser File Picker

User chooses the root `talk/` folder.

The app scans:

- numeric folders, such as `055`.
- `index.md`.
- manuscript candidates: `draft-talk*.md`, `draft-talk*.html`, `*.pdf`.
- guide candidates: `*extemp*.md`, `*guide*.md`.
- metrics candidates: `metrics-index.md`, `metrics-index.html`.

### Static Manifest

For hosted or local server use, generate a `talk-manifest.json` file.

```json
{
  "talks": [
    {
      "id": "055",
      "title": "How Can You Make a Good Name With God?",
      "files": [
        "draft-talk-v3.html",
        "draft-talk-v3.pdf",
        "v3-extemp-guide.html"
      ]
    }
  ]
}
```

The static manifest is simpler and more reliable for first production version.

## Document Pipeline

### Markdown

1. Read Markdown.
2. Extract metadata:
   - title.
   - section headings.
   - start minutes.
   - read scriptures.
   - highlight spans.
3. Render sanitized HTML.
4. Split content into blocks:
   - headings.
   - cue paragraphs.
   - manuscript paragraphs.
   - scripture prompts.
   - lists.
5. Assign stable block IDs.

### HTML

1. Load sanitized HTML.
2. Preserve existing classes:
   - `.kw`
   - `.kw-green`
   - `.kw-orange`
   - `.kw-blue`
   - `.subtle`
   - delivery cues.
3. Extract text blocks for progress tracking.

### PDF

1. Render pages using PDF.js.
2. Allow manual and timed scrolling by page/position.
3. Extract text layer when available.
4. Voice-assisted mode should be treated as experimental for PDF.

## Scrolling Modes

### Manual Mode

Manual mode is the baseline and must always work.

Inputs:

- touch drag.
- tap zones.
- keyboard arrows.
- Bluetooth presenter.
- optional foot pedal mapped to keyboard.

Behaviors:

- tap lower third: advance one paragraph.
- tap upper third: go back one paragraph.
- two-finger tap: pause/resume.
- swipe: free scroll.

### Timed Mode

Timed mode estimates scroll speed from:

- total document height.
- target duration.
- current position.
- remaining time.

Controls:

- start/pause.
- speed down/up.
- jump to heading.
- reset to current section.

Timed mode should slow around headings and read scriptures. It should not scroll continuously during a scripture-reading pause unless configured.

### Voice-Assisted Mode

Voice-assisted mode should be optional and conservative.

Possible implementation:

1. Preprocess document into short searchable chunks.
2. Listen through Web Speech API.
3. Normalize recognized speech and document chunks.
4. Match recent spoken phrase against nearby chunks.
5. If confidence is high, advance active block.
6. If confidence is low, do nothing.

Important safeguards:

- Never jump more than a small number of blocks automatically.
- Show a subtle "following" or "paused" status.
- Allow instant manual override.
- Do not send audio to custom servers.

## Layout

### Home

Views:

- Talk library.
- Recent talks.
- Search/filter by number or title.
- File badges: MD, HTML, PDF, guide, metrics.

### Reader

Portrait:

- single-column text.
- current block highlighted.
- controls hidden by default.
- bottom progress bar.

Landscape:

- wider single-column text, or
- optional side rail with:
  - section list.
  - current time.
  - next anchor.

### Typography

Defaults:

- font size: large.
- line height: 1.45 to 1.65.
- max line length controlled.
- high contrast but not harsh.
- warm/light/dark themes.
- highlight colors must be visible in daylight.

## Persistence

Use IndexedDB for:

- imported talks.
- file metadata.
- reading position.
- display preferences.
- last opened talk.
- rehearsal timing logs.

Use localStorage only for small noncritical preferences.

## Privacy

- All normal operation should work offline.
- Speech recognition should use browser capability only.
- No manuscript or audio should be uploaded by default.
- If any cloud feature is added later, it must be opt-in and clearly labeled.

## Testing

Minimum production tests:

- talk discovery from sample folders.
- metadata extraction from Markdown.
- HTML sanitization preserves highlight classes.
- reader restores last position.
- portrait and landscape screenshots.
- timed scroll pause/resume.
- keyboard/remote controls.
- PDF rendering smoke test.

## First Production Slice

The first production-ready version should include:

- static talk manifest.
- home library.
- HTML/Markdown reader.
- manual mode.
- timed mode.
- persistent settings.
- responsive portrait/landscape layout.
- generated sample manifest for `talk/055`.
- Playwright visual checks.

PDF.js and voice-assisted mode can follow once the core reader is reliable.

## Key Risks

- Voice recognition may be inconsistent on tablets and browsers.
- PDF text extraction may not match visual order.
- Browser local folder access varies by platform.
- Over-automation could distract the speaker.

Design response:

- Make manual mode excellent.
- Make timed mode simple and adjustable.
- Make voice mode optional and conservative.
