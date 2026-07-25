# Agent Notes

## Watchtower Study Article Lookup

When asked to prepare answers for the current Watchtower Study article:

1. Use the current date and identify the study week.
2. Go to JW.org's Watchtower Study Edition magazine page in English:
   `https://www.jw.org/en/library/magazines/`
3. Open the Watchtower Study issue whose listed study weeks include the current date.
   For example, the May 2026 Study Edition contains study articles for July 6-August 9, 2026.
4. Select the article for the matching week.
5. To find the Tagalog version, use the language selector near the top bar, close to Login, or derive and verify the Tagalog URL:
   - English paths usually use `/en/library/magazines/watchtower-study-{month}-{year}/...`
   - Tagalog paths usually use `/tl/library/magasin/bantayan-pag-aaral-{tagalog-month}-{year}/...`
6. Always verify the Tagalog URL by opening it. Do not assume the translated slug.

Example verified pair for July 13-19, 2026:

- English: `https://www.jw.org/en/library/magazines/watchtower-study-may-2026/Your-Conscience-Use-Bible-Principles-to-Train-It/`
- Tagalog: `https://www.jw.org/tl/library/magasin/bantayan-pag-aaral-mayo-2026/Sanayin-ang-Konsensiya-Mo-Gamit-ang-mga-Prinsipyo-sa-Bibliya/`

For generated study answers, ground each answer in the current paragraph and use only scripture references cited in that paragraph unless the user says otherwise.

## Watchtower Study Output Format

When the user asks to generate the current Watchtower Study answers, pattern the output after the files in `watchtower/2026-07/`.

If available, use the local Codex skill `jw-study-output` for this workflow. The repo renderer `watchtower/render_bilingual_study.py` can convert the agreed Markdown structure into the styled HTML format, and headless Chrome can print that HTML to PDF.

Current preferred output pattern:

- Use the current folder structure: `watchtower/YYYY-MM/`
- Use bilingual filenames: `YYYY-MM-DD-ans-bi.md`, `YYYY-MM-DD-ans-bi.html`, and when practical `YYYY-MM-DD-ans-bi.pdf`
- The date in the filename should be the meeting/week date used by the existing Watchtower output pattern, matching the current study week.
- Keep the tone easy to understand, natural, and suitable for comments at the meeting.
- Each question should have two answers:
  - `ANS1 -- Direct`: direct answer from the paragraph.
  - `ANS2 -- Deeper`: still tied to the same paragraph, but with a deeper spiritual angle, usually based on what the paragraph teaches about Jehovah or how the information can draw us closer to him.
- Each answer should be about 25-30 seconds when spoken.
- Include English and Tagalog for each answer, as in the `2026-07` examples.
- Use only scriptures cited in the paragraph being answered. If a paragraph cites no scripture, do not introduce scriptures from elsewhere.
- If one numbered paragraph has split questions, such as `6a` and `6b`, treat them as separate questions and produce two answers for each one.
- Preserve the article's question wording as-is as much as possible, including the Tagalog question when the Tagalog article is available.

## Other Recurring JW Tasks

Apply the same "learn the local pattern first" approach to other recurring tasks, such as midweek meeting material, talks, field service, or other JW study files:

1. Inspect the relevant existing folder and recent outputs first.
2. Follow the current folder structure and naming convention already used in this workspace.
3. Match the tone, bilingual pattern, and output formats from nearby examples unless the user gives a different instruction.
4. When source material is available in both English and Tagalog, verify the matching Tagalog JW.org page instead of guessing the translated URL.
5. Prefer script-assisted rendering for repeatable output formatting instead of hand-building HTML.
