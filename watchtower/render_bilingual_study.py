#!/usr/bin/env python3
"""Render bilingual JW study Markdown into the styled HTML format used here."""

from __future__ import annotations

import argparse
import html
import re
from pathlib import Path


CSS = r"""
  :root { --bg: #fafaf7; --fg: #1f2933; --accent: #5b8a72; --muted: #9aa0a6; --rule: #d4d4d0; --direct: #4a6fa5; --direct-soft: #ecf0f7; --deeper: #8a5b72; --deeper-soft: #f5ecf0; --tl-fg: #3f4754; --chip-bg: #d9e2ef; --chip-fg: #3a5586; --chip-tl-bg: #e7dce4; --chip-tl-fg: #6d4257; --note-bg: #fdf6e3; --note-fg: #6b5d3a; }
  @media (prefers-color-scheme: dark) { :root { --bg: #1a1d21; --fg: #e6e6e3; --accent: #8fbfa3; --muted: #7b8088; --rule: #3a3d42; --direct: #9ab3d4; --direct-soft: #232a36; --deeper: #c79dab; --deeper-soft: #2e2429; --tl-fg: #c2c7cf; --chip-bg: #2c3a52; --chip-fg: #9ab3d4; --chip-tl-bg: #3d2d37; --chip-tl-fg: #c79dab; --note-bg: #2a2820; --note-fg: #c9bb8e; } }
  * { box-sizing: border-box; }
  html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif; background: var(--bg); color: var(--fg); line-height: 1.6; max-width: 820px; margin: 0 auto; padding: 2.5rem 1.5rem 4rem; }
  header { border-bottom: 2px solid var(--accent); padding-bottom: 1rem; margin-bottom: 1.5rem; }
  h1 { font-size: 1.6rem; margin: 0 0 0.4rem; color: var(--accent); font-weight: 700; }
  .subtitle { font-size: 0.92rem; color: var(--muted); margin: 0; }
  .subtitle em { font-style: italic; color: var(--fg); }
  .note { background: var(--note-bg); color: var(--note-fg); font-size: 0.82rem; padding: 0.6rem 0.9rem; border-radius: 4px; margin-bottom: 1.5rem; }
  h2.section-heading { margin: 2.5rem 0 0.5rem; font-size: 1.1rem; color: var(--accent); text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid var(--rule); padding-bottom: 0.3rem; }
  .qa-block { margin-top: 1.75rem; }
  .question { color: var(--muted); font-style: italic; font-size: 0.9rem; margin: 0; padding-left: 0.5rem; border-left: 2px solid var(--rule); }
  .question.tl { opacity: 0.82; margin-top: 0.15rem; }
  .qnum { font-weight: 600; margin-right: 0.35rem; }
  .ans { margin: 0.7rem 0; padding: 0.5rem 1rem 0.75rem; border-radius: 3px; }
  .ans.direct { background: var(--direct-soft); border-left: 3px solid var(--direct); }
  .ans.deeper { background: var(--deeper-soft); border-left: 3px solid var(--deeper); }
  .ans-head { font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; font-size: 0.74rem; margin: 0.25rem 0 0.4rem; }
  .ans.direct .ans-head { color: var(--direct); }
  .ans.deeper .ans-head { color: var(--deeper); }
  .line { margin: 0.35rem 0; display: flex; gap: 0.5rem; align-items: baseline; }
  .line p { margin: 0; }
  .line.tl p { color: var(--tl-fg); }
  .chip { flex: 0 0 auto; font-size: 0.62rem; font-weight: 700; letter-spacing: 0.05em; padding: 0.08rem 0.35rem; border-radius: 3px; position: relative; top: -0.05rem; }
  .chip.en { background: var(--chip-bg); color: var(--chip-fg); }
  .chip.tl { background: var(--chip-tl-bg); color: var(--chip-tl-fg); }
  strong.scripture { color: var(--accent); }
  footer { margin-top: 3rem; padding-top: 1rem; border-top: 1px solid var(--rule); font-size: 0.85rem; color: var(--muted); text-align: center; }
  @media print { body { max-width: none; padding: 1rem; font-size: 10pt; } .qa-block { break-inside: avoid; } .ans.direct { background: #f0f4fa; } .ans.deeper { background: #faf2f5; } .note { background: #fbf6e6; } }
"""


def inline(text: str) -> str:
    escaped = html.escape(text, quote=False)
    escaped = re.sub(r"\*\*([^*]+)\*\*", r'<strong class="scripture">\1</strong>', escaped)
    escaped = re.sub(r"\*([^*]+)\*", r"<em>\1</em>", escaped)
    return escaped


def is_tl(question: str) -> bool:
    markers = ("Ang ", "Ano ", "Anong ", "Paano ", "Bakit ", "Kailan ", "Sino ", "Kung ", "Base ", "Dapat ")
    return question.startswith(markers) or any(marker in question for marker in markers + ("Jehova", "Kristiyano", "Bibliya", "edukasyon", "karagdagang"))


def strip_md(line: str) -> str:
    return line.strip().strip("*")


def render(markdown: str, title: str, footer: str) -> str:
    lines = markdown.splitlines()
    doc_title = next((line[2:].strip() for line in lines if line.startswith("# ")), title)
    subtitle = next((strip_md(line) for line in lines if line.startswith("**The Watchtower")), "")
    song_en = next((strip_md(line) for line in lines if line.startswith("*Song")), "")
    song_tl = next((strip_md(line) for line in lines if line.startswith("*Awit")), "")
    note = ""
    body: list[str] = []
    in_block = False
    current_ans: str | None = None
    answer_lines: list[tuple[str, str]] = []

    def close_answer() -> None:
        nonlocal current_ans, answer_lines
        if current_ans is None:
            return
        values = {lang: text for lang, text in answer_lines}
        kind = "direct" if current_ans == "ANS1" else "deeper"
        heading = "ANS1 &mdash; Direct" if current_ans == "ANS1" else "ANS2 &mdash; Deeper"
        body.append(f'  <div class="ans {kind}">')
        body.append(f'    <p class="ans-head">{heading}</p>')
        if values.get("EN"):
            body.append(f'    <div class="line"><span class="chip en">EN</span><p>{inline(values["EN"])}</p></div>')
        if values.get("TL"):
            body.append(f'    <div class="line tl"><span class="chip tl">TL</span><p>{inline(values["TL"])}</p></div>')
        body.append("  </div>")
        current_ans = None
        answer_lines = []

    def close_block() -> None:
        nonlocal in_block
        close_answer()
        if in_block:
            body.append("</div>")
            body.append("")
        in_block = False

    for raw in lines:
        line = raw.rstrip()
        if not line:
            continue
        if line.startswith("> *Note:"):
            note = line.replace("> *", "", 1).rstrip("*").strip()
            note = note.removeprefix("Note:").strip()
            continue
        match = re.match(r"\*\*(ANS[12]) - (Direct|Deeper) \((EN|TL)\):\*\*\s*(.*)", line)
        if match:
            ans, _, lang, text = match.groups()
            if current_ans is not None and ans != current_ans:
                close_answer()
            current_ans = ans
            answer_lines.append((lang, text))
            continue
        if line == "---":
            close_block()
            continue
        if line.startswith("# ") or line.startswith("**") or line.startswith("*Song") or line.startswith("*Awit"):
            continue
        if line.startswith("## "):
            close_block()
            body.append(f'<h2 class="section-heading">{inline(line[3:].strip())}</h2>')
            body.append("")
            continue
        if line.startswith("> *<sub>"):
            close_answer()
            if not in_block:
                body.append('<div class="qa-block">')
                in_block = True
            question = line.replace("> *<sub>", "", 1).replace("</sub>*", "").replace("  ", "").strip()
            question = re.sub(r"\*\*([^*]+)\*\*", r'<span class="qnum">\1</span>', question)
            klass = "question tl" if is_tl(re.sub("<[^>]+>", "", question).strip()) else "question"
            body.append(f'  <p class="{klass}">{question}</p>')
            continue
    close_block()

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{html.escape(title)}</title>
<style>{CSS}</style>
</head>
<body>
<header>
  <h1>{html.escape(doc_title)}</h1>
  <p class="subtitle">{inline(subtitle)} &nbsp;|&nbsp; Bilingual EN / TL<br>
  {inline(song_en)}<br>
  {inline(song_tl)}</p>
</header>

<div class="note">{inline(note)}</div>

{chr(10).join(body)}
<footer>{html.escape(footer)}</footer>
</body>
</html>
"""


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("markdown", type=Path)
    parser.add_argument("--title", required=True)
    parser.add_argument("--footer", default="Generated study output")
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()

    output = args.output or args.markdown.with_suffix(".html")
    output.write_text(render(args.markdown.read_text(), args.title, args.footer))


if __name__ == "__main__":
    main()
