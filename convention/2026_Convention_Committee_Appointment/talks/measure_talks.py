#!/usr/bin/env python3
"""Report reproducible manuscript word and cue counts for the convention talks."""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path


WORD = re.compile(r"\b[\w’'-]+\b", re.UNICODE)
HTML = re.compile(r"<[^>]+>")
LINK = re.compile(r"\[([^]]+)\]\([^)]+\)")


def words(text: str) -> int:
    text = HTML.sub(" ", text)
    text = LINK.sub(r"\1", text)
    text = re.sub(r"[*_`>#]", " ", text)
    return len(WORD.findall(text))


def measure(path: Path) -> dict[str, object]:
    manuscript_lines: list[str] = []
    section_lines: dict[str, list[str]] = {}
    current_section = "Front matter"
    readings = videos = delivery_cues = 0

    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line:
            continue
        if line.startswith("## "):
            current_section = line[3:]
            section_lines.setdefault(current_section, [])
            continue
        if line.startswith("#"):
            continue
        if line.startswith("<div class=\"video\">"):
            videos += 1
            continue
        if re.match(r"^\*\*(?:Read|READ|Basahin|BASAHIN) ", line):
            readings += 1
            continue
        if line.startswith("*(") and line.endswith(")*"):
            delivery_cues += 1
            continue
        if line.startswith("**2026 Regional Convention"):
            continue
        if line.startswith("**Manuscript draft"):
            continue
        if line.startswith("**Tagalog manuscript"):
            continue
        if "Green = main idea" in line or "Berde = pangunahing ideya" in line:
            continue
        manuscript_lines.append(line)
        section_lines.setdefault(current_section, []).append(line)

    return {
        "manuscript_words": words("\n".join(manuscript_lines)),
        "required_reading_cues": readings,
        "video_cues": videos,
        "delivery_cues": delivery_cues,
        "section_words": {
            section: words("\n".join(lines))
            for section, lines in section_lines.items()
            if words("\n".join(lines))
        },
    }


if __name__ == "__main__":
    targets = [Path(value) for value in sys.argv[1:]]
    if not targets:
        raise SystemExit("usage: measure_talks.py PATH [PATH ...]")
    print(json.dumps({str(path): measure(path) for path in targets}, indent=2))
