#!/usr/bin/env python3
"""Generate searchable, page-linkable HTML editions of related AV guidelines."""

from html import escape
from pathlib import Path
import re
import subprocess

ROOT = Path(__file__).resolve().parent
DOCUMENTS = [
    ("CO-160a_s-Nz_E.pdf", "CO-160a.html", "CO-160a", "Audio/Video Guidelines for Assemblies and Conventions Addendum", "August 2025"),
    ("CO-162_E.pdf", "CO-162.html", "CO-162", "Instructions for Livestreaming Conventions", "March 2026"),
]


def generate(source_name: str, target_name: str, code: str, title: str, date: str) -> int:
    source, target = ROOT / source_name, ROOT / target_name
    info = subprocess.run(["pdfinfo", str(source)], check=True, capture_output=True, text=True).stdout
    pages = int(re.search(r"^Pages:\s+(\d+)", info, re.MULTILINE).group(1))
    sections = []
    for page in range(1, pages + 1):
        result = subprocess.run(
            ["pdftotext", "-f", str(page), "-l", str(page), "-layout", str(source), "-"],
            check=True, capture_output=True, text=True,
        )
        text = result.stdout.replace("\r", "").strip()
        anchor = f"{code.lower()}-page-{page}"
        sections.append(f'<section id="{anchor}" tabindex="-1"><h2><a href="#{anchor}">Page {page}</a></h2><pre>{escape(text)}</pre></section>')
    html = f'''<!doctype html><html lang="en-NZ"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{escape(code)} — {escape(title)}</title>
<style>:root{{--blue:#075985;--ink:#17212b;--muted:#52606d;--line:#cbd5e1;--wash:#f5f8fa}}*{{box-sizing:border-box}}html{{scroll-behavior:smooth}}body{{max-width:1040px;margin:0 auto;padding:0 1.25rem 5rem;color:var(--ink);font:16px/1.55 system-ui,-apple-system,"Segoe UI",sans-serif}}header{{padding:2rem 0 1.2rem;border-bottom:1px solid var(--line)}}h1{{margin:0;color:var(--blue);line-height:1.15}}.meta{{color:var(--muted)}}.notice{{padding:.8rem 1rem;border-left:4px solid #f59e0b;background:#fffbeb}}nav{{position:sticky;top:0;z-index:5;display:flex;gap:.6rem;margin:0 -1.25rem 2rem;padding:.75rem 1.25rem;border-bottom:1px solid var(--line);background:rgba(255,255,255,.96)}}nav a,h2 a{{color:var(--blue);font-weight:750}}section{{scroll-margin-top:4.5rem;margin:2rem 0}}section:target{{outline:3px solid #f59e0b;outline-offset:.55rem}}pre{{overflow:auto;padding:1rem;border:1px solid var(--line);border-radius:.55rem;background:var(--wash);white-space:pre-wrap;font:15px/1.5 ui-monospace,SFMono-Regular,Consolas,monospace}}@media(max-width:600px){{pre{{font-size:13px}}}}@media print{{nav{{position:static}}section:target{{outline:0}}}}</style></head>
<body><header><h1>{escape(title)}</h1><p class="meta">{escape(code)} · {escape(date)} · HTML working edition generated from the official PDF</p><p class="notice">This page supports local full-text search and precise page links. It does not replace the official PDF, and its access and distribution remain subject to the source document’s restrictions.</p></header><nav><a href="coordinator/search.html">Search</a><a href="CO-160.html">CO-160</a><a href="{escape(source_name)}" target="_blank" rel="noopener">Official PDF</a></nav><main>{''.join(sections)}</main></body></html>'''
    target.write_text(html, encoding="utf-8")
    print(f"Generated {target.name} with {pages} page anchors.")
    return pages


if __name__ == "__main__":
    for document in DOCUMENTS:
        generate(*document)
