#!/usr/bin/env python3
"""Render the convention talk Markdown files to HTML and, when requested, PDF."""

from __future__ import annotations

import argparse
import subprocess
import tempfile
from pathlib import Path


ROOT = Path(__file__).resolve().parent
TALKS = ("004", "013")
DOCUMENTS = {
    "00-index.md": "08-extemp.css",
    "01-draft-talk.md": "07-delivery.css",
    "02-extemp-guide.md": "08-extemp.css",
    "03-draft-talk-TG.md": "07-delivery.css",
    "04-extemp-guide-TG.md": "08-extemp.css",
    "05-extemp-delivery-tips.md": "08-extemp.css",
    "06-metrics-index.md": "08-extemp.css",
}


def run(command: list[str]) -> None:
    subprocess.run(command, check=True)


def render_html(talk_dir: Path, markdown_name: str, css_name: str) -> Path:
    source = talk_dir / markdown_name
    destination = source.with_suffix(".html")
    run(
        [
            "pandoc",
            str(source),
            "--from=gfm+raw_html",
            "--to=html5",
            "--standalone",
            "--section-divs",
            f"--css={css_name}",
            "--metadata",
            f"pagetitle={source.stem.replace('-', ' ').title()}",
            "--output",
            str(destination),
        ]
    )
    return destination


def render_pdf(html: Path) -> None:
    destination = html.with_suffix(".pdf")
    with tempfile.TemporaryDirectory(prefix="convention-talk-chrome-") as profile:
        run(
            [
                "google-chrome",
                "--headless",
                "--no-sandbox",
                "--disable-gpu",
                "--disable-breakpad",
                "--disable-crash-reporter",
                f"--user-data-dir={profile}",
                "--no-pdf-header-footer",
                f"--print-to-pdf={destination}",
                html.resolve().as_uri(),
            ]
        )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--talk", choices=(*TALKS, "all"), default="all")
    parser.add_argument("--pdf", action="store_true")
    args = parser.parse_args()

    selected = TALKS if args.talk == "all" else (args.talk,)
    for talk in selected:
        talk_dir = ROOT / talk
        for markdown_name, css_name in DOCUMENTS.items():
            if not (talk_dir / markdown_name).exists():
                continue
            html = render_html(talk_dir, markdown_name, css_name)
            if args.pdf and markdown_name in {
                "01-draft-talk.md",
                "02-extemp-guide.md",
                "03-draft-talk-TG.md",
                "04-extemp-guide-TG.md",
                "05-extemp-delivery-tips.md",
            }:
                render_pdf(html)
        resources_dir = talk_dir / "resources"
        for resource in sorted(resources_dir.glob("*.md")):
            render_html(resources_dir, resource.name, "../08-extemp.css")


if __name__ == "__main__":
    main()
