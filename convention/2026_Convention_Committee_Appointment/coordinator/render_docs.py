#!/usr/bin/env python3
"""Render coordinator Markdown documents to linked standalone HTML files."""

from pathlib import Path
import re
import subprocess

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
    target.write_text(html, encoding="utf-8")


for name in DOCS:
    render(ROOT / name, "assets/coordinator.css", "assets/nav.html")
for source in sorted((ROOT / "templates").glob("*.md")):
    render(source, "../assets/coordinator.css", "assets/template-nav.html")

print(f"Rendered {len(DOCS)} guides and {len(list((ROOT / 'templates').glob('*.md')))} templates.")
