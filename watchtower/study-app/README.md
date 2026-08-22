# Watchtower Study App

Tablet-focused reader for generated Watchtower Study answer files.

## Run Locally

```bash
npm install
npm run dev
```

Open `http://127.0.0.1:8318/`.

## Build

```bash
npm test
npm run build
```

## Android / Samsung Tablet

This is scaffolded as a Tauri 2 app. After Android tooling is configured:

```bash
npm run android:init
npm run android:build
```

## Study Library

The app reads from `public/studies/watchtower-manifest.json`, but that folder is generated from the normal Watchtower output folders.

Source-of-truth files should live under the existing weekly structure:

```text
watchtower/YYYY-MM/YYYY-MM-DD-ans-bi.md
watchtower/YYYY-MM/YYYY-MM-DD-ans-bi.html
watchtower/YYYY-MM/YYYY-MM-DD-ans-bi.pdf
watchtower/YYYY-MM/YYYY-MM-DD-article-en.html
watchtower/YYYY-MM/YYYY-MM-DD-article-tl.html
watchtower/YYYY-MM/YYYY-MM-DD-article-en.pdf
watchtower/YYYY-MM/YYYY-MM-DD-article-tl.pdf
watchtower/YYYY-MM/YYYY-MM-DD-article-paragraphs.json
watchtower/YYYY-MM/YYYY-MM-DD-study-package.json
```

The answer files come from the `jw-study-output` workflow. The article HTML and paragraph JSON can be prepared after the English and Tagalog article URLs are verified:

```bash
npm run prepare:source -- ../2026-08 2026-08-15 \
  'https://www.jw.org/en/library/magazines/watchtower-study-june-2026/How-to-Remain-Loyal-When-We-Face-Tests-of-Faith/' \
  'https://www.jw.org/tl/library/magasin/bantayan-pag-aaral-hunyo-2026/Kung-Paano-Makakapanatiling-Tapat-Kapag-May-mga-Problema/'
```

Then refresh the app library:

```bash
npm run sync:library
```

`sync:library` builds and copies `YYYY-MM-DD-study-package.json`. That single JSON file is the portable tablet package. Copy it to the Samsung tablet and use **Import Package** inside the installed app.

PDF files are parsed with PDF.js when possible and otherwise shown as embedded source material. The article source HTML/PDF files are kept separate from the answer PDF.
