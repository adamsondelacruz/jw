#!/usr/bin/env python3
"""Render the Rooming Markdown documents to linked standalone HTML files."""

from pathlib import Path
import os
import re
import subprocess
import sys


ROOT = Path(__file__).resolve().parent
DOCS = [
    "index.md",
    "rooming-overview.md",
    "departments-and-personnel.md",
    "forms-register.md",
    "rooming-overseer-checklist.md",
    "glossary.md",
    "source-map.md",
]
TEMPLATES = sorted((ROOT / "templates").glob("*.md"))


def title_for(source: Path) -> str:
    for line in source.read_text(encoding="utf-8").splitlines():
        if line.startswith("# "):
            return line[2:].strip()
    return source.stem.replace("-", " ").title()


def render(source: Path, *, css: str, nav: str) -> None:
    target = source.with_suffix(".html")
    subprocess.run(
        [
            "pandoc",
            str(source),
            "--from=gfm+raw_html",
            "--to=html5",
            "--standalone",
            f"--css={css}",
            f"--include-before-body={nav}",
            "--metadata",
            f"pagetitle={title_for(source)}",
            "--metadata",
            "lang=en-NZ",
            f"--output={target}",
        ],
        cwd=ROOT,
        check=True,
    )
    html = target.read_text(encoding="utf-8")
    html = re.sub(r'href="([^"#?]+)\.md([#?][^"]*)?"', r'href="\1.html\2"', html)
    linker = Path(os.path.relpath(ROOT.parent / "co1-links.js", target.parent)).as_posix()
    checklist_css = Path(os.path.relpath(ROOT.parent / "checklist-state.css", target.parent)).as_posix()
    checklist_data = Path(os.path.relpath(ROOT.parent / "checklist-state-data.js", target.parent)).as_posix()
    checklist_js = Path(os.path.relpath(ROOT.parent / "checklist-state.js", target.parent)).as_posix()
    html = html.replace("</head>", f'<link rel="stylesheet" href="{checklist_css}">\n</head>')
    html = html.replace("</body>", f'<script src="{checklist_data}"></script>\n<script src="{checklist_js}"></script>\n<script src="{linker}" data-co1="CO-1.html"></script>\n</body>')
    target.write_text(html, encoding="utf-8")


subprocess.run([sys.executable, str(ROOT.parent / "build_checklist_state.py")], check=True)
for name in DOCS:
    render(ROOT / name, css="assets/rooming.css", nav="assets/nav.html")

for source in TEMPLATES:
    render(source, css="../assets/rooming.css", nav="assets/template-nav.html")

print(f"Rendered {len(DOCS)} guides and {len(TEMPLATES)} templates.")
