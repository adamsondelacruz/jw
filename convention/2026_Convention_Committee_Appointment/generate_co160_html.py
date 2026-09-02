#!/usr/bin/env python3
"""Create a searchable, page-linkable HTML working edition of CO-160."""

from html import escape
from pathlib import Path
import re
import subprocess

ROOT = Path(__file__).resolve().parent
SOURCE = ROOT / "CO-160_E.pdf"
TARGET = ROOT / "CO-160.html"


def page_text(page: int) -> str:
    result = subprocess.run(
        ["pdftotext", "-f", str(page), "-l", str(page), "-layout", str(SOURCE), "-"],
        check=True, capture_output=True, text=True,
    )
    lines = [line.rstrip() for line in result.stdout.replace("\r", "").splitlines()]
    while lines and not lines[0].strip():
        lines.pop(0)
    while lines and not lines[-1].strip():
        lines.pop()
    return "\n".join(lines)


def title_for(text: str, page: int) -> str:
    candidates = [re.sub(r"\s+", " ", line).strip() for line in text.splitlines() if line.strip()]
    for line in candidates[:12]:
        if re.match(r"^(?:CHAPTER \d+|APPENDIX [A-G]|INTRODUCTION)", line, re.I):
            return line.title()
    return f"Official PDF page {page}"


def main() -> None:
    info = subprocess.run(["pdfinfo", str(SOURCE)], check=True, capture_output=True, text=True).stdout
    pages = int(re.search(r"^Pages:\s+(\d+)", info, re.MULTILINE).group(1))
    sections = []
    for page in range(1, pages + 1):
        text = page_text(page)
        sections.append(
            f'<section class="pdf-page" id="co160-page-{page}" tabindex="-1">'
            f'<h2><a href="#co160-page-{page}">Page {page}</a> <small>{escape(title_for(text, page))}</small></h2>'
            f'<pre>{escape(text)}</pre></section>'
        )
    html = f'''<!doctype html>
<html lang="en-NZ"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>CO-160 — Audio/Video Guidelines for Assemblies and Conventions</title>
<style>
:root{{--blue:#075985;--ink:#17212b;--muted:#52606d;--line:#cbd5e1;--wash:#f5f8fa}}
*{{box-sizing:border-box}}html{{scroll-behavior:smooth}}body{{max-width:1040px;margin:0 auto;padding:0 1.25rem 5rem;color:var(--ink);font:16px/1.55 system-ui,-apple-system,"Segoe UI",sans-serif}}
header{{padding:2rem 0 1.2rem;border-bottom:1px solid var(--line)}}h1{{margin:0;color:var(--blue);line-height:1.15}}.meta{{color:var(--muted)}}.notice{{padding:.8rem 1rem;border-left:4px solid #f59e0b;background:#fffbeb}}
nav{{position:sticky;top:0;z-index:5;display:flex;gap:.5rem;margin:0 -1.25rem 2rem;padding:.75rem 1.25rem;border-bottom:1px solid var(--line);background:rgba(255,255,255,.96)}}nav a{{color:var(--blue);font-weight:750}}
.pdf-page{{scroll-margin-top:4.5rem;margin:2rem 0}}.pdf-page:target{{outline:3px solid #f59e0b;outline-offset:.55rem}}h2{{display:flex;gap:.7rem;align-items:baseline;color:var(--blue)}}h2 a{{color:inherit}}h2 small{{color:var(--muted);font-size:.7em;font-weight:600}}
pre{{overflow:auto;padding:1rem;border:1px solid var(--line);border-radius:.55rem;background:var(--wash);white-space:pre-wrap;font:15px/1.5 ui-monospace,SFMono-Regular,Consolas,monospace}}
@media(max-width:600px){{h2{{display:grid}}pre{{font-size:13px}}}}@media print{{nav{{position:static}}.pdf-page:target{{outline:0}}}}
</style></head><body>
<header><h1>Audio/Video Guidelines for Assemblies and Conventions</h1><p class="meta">CO-160-E · May 2024 · HTML working edition generated from the official PDF</p><p class="notice">This page supports local full-text search and precise page links. It does not replace the official PDF, and its access and distribution remain subject to CO-160’s restrictions.</p></header>
<nav><a href="coordinator/search.html">Search</a><a href="CO-1.html#co1-3-24">CO-1 3:24</a><a href="CO-160_E.pdf" target="_blank" rel="noopener">Official PDF</a></nav>
<main>{''.join(sections)}</main></body></html>'''
    TARGET.write_text(html, encoding="utf-8")
    print(f"Generated {TARGET.name} with {pages} page anchors.")


if __name__ == "__main__":
    main()
