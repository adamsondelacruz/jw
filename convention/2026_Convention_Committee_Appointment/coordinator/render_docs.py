#!/usr/bin/env python3
"""Render coordinator Markdown documents to linked standalone HTML files."""

from pathlib import Path
import json
import os
import re
import subprocess
import sys

from portal_links import PEOPLE, PERSON_ALIASES
from build_search_index import build as build_search_index

ROOT = Path(__file__).resolve().parent
DOCS = [
    "index.md",
    "coordinator-overview.md",
    "departments-and-personnel.md",
    "organisation-chart.md",
    "contact-masterlist.md",
    "forms-register.md",
    "coordinator-checklist.md",
    "source-map.md",
    "co-53-guide.md",
    "operational-guidance.md",
]


def title_for(source: Path) -> str:
    for line in source.read_text(encoding="utf-8").splitlines():
        if line.startswith("# "):
            return line[2:].strip()
    return source.stem.replace("-", " ").title()


def render(source: Path, css: str, nav: str) -> None:
    target = source.with_suffix(".html")
    subprocess.run([
        "pandoc", str(source), "--from=gfm+raw_html", "--to=html5", "--standalone",
        f"--css={css}", f"--include-before-body={nav}",
        "--metadata", f"pagetitle={title_for(source)}",
        "--metadata", "lang=en-NZ", f"--output={target}",
    ], cwd=ROOT, check=True)
    html = target.read_text(encoding="utf-8")
    html = re.sub(r'href="([^"#?]+)\.md([#?][^"]*)?"', r'href="\1.html\2"', html)
    linker = Path(os.path.relpath(ROOT.parent / "co1-links.js", target.parent)).as_posix()
    link_data = Path(os.path.relpath(ROOT / "portal-link-data.js", target.parent)).as_posix()
    checklist_css = Path(os.path.relpath(ROOT.parent / "checklist-state.css", target.parent)).as_posix()
    checklist_data = Path(os.path.relpath(ROOT.parent / "checklist-state-data.js", target.parent)).as_posix()
    checklist_js = Path(os.path.relpath(ROOT.parent / "checklist-state.js", target.parent)).as_posix()
    html = html.replace("</head>", f'<link rel="stylesheet" href="{checklist_css}">\n</head>')
    html = html.replace("</body>", f'<script src="{checklist_data}"></script>\n<script src="{checklist_js}"></script>\n<script src="{link_data}"></script>\n<script src="{linker}" data-co1="CO-1.html"></script>\n</body>')
    target.write_text(html, encoding="utf-8")


def write_link_data() -> None:
    people = [{"name": name, "id": f"person-{slug}"} for name, slug in PEOPLE.values()]
    people.extend({"name": name, "id": f"person-{slug}"} for name, slug in PERSON_ALIASES.items())
    payload = json.dumps({"people": people}, ensure_ascii=False, separators=(",", ":"))
    (ROOT / "portal-link-data.js").write_text(f"window.COORDINATOR_LINK_DATA={payload};\n", encoding="utf-8")


write_link_data()
subprocess.run([sys.executable, str(ROOT.parent / "build_checklist_state.py")], check=True)
for name in DOCS:
    render(ROOT / name, "assets/coordinator.css", "assets/nav.html")
for source in sorted((ROOT / "templates").glob("*.md")):
    render(source, "../assets/coordinator.css", "assets/template-nav.html")
for source in sorted((ROOT / "meetings").glob("*.md")):
    render(source, "../assets/coordinator.css", "assets/template-nav.html")

build_search_index()
print(f"Rendered {len(DOCS)} guides, {len(list((ROOT / 'templates').glob('*.md')))} templates, and {len(list((ROOT / 'meetings').glob('*.md')))} meetings.")
