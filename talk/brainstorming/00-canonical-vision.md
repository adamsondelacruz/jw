# Canonical Vision - Tablet Talk Teleprompter

Project: **JW Talk Teleprompter**  
Workspace: `talk/`  
Vision date: 2026-08-19

## Product Vision

Create a tablet-first teleprompter app that helps a speaker deliver public talks naturally from prepared manuscripts, extemporaneous guides, or PDF/HTML/Markdown files.

The app should not feel like a document viewer with scrolling added. It should feel like a quiet stage tool: easy to read, easy to recover your place, and safe to use during a live talk.

## Core Purpose

Help the speaker maintain eye contact and natural delivery while having a reliable visual guide nearby.

The app should answer one practical question:

> If I briefly lose my place, can my eyes recover the next thought in less than two seconds?

## Primary User

The first user is a public talk speaker using a tablet on stage.

The speaker may:

- deliver from a full manuscript.
- deliver from an extemporaneous keyword guide.
- switch between portrait and landscape orientation.
- need large type and strong visual anchors.
- want scrolling to follow the pace of delivery.
- need manual control when automatic scrolling is not reliable.

## Home Screen

The home screen should show all available talks as a simple library.

Each talk appears as a row or card with:

- talk number.
- theme/title.
- available versions: manuscript, extemp guide, metrics, PDF, HTML, MD.
- last modified date.
- estimated delivery time.
- quick launch button for the preferred delivery file.

Expected talk folder pattern:

```text
talk/
  055/
    index.md
    draft-talk-v3.md
    draft-talk-v3.html
    draft-talk-v3.pdf
    v3-extemp-guide.md
    metrics-index.md
```

The app should prefer metadata from each talk folder's `index.md` and metrics files when available.

## Reader Experience

The reader must be optimized for stage use:

- large text by default.
- high contrast without harsh glare.
- generous line height.
- clear paragraph spacing.
- visible current line or current paragraph.
- no distracting toolbars while speaking.
- quick access to pause, resume, speed, jump, and font size.
- safe full-screen mode.
- works in portrait and landscape.
- remembers position per talk.

## Teleprompter Behavior

The app should support three scrolling modes:

### 1. Manual Mode

The speaker controls movement by touch, keyboard, remote, or foot pedal.

This must be the most reliable mode.

### 2. Timed Mode

The speaker sets a target duration or section duration. The app scrolls at a calculated pace.

The speaker can adjust speed live.

### 3. Voice-Assisted Mode

The app listens for approximate progress and scrolls when the spoken content appears close to the visible manuscript.

This should be optional. It should never be the only control method.

Voice-assisted scrolling should be forgiving:

- match phrases approximately.
- tolerate skipped subtle text.
- tolerate paraphrasing.
- pause when confidence is low.
- never jump far without confirmation or a gentle visual cue.

## Supported Source Formats

### Markdown

Preferred authoring format. The app should parse headings, cues, scriptures, keywords, and highlight spans.

### HTML

Preferred display format when already rendered from Markdown. It preserves styling such as highlight colors, cues, and indentation.

### PDF

Useful for final print-like delivery. PDF support should allow viewing and manual/timed scrolling. Voice-assisted sync is harder with PDF and should depend on extracted text when available.

## Visual Language

The app should preserve useful manuscript markup:

- green highlights: main idea / spiritual landing point.
- orange highlights: contrast / warning / turning point.
- blue highlights: action cue / question / practical step.
- small italic cues: delivery tone or action.
- headings with start minute and section duration.

The visual language should stay calm. Highlighting is for recovery, not decoration.

## Orientation

The app must work in both portrait and landscape.

Portrait:

- best for manuscript reading.
- more vertical context.
- comfortable one-column delivery.

Landscape:

- best for wider phrases and larger text.
- optional two-pane layout: current paragraph and next anchor.
- control bar can sit at side or bottom depending on tablet size.

The app should reflow instantly when the tablet rotates and keep the current paragraph in view.

## Talk Library

The app should scan `talk/` for talk folders.

A talk folder is any folder with:

- a numeric folder name, such as `055`, or
- an `index.md` file with a talk title.

The app should ignore temporary lock files, zip files, and resource-only folders unless explicitly opened.

## Ideal Delivery Screen

During delivery, the screen should show:

- current section heading.
- readable manuscript or guide.
- current paragraph subtly emphasized.
- upcoming anchor visible below.
- progress bar by time and document position.
- remaining time estimate.
- simple controls that can hide.

Possible controls:

- play/pause.
- speed down/up.
- jump to previous/next heading.
- font size down/up.
- brightness/theme.
- manual scroll lock.

## Production Quality Standard

The app is production ready when:

- it can load talk folders reliably.
- it can display MD, HTML, and PDF files.
- it works offline after installation.
- it works in portrait and landscape.
- text is readable from stage distance.
- manual mode is dependable.
- timed mode is adjustable during delivery.
- voice-assisted mode fails safely.
- position is autosaved.
- no network is required for normal use.
- no private speech/audio leaves the device by default.
- it has a clear error state for unsupported files.
- it has basic tests for parsing, talk discovery, and reader state.

## Guiding Principle

The app should help the speaker sound less like he is reading, not more.

Every design choice should support calm delivery, quick recovery, and confidence on stage.
