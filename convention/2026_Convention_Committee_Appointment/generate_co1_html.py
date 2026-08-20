#!/usr/bin/env python3
"""Create a readable, deeply linkable HTML edition of the local CO-1 PDF."""

from __future__ import annotations

from html import escape
from pathlib import Path
import re
import subprocess


ROOT = Path(__file__).resolve().parent
SOURCE = ROOT / "CO-1_s-BrAUS_E.pdf"
TARGET = ROOT / "CO-1.html"


def extract_text() -> str:
    result = subprocess.run(
        ["pdftotext", "-layout", str(SOURCE), "-"],
        check=True,
        capture_output=True,
        text=True,
    )
    return result.stdout.replace("\r", "")


def clean_paragraph(value: str) -> str:
    lines = []
    for line in value.splitlines():
        stripped = line.strip()
        if not stripped:
            continue
        if re.fullmatch(r"(?:Overview of Convention Organization|General Information|Instructions for Convention Departments)\s+Chapter [123]", stripped):
            continue
        if re.fullmatch(r".+\s+Appendix [A-F]", stripped):
            continue
        lines.append(stripped)
    text = " ".join(lines)
    text = re.sub(r"(?<=\w)- (?=[a-z])", "", text)
    return re.sub(r"\s+", " ", text).strip()


def link_citations(text: str) -> str:
    """Escape text and link CO-1 cross-references introduced by “See”."""
    citation = re.compile(
        r"\bSee\s+"
        r"(?P<refs>[123]:\d+(?:[-–]\d+)?(?:,\s*\d+(?:[-–]\d+)?)*"
        r"(?:;\s*[123]:\d+(?:[-–]\d+)?(?:,\s*\d+(?:[-–]\d+)?)*)*)"
    )
    output = []
    cursor = 0
    for match in citation.finditer(text):
        output.append(escape(text[cursor:match.start()]))
        output.append("See ")
        segments = []
        for segment in re.split(r"(;\s*)", match.group("refs")):
            if not segment or segment.startswith(";"):
                segments.append(escape(segment))
                continue
            chapter_match = re.match(r"([123]):", segment)
            if not chapter_match:
                segments.append(escape(segment))
                continue
            chapter = chapter_match.group(1)
            items = segment[len(chapter) + 1:].split(",")
            linked_items = []
            for index, raw_item in enumerate(items):
                item = raw_item.strip()
                first_paragraph = re.match(r"\d+", item).group(0)
                label = f"{chapter}:{item}" if index == 0 else item
                linked_items.append(
                    f'<a class="cross-reference" href="#co1-{chapter}-{first_paragraph}">{escape(label)}</a>'
                )
            segments.append(", ".join(linked_items))
        output.append("".join(segments))
        cursor = match.end()
    output.append(escape(text[cursor:]))
    return "".join(output)


def chapter_html(number: int, title: str, chunk: str) -> str:
    starts = list(re.finditer(r"(?m)^\s*(\d+)\.\s+", chunk))
    parts = [f'<section class="chapter" id="chapter-{number}">', f"<h2>Chapter {number}: {escape(title.title())}</h2>"]
    for index, match in enumerate(starts):
        paragraph = int(match.group(1))
        end = starts[index + 1].start() if index + 1 < len(starts) else len(chunk)
        body = clean_paragraph(chunk[match.end():end])
        # A section heading is often captured at the end of the previous paragraph.
        heading = None
        heading_match = re.search(r"\s+([A-Z][A-Z /&()\-]{4,})$", body)
        if heading_match:
            heading = heading_match.group(1).strip()
            body = body[:heading_match.start()].strip()
        parts.append(
            f'<article class="paragraph" id="co1-{number}-{paragraph}" tabindex="-1">'
            f'<a class="pilcrow" href="#co1-{number}-{paragraph}" aria-label="CO-1 {number}:{paragraph}">{number}:{paragraph}</a>'
            f'<p>{link_citations(body)}</p></article>'
        )
        if heading:
            parts.append(f"<h3>{escape(heading.title())}</h3>")
    parts.append("</section>")
    return "\n".join(parts)


def appendix_html(letter: str, title: str, chunk: str) -> str:
    cleaned = []
    for line in chunk.splitlines():
        text = line.strip()
        if not text or re.fullmatch(r".+\s+Appendix [A-F]", text):
            continue
        cleaned.append(text)
    content = link_citations("\n".join(cleaned))
    return (
        f'<section class="appendix" id="appendix-{letter.lower()}" tabindex="-1">'
        f'<h2>Appendix {letter}: {escape(title.title())}</h2><pre>{content}</pre></section>'
    )


def main() -> None:
    text = extract_text()
    boundaries = list(re.finditer(r"(?m)^\f?(CHAPTER ([123]): ([^\n]+)|APPENDIX ([A-F]): ([^\n]+))$", text))
    sections = []
    toc = []
    for index, match in enumerate(boundaries):
        end = boundaries[index + 1].start() if index + 1 < len(boundaries) else len(text)
        chunk = text[match.end():end]
        if match.group(2):
            number = int(match.group(2))
            title = match.group(3)
            sections.append(chapter_html(number, title, chunk))
            toc.append(f'<a href="#chapter-{number}">Chapter {number}</a>')
        else:
            letter = match.group(4)
            title = match.group(5)
            sections.append(appendix_html(letter, title, chunk))
            toc.append(f'<a href="#appendix-{letter.lower()}">Appendix {letter}</a>')

    html = f'''<!doctype html>
<html lang="en-NZ">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>CO-1 — Convention Organization Guidelines</title>
<style>
:root {{ --blue:#075985; --ink:#17212b; --muted:#52606d; --line:#cbd5e1; --wash:#f5f8fa; }}
* {{ box-sizing:border-box; }}
html {{ scroll-behavior:smooth; }}
body {{ margin:0 auto; max-width:980px; padding:0 1.25rem 5rem; color:var(--ink); font:17px/1.62 system-ui,-apple-system,"Segoe UI",sans-serif; }}
header {{ padding:2rem 0 1.2rem; border-bottom:1px solid var(--line); }}
h1 {{ margin:0; color:var(--blue); line-height:1.15; }}
.meta {{ color:var(--muted); }}
nav {{ position:sticky; top:0; z-index:5; display:flex; flex-wrap:wrap; gap:.45rem; margin:0 -1.25rem 2rem; padding:.7rem 1.25rem; border-bottom:1px solid var(--line); background:rgba(255,255,255,.96); }}
nav a {{ padding:.25rem .55rem; border-radius:.3rem; color:var(--blue); font-weight:700; text-decoration:none; }}
nav a:hover {{ background:#e0f2fe; }}
h2 {{ margin-top:2.7rem; color:var(--blue); line-height:1.25; }}
h3 {{ margin:2rem 0 .6rem; color:#334e68; }}
.paragraph {{ position:relative; display:grid; grid-template-columns:3.4rem 1fr; gap:.8rem; margin:.35rem 0; padding:.55rem .7rem; border-radius:.45rem; scroll-margin-top:4.5rem; }}
.paragraph:target {{ outline:3px solid #f59e0b; background:#fffbeb; }}
.paragraph p {{ margin:0; }}
.pilcrow {{ align-self:start; padding:.1rem .25rem; border-radius:.25rem; color:var(--blue); background:#e0f2fe; font-size:.86rem; font-weight:800; text-align:center; text-decoration:none; }}
.appendix {{ scroll-margin-top:4.5rem; }}
.appendix:target {{ outline:3px solid #f59e0b; outline-offset:.5rem; }}
pre {{ overflow:auto; padding:1rem; border:1px solid var(--line); border-radius:.5rem; background:var(--wash); white-space:pre-wrap; font:15px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif; }}
.cross-reference {{ border-bottom:1px dotted currentColor; color:var(--blue); font-weight:750; text-decoration:none; }}
.cross-reference:hover {{ border-bottom-style:solid; background:#e0f2fe; }}
.notice {{ padding:.8rem 1rem; border-left:4px solid #f59e0b; background:#fffbeb; }}
@media (max-width:600px) {{ body {{ font-size:16px; }} .paragraph {{ grid-template-columns:2.8rem 1fr; padding:.45rem .2rem; }} }}
@media print {{ nav {{ position:static; }} .paragraph:target {{ outline:0; }} }}
</style>
</head>
<body>
<header><h1>Convention Organization Guidelines</h1><p class="meta">CO-1-E BrAUS · February 2026 · HTML working edition</p><p class="notice">This locally generated page supports precise links and does not replace the official PDF. Access and distribution remain subject to the restrictions stated in CO-1.</p></header>
<nav aria-label="CO-1 contents"><a href="coordinator/search.html">Search</a> {' '.join(toc)} <a href="CO-1_s-BrAUS_E.pdf">Official PDF</a></nav>
<main>{''.join(sections)}</main>
</body></html>'''
    TARGET.write_text(html, encoding="utf-8")
    print(f"Generated {TARGET.name} with {len(re.findall(r'id=\"co1-', html))} paragraph anchors.")


if __name__ == "__main__":
    main()
