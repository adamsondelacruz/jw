# Plan - Tablet Talk Teleprompter App

Project: **JW Talk Teleprompter**  
Goal: production-ready tablet app for talk delivery  
Created: 2026-08-19

## Objective

Build a tablet-friendly teleprompter app that loads talk manuscripts, guides, and rendered files from the `talk/` workspace and helps the speaker deliver naturally with readable text, reliable scrolling, and fast recovery cues.

## Scope

### Must Have

- Home screen listing available talks.
- Talk number and theme visible.
- Load files from talk folders.
- Support Markdown and HTML for first production version.
- Support PDF viewing after core reader is stable.
- Manual scrolling that is dependable on tablet.
- Timed scrolling with live speed control.
- Portrait and landscape layouts.
- Large readable type and stage-safe spacing.
- Preserve existing highlight cues from `draft-talk-v3.html`.
- Remember last position and display preferences.
- Offline-capable PWA behavior.

### Should Have

- Current section indicator.
- Next anchor preview.
- Progress by document position and estimated time.
- Brightness/theme controls.
- Tap zones for next/previous paragraph.
- Keyboard/Bluetooth presenter support.
- Talk manifest generated from folders.

### Later

- Voice-assisted scrolling.
- PDF text sync.
- Rehearsal timing logs.
- Import/export talk packages.
- Native wrapper for iPad/Android if browser PWA is insufficient.

## Phase 1 - App Foundation

Deliverables:

- Create `talk/teleprompter/`.
- Add Vite + React + TypeScript.
- Add app shell with routing:
  - home/library.
  - reader.
  - settings.
- Add base responsive CSS.
- Add sample static manifest for `talk/055`.

Acceptance:

- App starts locally.
- Home screen shows Talk 055.
- Reader route opens a selected file.
- Works at tablet portrait and landscape viewport sizes.

## Phase 2 - Talk Library

Deliverables:

- Define `Talk`, `TalkFile`, and `ReaderState` types.
- Load `talk-manifest.json`.
- Detect file role:
  - manuscript.
  - extemp guide.
  - metrics.
  - source outline.
- Show talk number, theme, file types, and preferred launch.

Acceptance:

- Talk 055 displays as `055 - How Can You Make a Good Name With God?`.
- `draft-talk-v3.html`, `v3-extemp-guide.html`, and `metrics-index.html` are visible.
- Recent/preferred file is remembered.

## Phase 3 - HTML/Markdown Reader

Deliverables:

- Render HTML files safely.
- Render Markdown files safely.
- Preserve delivery classes:
  - `.kw`
  - `.kw-green`
  - `.kw-orange`
  - `.kw-blue`
  - `.subtle`
- Split document into readable blocks.
- Add current block highlighting.
- Add heading navigation.

Acceptance:

- `draft-talk-v3.html` displays with highlighting intact.
- The reader can jump by section.
- Text remains readable in portrait and landscape.
- No overlapping text or broken wrapping.

## Phase 4 - Manual Teleprompter Controls

Deliverables:

- Touch scroll.
- Tap zones:
  - lower area: next block.
  - upper area: previous block.
- Keyboard controls:
  - Space: play/pause timed mode.
  - ArrowDown/PageDown: next block.
  - ArrowUp/PageUp: previous block.
  - Plus/minus: font size.
- Hideable control bar.

Acceptance:

- Speaker can deliver without touching small controls.
- Current paragraph remains visible.
- Manual override works during timed mode.

## Phase 5 - Timed Scroll

Deliverables:

- Target duration setting.
- Section duration awareness when headings contain minutes.
- Play/pause.
- Speed multiplier.
- Remaining time display.
- Pause or slow near read scripture prompts.

Acceptance:

- Timed mode can complete a talk in a chosen target time.
- User can adjust speed live without losing place.
- Timed mode does not fight manual scrolling.

## Phase 6 - Persistence And Offline

Deliverables:

- IndexedDB store for:
  - talk metadata.
  - reader position.
  - display settings.
  - timing settings.
- PWA manifest.
- Service worker caching app shell and manifest.

Acceptance:

- App works after refresh.
- Last opened talk and scroll position restore.
- App opens offline after first load.

## Phase 7 - PDF Support

Deliverables:

- Add PDF.js.
- Render pages in reader.
- Manual/timed scroll support for PDF.
- Page thumbnails or section/page jump.

Acceptance:

- `draft-talk-v3.pdf` opens and scrolls smoothly.
- Page count and position display correctly.
- PDF mode has the same basic controls as HTML/Markdown.

## Phase 8 - Voice-Assisted Prototype

Deliverables:

- Web Speech API detection.
- Microphone permission prompt only when enabling voice mode.
- Approximate text matching near current block.
- Conservative auto-advance.
- Clear status:
  - listening.
  - following.
  - uncertain.
  - paused.

Acceptance:

- Voice mode follows a practiced reading under good conditions.
- If confidence drops, it pauses instead of jumping.
- Manual control immediately overrides voice mode.

## Phase 9 - Production Hardening

Deliverables:

- Playwright tests.
- Tablet viewport screenshots:
  - iPad portrait.
  - iPad landscape.
  - Android tablet portrait.
  - Android tablet landscape.
- Accessibility checks:
  - contrast.
  - focus states.
  - controls reachable.
- Error states:
  - missing file.
  - unsupported file.
  - corrupted manifest.
- Build script.

Acceptance:

- Tests pass.
- Production build succeeds.
- App can be used end-to-end with Talk 055.
- No network is required for normal delivery.

## First Build Decision

Start with:

- Vite + React + TypeScript.
- Static manifest.
- HTML and Markdown reader.
- Manual mode.
- Timed mode.
- Portrait/landscape responsive layout.

Defer:

- PDF.js until the reader works well.
- Voice-assisted scrolling until manual/timed modes are dependable.

## Definition Of Done

The app is production ready when a speaker can:

1. Open the app on a tablet.
2. Select Talk 055 from the home screen.
3. Open `draft-talk-v3.html`.
4. Use large readable text in portrait or landscape.
5. Start timed scrolling for a 30-minute talk.
6. Pause or adjust speed instantly.
7. Recover place using highlighted keywords.
8. Close and reopen the app with position restored.
9. Use the app offline.

## Immediate Next Steps

1. Scaffold `talk/teleprompter/`.
2. Create sample `talk-manifest.json` for existing talk folders.
3. Implement home screen and reader route.
4. Load Talk 055 HTML as first real fixture.
5. Add manual controls and font controls.
6. Add timed mode.
7. Verify portrait and landscape with screenshots.
